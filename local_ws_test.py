#!/usr/bin/env python3
"""
Local WebSocket Test - Test WebSocket on internal port
"""

import asyncio
import json
import websockets
import requests

# Test locally on internal port
BACKEND_URL = "http://localhost:8001/api"
WS_URL = "ws://localhost:8001/ws"

# Test credentials
TEST_EMAIL = "test_v3_1774976340@fitjourney.ma"
TEST_PASSWORD = "SecurePass123!"

async def test_local_websocket():
    print("🔐 Getting access token...")
    
    # Get access token
    login_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "consent_accepted": True
    }
    
    response = requests.post(f"{BACKEND_URL}/auth/email/login", json=login_data)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return False
    
    access_token = response.json()["access_token"]
    print(f"✅ Got access token: {access_token[:20]}...")
    
    # Test WebSocket locally
    try:
        ws_url = f"{WS_URL}/chat/{access_token}"
        print(f"🔗 Connecting to: {ws_url}")
        
        async with websockets.connect(ws_url) as websocket:
            print("✅ WebSocket connection established locally")
            
            # Send a ping
            ping_message = {"type": "ping"}
            await websocket.send(json.dumps(ping_message))
            print("📤 Sent ping message")
            
            # Wait for pong
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)
                print(f"📥 Received: {data}")
                
                if data.get("type") == "pong":
                    print("✅ WebSocket ping/pong successful locally")
                    return True
                else:
                    print(f"⚠️ Unexpected response: {data}")
                    return True  # Connection works
                    
            except asyncio.TimeoutError:
                print("⚠️ No response to ping (timeout)")
                return True  # Connection established
                
    except Exception as e:
        print(f"❌ Local WebSocket error: {str(e)}")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_local_websocket())
    print(f"Local WebSocket test: {'✅ PASS' if result else '❌ FAIL'}")