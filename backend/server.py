from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
from datetime import datetime
import random
import uuid
from pymongo import MongoClient
import re

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Twitch Giveaway API", version="2.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URL)
db = client.twitch_giveaway

# Collections
participants_collection = db.participants
giveaways_collection = db.giveaways
chat_messages_collection = db.chat_messages

# Pydantic models
class ChatMessage(BaseModel):
    id: str = None
    username: str
    message: str
    timestamp: str
    is_keyword: bool = False
    is_system: bool = False
    giveaway_id: Optional[str] = None

class Participant(BaseModel):
    id: str = None
    username: str
    joined_at: str
    giveaway_id: str

class Giveaway(BaseModel):
    id: str = None
    stream_url: str
    channel_name: str
    keyword: str
    is_active: bool
    created_at: str
    winner: Optional[str] = None
    participants_count: int = 0

class GiveawayCreate(BaseModel):
    stream_url: str
    channel_name: str
    keyword: str

class TwitchChatMessage(BaseModel):
    username: str
    message: str
    channel: str
    keyword: str

def extract_channel_name(url: str) -> Optional[str]:
    """Extract channel name from Twitch URL"""
    try:
        patterns = [
            r'twitch\.tv\/(\w+)$',
            r'twitch\.tv\/(\w+)\/?',
            r'www\.twitch\.tv\/(\w+)$',
            r'www\.twitch\.tv\/(\w+)\/?',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1).lower()
        
        # If it's just a channel name
        if re.match(r'^\w+$', url):
            return url.lower()
        
        return None
    except Exception as e:
        logger.error(f"Error extracting channel name: {e}")
        return None

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Create giveaway
@app.post("/api/giveaway", response_model=Giveaway)
async def create_giveaway(giveaway_data: GiveawayCreate):
    try:
        giveaway_id = str(uuid.uuid4())
        
        # Extract channel name if URL provided
        channel_name = extract_channel_name(giveaway_data.stream_url)
        if not channel_name:
            channel_name = giveaway_data.channel_name or "unknown"
        
        giveaway = {
            "id": giveaway_id,
            "stream_url": giveaway_data.stream_url,
            "channel_name": channel_name,
            "keyword": giveaway_data.keyword,
            "is_active": True,
            "created_at": datetime.now().isoformat(),
            "winner": None,
            "participants_count": 0
        }
        
        giveaways_collection.insert_one(giveaway)
        
        logger.info(f"Created giveaway for channel: {channel_name}")
        return Giveaway(**giveaway)
    except Exception as e:
        logger.error(f"Error creating giveaway: {e}")
        raise HTTPException(status_code=500, detail="Failed to create giveaway")

# Get active giveaway
@app.get("/api/giveaway/active")
async def get_active_giveaway():
    try:
        giveaway = giveaways_collection.find_one({"is_active": True}, sort=[("created_at", -1)])
        if not giveaway:
            return None
        
        giveaway["_id"] = str(giveaway["_id"])
        return giveaway
    except Exception as e:
        logger.error(f"Error getting active giveaway: {e}")
        raise HTTPException(status_code=500, detail="Failed to get active giveaway")

# Process Twitch chat message
@app.post("/api/chat/message")
async def process_chat_message(chat_msg: TwitchChatMessage):
    try:
        # Find active giveaway for this channel
        giveaway = giveaways_collection.find_one({
            "channel_name": chat_msg.channel.lower(),
            "is_active": True
        })
        
        if not giveaway:
            return {"message": "No active giveaway for this channel"}
        
        giveaway_id = giveaway["id"]
        is_keyword_message = chat_msg.keyword.lower() in chat_msg.message.lower()
        
        # Save chat message
        chat_message = {
            "id": str(uuid.uuid4()),
            "username": chat_msg.username,
            "message": chat_msg.message,
            "timestamp": datetime.now().isoformat(),
            "is_keyword": is_keyword_message,
            "is_system": False,
            "giveaway_id": giveaway_id
        }
        
        chat_messages_collection.insert_one(chat_message)
        
        # Add participant if keyword message
        if is_keyword_message:
            existing = participants_collection.find_one({
                "giveaway_id": giveaway_id,
                "username": chat_msg.username
            })
            
            if not existing:
                participant = {
                    "id": str(uuid.uuid4()),
                    "username": chat_msg.username,
                    "joined_at": datetime.now().isoformat(),
                    "giveaway_id": giveaway_id
                }
                
                participants_collection.insert_one(participant)
                
                # Update count
                giveaways_collection.update_one(
                    {"id": giveaway_id},
                    {"$inc": {"participants_count": 1}}
                )
                
                logger.info(f"Added participant: {chat_msg.username} to giveaway {giveaway_id}")
                return {"message": "Participant added", "is_participant": True}
        
        return {"message": "Message processed", "is_participant": False}
        
    except Exception as e:
        logger.error(f"Error processing chat message: {e}")
        raise HTTPException(status_code=500, detail="Failed to process chat message")

