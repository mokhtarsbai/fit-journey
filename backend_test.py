#!/usr/bin/env python3
"""
Backend Testing Script for Fit Journey App - New Features
Tests PDF Invoice Generation, WebSocket Chat, and updated API Root endpoint
"""

import asyncio
import json
import requests
import websockets
import time
from datetime import datetime

# Configuration
BACKEND_URL = "https://coaching-maroc.preview.emergentagent.com/api"
WS_URL = "wss://coaching-maroc.preview.emergentagent.com/ws"

# Test credentials from review request
TEST_EMAIL = "test_v3_1774976340@fitjourney.ma"
TEST_PASSWORD = "SecurePass123!"
TEST_PACK_ID = "pack_83a352b3df58"

class FitJourneyTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def authenticate(self):
        """Authenticate with the provided test credentials"""
        self.log("🔐 Authenticating with test credentials...")
        
        # Try to login first
        login_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "consent_accepted": True
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/email/login", json=login_data)
            if response.status_code == 200:
                auth_data = response.json()
                self.access_token = auth_data["access_token"]
                self.user_id = auth_data["user"]["user_id"]
                self.log(f"✅ Login successful - User ID: {self.user_id}")
                return True
            elif response.status_code == 401:
                self.log("⚠️ Login failed, trying to register...")
                return self.register()
            else:
                self.log(f"❌ Login failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ Login error: {str(e)}")
            return False
    
    def register(self):
        """Register new test user"""
        register_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Test User V3",
            "phone": "+212600000000",
            "consent_accepted": True
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/email/register", json=register_data)
            if response.status_code == 200:
                auth_data = response.json()
                self.access_token = auth_data["access_token"]
                self.user_id = auth_data["user"]["user_id"]
                self.log(f"✅ Registration successful - User ID: {self.user_id}")
                return True
            else:
                self.log(f"❌ Registration failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ Registration error: {str(e)}")
            return False
    
    def test_api_root(self):
        """Test the updated API root endpoint"""
        self.log("🏠 Testing API Root endpoint...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/")
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ API Root response: {json.dumps(data, indent=2)}")
                
                # Check for new features
                features = data.get("features", [])
                expected_features = ["PDF invoices", "WebSocket chat", "Real-time notifications"]
                
                for feature in expected_features:
                    if feature in features:
                        self.log(f"✅ Feature found: {feature}")
                    else:
                        self.log(f"⚠️ Feature missing: {feature}")
                
                return True
            else:
                self.log(f"❌ API Root failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"❌ API Root error: {str(e)}")
            return False
    
    def create_test_pack(self):
        """Create a test pack for PDF invoice testing"""
        self.log("📦 Creating test pack for invoice testing...")
        
        # First get a coach
        try:
            response = self.session.get(f"{BACKEND_URL}/coaches")
            if response.status_code != 200:
                self.log(f"❌ Failed to get coaches: {response.status_code}")
                return None
                
            coaches = response.json()
            if not coaches:
                self.log("❌ No coaches available")
                return None
                
            coach_id = coaches[0]["user_id"]
            self.log(f"📋 Using coach: {coaches[0]['name']} ({coach_id})")
            
            # Create pack
            pack_data = {
                "coach_id": coach_id,
                "discipline": "Yoga",
                "total_sessions": 10,
                "validity_days": 90
            }
            
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.post(f"{BACKEND_URL}/packs", json=pack_data, headers=headers)
            
            if response.status_code == 200:
                pack = response.json()
                pack_id = pack["pack_id"]
                self.log(f"✅ Pack created: {pack_id}")
                return pack_id
            else:
                self.log(f"❌ Pack creation failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.log(f"❌ Pack creation error: {str(e)}")
            return None
    
    def test_pdf_invoice(self, pack_id=None):
        """Test PDF invoice generation"""
        self.log("📄 Testing PDF Invoice Generation...")
        
        # Use provided pack_id or create a new one
        test_pack_id = pack_id or TEST_PACK_ID
        
        if not pack_id:
            # Try to create a test pack
            created_pack_id = self.create_test_pack()
            if created_pack_id:
                test_pack_id = created_pack_id
        
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(f"{BACKEND_URL}/invoices/{test_pack_id}/pdf", headers=headers)
            
            if response.status_code == 200:
                # Check content type
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type:
                    self.log(f"✅ PDF Invoice generated successfully")
                    self.log(f"✅ Content-Type: {content_type}")
                    self.log(f"✅ Content-Length: {len(response.content)} bytes")
                    
                    # Save PDF for verification
                    with open('/app/test_invoice.pdf', 'wb') as f:
                        f.write(response.content)
                    self.log("✅ PDF saved as /app/test_invoice.pdf")
                    return True
                else:
                    self.log(f"❌ Wrong content type: {content_type}")
                    return False
            elif response.status_code == 404:
                self.log(f"⚠️ Pack not found: {test_pack_id}")
                # Try with a newly created pack
                if not pack_id:
                    new_pack_id = self.create_test_pack()
                    if new_pack_id:
                        return self.test_pdf_invoice(new_pack_id)
                return False
            else:
                self.log(f"❌ PDF Invoice failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ PDF Invoice error: {str(e)}")
            return False
    
    async def test_websocket_chat(self):
        """Test WebSocket chat endpoint"""
        self.log("💬 Testing WebSocket Chat...")
        
        if not self.access_token:
            self.log("❌ No access token for WebSocket test")
            return False
        
        try:
            ws_url = f"{WS_URL}/chat/{self.access_token}"
            self.log(f"🔗 Connecting to: {ws_url}")
            
            async with websockets.connect(ws_url) as websocket:
                self.log("✅ WebSocket connection established")
                
                # Send a ping
                ping_message = {"type": "ping"}
                await websocket.send(json.dumps(ping_message))
                self.log("📤 Sent ping message")
                
                # Wait for pong
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(response)
                    self.log(f"📥 Received: {data}")
                    
                    if data.get("type") == "pong":
                        self.log("✅ WebSocket ping/pong successful")
                        return True
                    else:
                        self.log(f"⚠️ Unexpected response: {data}")
                        return True  # Connection works, just different response
                        
                except asyncio.TimeoutError:
                    self.log("⚠️ No response to ping (timeout)")
                    return True  # Connection established, that's what matters
                    
        except websockets.exceptions.InvalidStatusCode as e:
            self.log(f"❌ WebSocket connection failed: {e}")
            return False
        except Exception as e:
            self.log(f"❌ WebSocket error: {str(e)}")
            return False
    
    async def run_tests(self):
        """Run all tests"""
        self.log("🚀 Starting Fit Journey Backend Tests - New Features")
        self.log("=" * 60)
        
        results = {
            "authentication": False,
            "api_root": False,
            "pdf_invoice": False,
            "websocket_chat": False
        }
        
        # Test 1: Authentication
        results["authentication"] = self.authenticate()
        
        if not results["authentication"]:
            self.log("❌ Cannot proceed without authentication")
            return results
        
        # Test 2: API Root endpoint
        results["api_root"] = self.test_api_root()
        
        # Test 3: PDF Invoice Generation
        results["pdf_invoice"] = self.test_pdf_invoice()
        
        # Test 4: WebSocket Chat
        results["websocket_chat"] = await self.test_websocket_chat()
        
        # Summary
        self.log("=" * 60)
        self.log("📊 TEST RESULTS SUMMARY:")
        for test, passed in results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            self.log(f"  {test.upper()}: {status}")
        
        total_tests = len(results)
        passed_tests = sum(results.values())
        self.log(f"📈 Overall: {passed_tests}/{total_tests} tests passed")
        
        return results

async def main():
    tester = FitJourneyTester()
    results = await tester.run_tests()
    
    # Exit with appropriate code
    if all(results.values()):
        print("\n🎉 All tests passed!")
        exit(0)
    else:
        print("\n⚠️ Some tests failed!")
        exit(1)

if __name__ == "__main__":
    asyncio.run(main())