import requests
import sys
import json
from datetime import datetime
import time

class TwitchGiveawayAPITester:
    def __init__(self, base_url="https://7d35d8b5-10ff-489a-a19f-a9274d9e03c5.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.giveaway_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error Response: {json.dumps(error_data, indent=2, ensure_ascii=False)}")
                except:
                    print(f"   Error Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        return success

    def test_clear_all_data(self):
        """Clear all data before testing"""
        success, response = self.run_test(
            "Clear All Data",
            "DELETE",
            "api/clear-all",
            200
        )
        return success

    def test_create_giveaway(self):
        """Test creating a new giveaway"""
        giveaway_data = {
            "stream_url": "https://twitch.tv/test_channel",
            "channel_name": "test_channel",
            "keyword": "!участвую"
        }
        
        success, response = self.run_test(
            "Create Giveaway",
            "POST",
            "api/giveaway",
            200,
            data=giveaway_data
        )
        
        if success and 'id' in response:
            self.giveaway_id = response['id']
            print(f"   Giveaway ID: {self.giveaway_id}")
            return True
        return False

    def test_get_active_giveaway(self):
        """Test getting active giveaway"""
        success, response = self.run_test(
            "Get Active Giveaway",
            "GET",
            "api/giveaway/active",
            200
        )
        return success

    def test_process_chat_message(self):
        """Test processing a chat message with keyword"""
        if not self.giveaway_id:
            print("❌ No giveaway ID available for chat message test")
            return False
            
        chat_data = {
            "username": "TestUser123",
            "message": "!участвую Хочу выиграть!",
            "channel": "test_channel",
            "keyword": "!участвую"
        }
        
        success, response = self.run_test(
            "Process Chat Message",
            "POST",
            "api/chat/message",
            200,
            data=chat_data
        )
        return success

    def test_process_regular_message(self):
        """Test processing a regular chat message without keyword"""
        if not self.giveaway_id:
            print("❌ No giveaway ID available for regular message test")
            return False
            
        chat_data = {
            "username": "RegularUser",
            "message": "Привет всем!",
            "channel": "test_channel", 
            "keyword": "!участвую"
        }
        
        success, response = self.run_test(
            "Process Regular Message",
            "POST",
            "api/chat/message",
            200,
            data=chat_data
        )
        return success

    def test_get_chat_messages(self):
        """Test getting chat messages"""
        if not self.giveaway_id:
            print("❌ No giveaway ID available for chat messages test")
            return False
            
        success, response = self.run_test(
            "Get Chat Messages",
            "GET",
            f"api/giveaway/{self.giveaway_id}/chat",
            200,
            params={"limit": 20}
        )
        return success

    def test_get_participants(self):
        """Test getting participants"""
        if not self.giveaway_id:
            print("❌ No giveaway ID available for participants test")
            return False
            
        success, response = self.run_test(
            "Get Participants",
            "GET",
            f"api/giveaway/{self.giveaway_id}/participants",
            200
        )
        return success

    def test_add_participant_manually(self):
        """Test manually adding a participant"""
        if not self.giveaway_id:
            print("❌ No giveaway ID available for add participant test")
            return False
            
        success, response = self.run_test(
            "Add Participant Manually",
            "POST",
            f"api/giveaway/{self.giveaway_id}/participant",
            200,
            params={"username": "TestUser123"}
        )
        return success

    def test_select_winner(self):
        """Test selecting a winner"""
        if not self.giveaway_id:
            print("❌ No giveaway ID available for select winner test")
            return False
            
        # First, let's make sure we have some participants by simulating more chat
        print("   Ensuring we have participants...")
        for i in range(3):
            self.run_test(
                f"Extra Chat Message {i+1}",
                "POST",
                "api/simulate/chat",
                200
            )
            time.sleep(0.3)
        
        success, response = self.run_test(
            "Select Winner",
            "POST",
            f"api/giveaway/{self.giveaway_id}/winner",
            200
        )
        return success

    def test_stop_giveaway(self):
        """Test stopping a giveaway"""
        if not self.giveaway_id:
            print("❌ No giveaway ID available for stop giveaway test")
            return False
            
        success, response = self.run_test(
            "Stop Giveaway",
            "POST",
            f"api/giveaway/{self.giveaway_id}/stop",
            200
        )
        return success

def main():
    print("🚀 Starting Twitch Giveaway API Tests")
    print("=" * 50)
    
    tester = TwitchGiveawayAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Clear All Data", tester.test_clear_all_data),
        ("Create Giveaway", tester.test_create_giveaway),
        ("Get Active Giveaway", tester.test_get_active_giveaway),
        ("Simulate Chat Messages", tester.test_simulate_chat_messages),
        ("Get Chat Messages", tester.test_get_chat_messages),
        ("Get Participants", tester.test_get_participants),
        ("Add Participant Manually", tester.test_add_participant_manually),
        ("Select Winner", tester.test_select_winner),
        ("Stop Giveaway", tester.test_stop_giveaway),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print final results
    print("\n" + "=" * 50)
    print("📊 FINAL TEST RESULTS")
    print("=" * 50)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed Tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All tests passed!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())