# Get participants
@app.get("/api/giveaway/{giveaway_id}/participants")
async def get_participants(giveaway_id: str):
    try:
        participants = list(participants_collection.find(
            {"giveaway_id": giveaway_id},
            {"_id": 0}
        ).sort("joined_at", 1))
        return participants
    except Exception as e:
        logger.error(f"Error getting participants: {e}")
        raise HTTPException(status_code=500, detail="Failed to get participants")

# Select winner
@app.post("/api/giveaway/{giveaway_id}/winner")
async def select_winner(giveaway_id: str):
    try:
        participants = list(participants_collection.find(
            {"giveaway_id": giveaway_id},
            {"username": 1, "_id": 0}
        ))
        
        if not participants:
            raise HTTPException(status_code=400, detail="No participants found")
        
        winner = random.choice(participants)["username"]
        
        # Update giveaway with winner
        giveaways_collection.update_one(
            {"id": giveaway_id},
            {"$set": {"winner": winner}}
        )
        
        # Add winner announcement to chat
        winner_msg = {
            "id": str(uuid.uuid4()),
            "username": "TwitchBot",
            "message": f"🏆 Поздравляем {winner}! Вы выиграли!",
            "timestamp": datetime.now().isoformat(),
            "is_keyword": False,
            "is_system": True,
            "giveaway_id": giveaway_id
        }
        chat_messages_collection.insert_one(winner_msg)
        
        logger.info(f"Selected winner: {winner} for giveaway {giveaway_id}")
        return {"winner": winner}
    except Exception as e:
        logger.error(f"Error selecting winner: {e}")
        raise HTTPException(status_code=500, detail="Failed to select winner")

# Stop giveaway
@app.post("/api/giveaway/{giveaway_id}/stop")
async def stop_giveaway(giveaway_id: str):
    try:
        result = giveaways_collection.update_one(
            {"id": giveaway_id},
            {"$set": {"is_active": False}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Giveaway not found")
        
        logger.info(f"Stopped giveaway: {giveaway_id}")
        return {"message": "Giveaway stopped"}
    except Exception as e:
        logger.error(f"Error stopping giveaway: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop giveaway")

# Get chat messages
@app.get("/api/giveaway/{giveaway_id}/chat")
async def get_chat_messages(giveaway_id: str, limit: int = 50):
    try:
        messages = list(chat_messages_collection.find(
            {"giveaway_id": giveaway_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit))
        
        # Reverse to show oldest first
        messages.reverse()
        return messages
    except Exception as e:
        logger.error(f"Error getting chat messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to get chat messages")

# Clear participants
@app.delete("/api/giveaway/{giveaway_id}/participants")
async def clear_participants(giveaway_id: str):
    try:
        participants_collection.delete_many({"giveaway_id": giveaway_id})
        giveaways_collection.update_one(
            {"id": giveaway_id},
            {"$set": {"participants_count": 0, "winner": None}}
        )
        
        logger.info(f"Cleared participants for giveaway: {giveaway_id}")
        return {"message": "Participants cleared"}
    except Exception as e:
        logger.error(f"Error clearing participants: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear participants")

# Get channel statistics
@app.get("/api/channel/{channel_name}/stats")
async def get_channel_stats(channel_name: str):
    try:
        # Get active giveaway for channel
        giveaway = giveaways_collection.find_one({
            "channel_name": channel_name.lower(),
            "is_active": True
        })
        
        if not giveaway:
            return {"message": "No active giveaway for this channel"}
        
        # Get stats
        participants_count = participants_collection.count_documents({"giveaway_id": giveaway["id"]})
        messages_count = chat_messages_collection.count_documents({"giveaway_id": giveaway["id"]})
        
        return {
            "giveaway_id": giveaway["id"],
            "channel_name": channel_name,
            "participants_count": participants_count,
            "messages_count": messages_count,
            "keyword": giveaway["keyword"],
            "winner": giveaway.get("winner")
        }
        
    except Exception as e:
        logger.error(f"Error getting channel stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get channel stats")

# Clear all data (for testing)
@app.delete("/api/clear-all")
async def clear_all_data():
    try:
        giveaways_collection.delete_many({})
        participants_collection.delete_many({})
        chat_messages_collection.delete_many({})
        return {"message": "All data cleared"}
    except Exception as e:
        logger.error(f"Error clearing data: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear data")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)