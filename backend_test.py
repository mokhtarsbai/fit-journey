#!/usr/bin/env python3
"""
Backend API Testing for Fit Journey - Morocco Fitness Coaching Platform
Tests all backend endpoints according to the review request
"""

import requests
import json
import sys
from datetime import datetime, timezone, timedelta
import uuid

# Get backend URL from frontend .env
BACKEND_URL = "https://coaching-maroc.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class FitJourneyAPITester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
    
    def test_root_api(self):
        """Test GET /api/ - Root API endpoint"""
        try:
            response = requests.get(f"{API_BASE}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Fit Journey" in data["message"]:
                    self.log_result("Root API", True, "API info returned successfully", data)
                    return True
                else:
                    self.log_result("Root API", False, "Unexpected response format", data)
                    return False
            else:
                self.log_result("Root API", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Root API", False, f"Request failed: {str(e)}")
            return False
    
    def test_coaches_api(self):
        """Test coaches endpoints"""
        success_count = 0
        
        # Test GET /api/coaches - List all coaches
        try:
            response = requests.get(f"{API_BASE}/coaches", timeout=10)
            if response.status_code == 200:
                coaches = response.json()
                if isinstance(coaches, list) and len(coaches) > 0:
                    self.log_result("Coaches List", True, f"Retrieved {len(coaches)} coaches", f"First coach: {coaches[0].get('name', 'N/A')}")
                    success_count += 1
                    
                    # Test individual coach endpoint with first coach
                    coach_id = coaches[0].get('user_id')
                    if coach_id:
                        coach_response = requests.get(f"{API_BASE}/coaches/{coach_id}", timeout=10)
                        if coach_response.status_code == 200:
                            coach_data = coach_response.json()
                            self.log_result("Coach Details", True, f"Retrieved coach {coach_data.get('name', 'N/A')}", f"Rating: {coach_data.get('rating', 'N/A')}")
                            success_count += 1
                        else:
                            self.log_result("Coach Details", False, f"HTTP {coach_response.status_code}", coach_response.text)
                else:
                    self.log_result("Coaches List", False, "Empty or invalid coaches list", coaches)
            else:
                self.log_result("Coaches List", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Coaches List", False, f"Request failed: {str(e)}")
        
        # Test city filter
        try:
            response = requests.get(f"{API_BASE}/coaches?city=Casablanca", timeout=10)
            if response.status_code == 200:
                coaches = response.json()
                self.log_result("Coaches City Filter", True, f"Found {len(coaches)} coaches in Casablanca")
                success_count += 1
            else:
                self.log_result("Coaches City Filter", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Coaches City Filter", False, f"Request failed: {str(e)}")
        
        # Test discipline filter
        try:
            response = requests.get(f"{API_BASE}/coaches?discipline=Yoga", timeout=10)
            if response.status_code == 200:
                coaches = response.json()
                self.log_result("Coaches Discipline Filter", True, f"Found {len(coaches)} Yoga coaches")
                success_count += 1
            else:
                self.log_result("Coaches Discipline Filter", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Coaches Discipline Filter", False, f"Request failed: {str(e)}")
        
        return success_count == 4
    
    def test_events_api(self):
        """Test events endpoints"""
        success_count = 0
        
        # Test GET /api/events - List all events
        try:
            response = requests.get(f"{API_BASE}/events", timeout=10)
            if response.status_code == 200:
                events = response.json()
                if isinstance(events, list) and len(events) > 0:
                    self.log_result("Events List", True, f"Retrieved {len(events)} events", f"First event: {events[0].get('title', 'N/A')}")
                    success_count += 1
                    
                    # Test individual event endpoint
                    event_id = events[0].get('event_id')
                    if event_id:
                        event_response = requests.get(f"{API_BASE}/events/{event_id}", timeout=10)
                        if event_response.status_code == 200:
                            event_data = event_response.json()
                            self.log_result("Event Details", True, f"Retrieved event {event_data.get('title', 'N/A')}", f"Price: {event_data.get('price', 'N/A')} MAD")
                            success_count += 1
                        else:
                            self.log_result("Event Details", False, f"HTTP {event_response.status_code}", event_response.text)
                else:
                    self.log_result("Events List", False, "Empty or invalid events list", events)
            else:
                self.log_result("Events List", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Events List", False, f"Request failed: {str(e)}")
        
        return success_count == 2
    
    def test_social_feed_api(self):
        """Test social feed endpoints (public)"""
        try:
            response = requests.get(f"{API_BASE}/feed", timeout=10)
            if response.status_code == 200:
                posts = response.json()
                self.log_result("Social Feed", True, f"Retrieved {len(posts)} posts", f"Feed is accessible")
                return True
            else:
                self.log_result("Social Feed", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Social Feed", False, f"Request failed: {str(e)}")
            return False
    
    def create_test_user_session(self):
        """Create test user and session in MongoDB using mongosh"""
        import subprocess
        
        try:
            # Generate unique identifiers
            timestamp = int(datetime.now().timestamp())
            user_id = f"test-user-{timestamp}"
            session_token = f"test_session_{timestamp}"
            
            # MongoDB command to create test user and session
            mongo_command = f"""
            use('test_database');
            var userId = '{user_id}';
            var sessionToken = '{session_token}';
            db.users.insertOne({{
                user_id: userId,
                email: 'test.user.{timestamp}@example.com',
                name: 'Ahmed Test User',
                role: 'client',
                credits: 0,
                created_at: new Date()
            }});
            db.user_sessions.insertOne({{
                user_id: userId,
                session_token: sessionToken,
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            }});
            print('Session token: ' + sessionToken);
            print('User ID: ' + userId);
            """
            
            # Execute mongosh command
            result = subprocess.run(
                ["mongosh", "--eval", mongo_command],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                # Extract session token and user ID from output
                output_lines = result.stdout.split('\n')
                for line in output_lines:
                    if 'Session token:' in line:
                        self.session_token = line.split('Session token: ')[1].strip()
                    elif 'User ID:' in line:
                        self.user_id = line.split('User ID: ')[1].strip()
                
                if self.session_token and self.user_id:
                    self.log_result("Test User Creation", True, f"Created test user {self.user_id}", f"Session: {self.session_token[:20]}...")
                    return True
                else:
                    self.log_result("Test User Creation", False, "Failed to extract session info", result.stdout)
                    return False
            else:
                self.log_result("Test User Creation", False, f"MongoDB command failed", result.stderr)
                return False
                
        except Exception as e:
            self.log_result("Test User Creation", False, f"Failed to create test user: {str(e)}")
            return False
    
    def test_auth_me(self):
        """Test GET /api/auth/me with session token"""
        if not self.session_token:
            self.log_result("Auth Me", False, "No session token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                user_data = response.json()
                if user_data.get('user_id') == self.user_id:
                    self.log_result("Auth Me", True, f"Retrieved user data for {user_data.get('name', 'N/A')}", f"Email: {user_data.get('email', 'N/A')}")
                    return True
                else:
                    self.log_result("Auth Me", False, "User ID mismatch", user_data)
                    return False
            else:
                self.log_result("Auth Me", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Auth Me", False, f"Request failed: {str(e)}")
            return False
    
    def test_sessions_booking(self):
        """Test session booking endpoints"""
        if not self.session_token:
            self.log_result("Sessions Booking", False, "No session token available")
            return False
        
        success_count = 0
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # First get a coach to book with
        try:
            coaches_response = requests.get(f"{API_BASE}/coaches", timeout=10)
            if coaches_response.status_code == 200:
                coaches = coaches_response.json()
                if coaches:
                    coach = coaches[0]
                    coach_id = coach.get('user_id')
                    
                    # Test booking a session
                    session_data = {
                        "coach_id": coach_id,
                        "discipline": coach.get('disciplines', ['Yoga'])[0],
                        "date": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                        "duration_minutes": 60,
                        "location": "Casablanca, Morocco",
                        "notes": "Test session booking"
                    }
                    
                    booking_response = requests.post(
                        f"{API_BASE}/sessions",
                        json=session_data,
                        headers=headers,
                        timeout=10
                    )
                    
                    if booking_response.status_code == 200:
                        session = booking_response.json()
                        self.log_result("Session Booking", True, f"Booked session with {coach.get('name', 'N/A')}", f"Session ID: {session.get('session_id', 'N/A')}")
                        success_count += 1
                    else:
                        self.log_result("Session Booking", False, f"HTTP {booking_response.status_code}", booking_response.text)
                else:
                    self.log_result("Session Booking", False, "No coaches available for booking")
            else:
                self.log_result("Session Booking", False, f"Failed to get coaches: HTTP {coaches_response.status_code}")
        except Exception as e:
            self.log_result("Session Booking", False, f"Request failed: {str(e)}")
        
        # Test getting user sessions
        try:
            sessions_response = requests.get(f"{API_BASE}/sessions", headers=headers, timeout=10)
            if sessions_response.status_code == 200:
                sessions = sessions_response.json()
                self.log_result("Get Sessions", True, f"Retrieved {len(sessions)} user sessions")
                success_count += 1
            else:
                self.log_result("Get Sessions", False, f"HTTP {sessions_response.status_code}", sessions_response.text)
        except Exception as e:
            self.log_result("Get Sessions", False, f"Request failed: {str(e)}")
        
        return success_count == 2
    
    def test_journal_crud(self):
        """Test journal CRUD operations"""
        if not self.session_token:
            self.log_result("Journal CRUD", False, "No session token available")
            return False
        
        success_count = 0
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test creating journal entry
        try:
            journal_data = {
                "title": "Test Workout Session",
                "content": "Had a great yoga session today. Feeling energized and focused. The breathing exercises really helped with my stress levels.",
                "mood": "good",
                "discipline": "Yoga",
                "duration_minutes": 60,
                "date": datetime.now(timezone.utc).isoformat()
            }
            
            create_response = requests.post(
                f"{API_BASE}/journal",
                json=journal_data,
                headers=headers,
                timeout=10
            )
            
            if create_response.status_code == 200:
                entry = create_response.json()
                entry_id = entry.get('entry_id')
                self.log_result("Create Journal Entry", True, f"Created journal entry: {entry.get('title', 'N/A')}", f"Entry ID: {entry_id}")
                success_count += 1
            else:
                self.log_result("Create Journal Entry", False, f"HTTP {create_response.status_code}", create_response.text)
        except Exception as e:
            self.log_result("Create Journal Entry", False, f"Request failed: {str(e)}")
        
        # Test getting journal entries
        try:
            get_response = requests.get(f"{API_BASE}/journal", headers=headers, timeout=10)
            if get_response.status_code == 200:
                entries = get_response.json()
                self.log_result("Get Journal Entries", True, f"Retrieved {len(entries)} journal entries")
                success_count += 1
            else:
                self.log_result("Get Journal Entries", False, f"HTTP {get_response.status_code}", get_response.text)
        except Exception as e:
            self.log_result("Get Journal Entries", False, f"Request failed: {str(e)}")
        
        return success_count == 2
    
    def test_social_feed_authenticated(self):
        """Test authenticated social feed operations"""
        if not self.session_token:
            self.log_result("Social Feed Auth", False, "No session token available")
            return False
        
        success_count = 0
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test creating a post
        try:
            post_data = {
                "content": "Just finished an amazing yoga session! 🧘‍♀️ Feeling centered and peaceful. #FitJourney #Yoga #Morocco",
                "media_type": "text"
            }
            
            create_response = requests.post(
                f"{API_BASE}/feed",
                json=post_data,
                headers=headers,
                timeout=10
            )
            
            if create_response.status_code == 200:
                post = create_response.json()
                self.log_result("Create Social Post", True, f"Created post by {post.get('author_name', 'N/A')}", f"Post ID: {post.get('post_id', 'N/A')}")
                success_count += 1
            else:
                self.log_result("Create Social Post", False, f"HTTP {create_response.status_code}", create_response.text)
        except Exception as e:
            self.log_result("Create Social Post", False, f"Request failed: {str(e)}")
        
        return success_count == 1
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Fit Journey API Tests")
        print(f"📍 Testing backend at: {BACKEND_URL}")
        print("=" * 60)
        
        # Test public endpoints first
        print("\n📋 Testing Public Endpoints:")
        self.test_root_api()
        self.test_coaches_api()
        self.test_events_api()
        self.test_social_feed_api()
        
        # Create test user for authenticated endpoints
        print("\n🔐 Setting up Authentication:")
        if self.create_test_user_session():
            print("\n🔒 Testing Authenticated Endpoints:")
            self.test_auth_me()
            self.test_sessions_booking()
            self.test_journal_crud()
            self.test_social_feed_authenticated()
        else:
            print("❌ Skipping authenticated tests due to user creation failure")
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY:")
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   ❌ {result['test']}: {result['message']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = FitJourneyAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)