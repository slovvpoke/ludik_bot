from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
from datetime import datetime
import random
import asyncio
import uuid
from pymongo import MongoClient

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Twitch Giveaway API", version="1.0.0")

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

class Participant(BaseModel):
    id: str = None
    username: str
    joined_at: str
    giveaway_id: str

class Giveaway(BaseModel):
    id: str = None
    stream_url: str
    keyword: str
    is_active: bool
    created_at: str
    winner: Optional[str] = None
    participants_count: int = 0

class GiveawayCreate(BaseModel):
    stream_url: str
    keyword: str

class WinnerSelect(BaseModel):
    giveaway_id: str

# Demo data for simulation
DEMO_USERS = [
    'StreamFan123', 'GamerPro', 'TwitchLover', 'ChatMaster', 'ViewerOne',
    'KappaPride', 'EpicGamer', 'StreamSniper', 'ChatBot2023', 'ProViewer',
    'TwitchNinja', 'StreamKing', 'ViewerMaster', 'ChatLegend', 'GameOn',
    'StreamHero', 'TwitchStar', 'ViewerPro', 'ChatChampion', 'StreamFan'
]

DEMO_MESSAGES = [
    'Привет стрим!', 'Классная игра!', 'Первый!', 'Как дела?', 
    'Крутой контент!', 'Удачи в игре!', 'Смотрю каждый день!',
    'Лучший стример!', 'Интересно!', 'Продолжай в том же духе!'
]

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Create giveaway
@app.post("/api/giveaway", response_model=Giveaway)
async def create_giveaway(giveaway_data: GiveawayCreate):
    try:
        giveaway_id = str(uuid.uuid4())
        giveaway = {
            "id": giveaway_id,
            "stream_url": giveaway_data.stream_url,
            "keyword": giveaway_data.keyword,
            "is_active": True,
            "created_at": datetime.now().isoformat(),
            "winner": None,
            "participants_count": 0
        }
        
        giveaways_collection.insert_one(giveaway)
        
        # Add system message
        system_msg = {
            "id": str(uuid.uuid4()),
            "username": "TwitchBot",
            "message": f"🎉 Розыгрыш начался! Пишите \"{giveaway_data.keyword}\" для участия!",
            "timestamp": datetime.now().isoformat(),
            "is_keyword": False,
            "is_system": True,
            "giveaway_id": giveaway_id
        }
        chat_messages_collection.insert_one(system_msg)
        
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
        
        # Convert ObjectId to string
        giveaway["_id"] = str(giveaway["_id"])
        return giveaway
    except Exception as e:
        logger.error(f"Error getting active giveaway: {e}")
        raise HTTPException(status_code=500, detail="Failed to get active giveaway")

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
            
        return {"message": "Giveaway stopped"}
    except Exception as e:
        logger.error(f"Error stopping giveaway: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop giveaway")

# Get participants
@app.get("/api/giveaway/{giveaway_id}/participants")
async def get_participants(giveaway_id: str):
    try:
        participants = list(participants_collection.find(
            {"giveaway_id": giveaway_id},
            {"_id": 0}
        ))
        return participants
    except Exception as e:
        logger.error(f"Error getting participants: {e}")
        raise HTTPException(status_code=500, detail="Failed to get participants")

# Add participant
@app.post("/api/giveaway/{giveaway_id}/participant")
async def add_participant(giveaway_id: str, username: str):
    try:
        # Check if participant already exists
        existing = participants_collection.find_one({
            "giveaway_id": giveaway_id,
            "username": username
        })
        
        if existing:
            return {"message": "Participant already registered"}
        
        participant = {
            "id": str(uuid.uuid4()),
            "username": username,
            "joined_at": datetime.now().isoformat(),
            "giveaway_id": giveaway_id
        }
        
        participants_collection.insert_one(participant)
        
        # Update participants count
        giveaways_collection.update_one(
            {"id": giveaway_id},
            {"$inc": {"participants_count": 1}}
        )
        
        return {"message": "Participant added"}
    except Exception as e:
        logger.error(f"Error adding participant: {e}")
        raise HTTPException(status_code=500, detail="Failed to add participant")

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
            {"$set": {"winner": winner, "is_active": False}}
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
        
        return {"winner": winner}
    except Exception as e:
        logger.error(f"Error selecting winner: {e}")
        raise HTTPException(status_code=500, detail="Failed to select winner")

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

# Simulate chat message (for demo)
@app.post("/api/simulate/chat")
async def simulate_chat_message(giveaway_id: str = None, keyword: str = "!участвую"):
    try:
        if not giveaway_id:
            # Get active giveaway
            giveaway = giveaways_collection.find_one({"is_active": True})
            if not giveaway:
                raise HTTPException(status_code=400, detail="No active giveaway")
            giveaway_id = giveaway["id"]
        
        random_user = random.choice(DEMO_USERS)
        is_keyword_message = random.random() < 0.3  # 30% chance
        message = keyword if is_keyword_message else random.choice(DEMO_MESSAGES)
        
        chat_msg = {
            "id": str(uuid.uuid4()),
            "username": random_user,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "is_keyword": is_keyword_message,
            "is_system": False,
            "giveaway_id": giveaway_id
        }
        
        chat_messages_collection.insert_one(chat_msg)
        
        # Add participant if keyword message
        if is_keyword_message:
            existing = participants_collection.find_one({
                "giveaway_id": giveaway_id,
                "username": random_user
            })
            
            if not existing:
                participant = {
                    "id": str(uuid.uuid4()),
                    "username": random_user,
                    "joined_at": datetime.now().isoformat(),
                    "giveaway_id": giveaway_id
                }
                participants_collection.insert_one(participant)
                
                # Update count
                giveaways_collection.update_one(
                    {"id": giveaway_id},
                    {"$inc": {"participants_count": 1}}
                )
        
        return ChatMessage(**chat_msg)
    except Exception as e:
        logger.error(f"Error simulating chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to simulate chat")

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