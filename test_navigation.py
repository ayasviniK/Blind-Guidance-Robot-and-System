#!/usr/bin/env python3
"""
Quick Navigation Test Script
Tests the improved voice navigation system with detailed instructions
"""

import requests
import time
import json

# Backend URL
BACKEND_URL = "http://localhost:8000"

def test_navigation():
    """Test the improved navigation system"""
    
    print("🧪 Testing Improved Voice Navigation System")
    print("=" * 50)
    
    # Test 1: Start navigation with sample destination
    print("\n1️⃣ Testing Navigation Start...")
    
    # Sample destination (Kandy Temple of the Tooth approximate location)
    destination = {
        "lat": 7.2936,
        "lng": 80.6428
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/navigation/start", 
                               json=destination, 
                               timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Navigation started successfully!")
            print(f"📍 Destination: {result['destination']}")
            print(f"🗺️ Route instructions: {result['route_instructions_count']}")
            print(f"📌 Waypoints: {result['waypoints_count']}")
        else:
            print(f"❌ Navigation start failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server!")
        print("💡 Start server with: cd backend && python main.py")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Test 2: Simulate GPS updates
    print("\n2️⃣ Testing GPS Updates with Navigation Guidance...")
    
    # Sample GPS coordinates moving toward destination
    gps_updates = [
        {"lat": 7.2900, "lng": 80.6400},  # Starting point
        {"lat": 7.2910, "lng": 80.6410},  # Moving closer
        {"lat": 7.2920, "lng": 80.6415},  # Getting closer
        {"lat": 7.2930, "lng": 80.6420},  # Very close
        {"lat": 7.2935, "lng": 80.6425},  # Almost there
    ]
    
    for i, gps_point in enumerate(gps_updates):
        print(f"\n📍 GPS Update {i+1}: {gps_point['lat']:.4f}, {gps_point['lng']:.4f}")
        
        try:
            response = requests.post(f"{BACKEND_URL}/navigation/update-gps", 
                                   json=gps_point, 
                                   timeout=5)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ GPS updated - Navigation active: {result['navigation_active']}")
                
                # Wait a moment to hear the voice guidance
                time.sleep(2)
            else:
                print(f"❌ GPS update failed: {response.status_code}")
                
        except Exception as e:
            print(f"❌ GPS update error: {e}")
        
        # Short pause between updates
        time.sleep(3)
    
    # Test 3: Manual guidance trigger
    print("\n3️⃣ Testing Manual Guidance Trigger...")
    
    try:
        response = requests.post(f"{BACKEND_URL}/navigation/test-guidance", timeout=5)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Manual guidance triggered successfully!")
            print(f"📍 Current location: {result.get('current_location')}")
        else:
            print(f"❌ Manual guidance failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Manual guidance error: {e}")
    
    # Test 4: Check navigation status
    print("\n4️⃣ Testing Navigation Status...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/navigation/status", timeout=5)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Navigation Status:")
            print(f"   Active: {result['navigation_active']}")
            print(f"   Current Location: {result['current_location']}")
            print(f"   Destination: {result['destination']}")
            print(f"   Route Instructions: {result['route_instructions_count']}")
            print(f"   Current Instruction: {result['current_instruction_index']}")
        else:
            print(f"❌ Status check failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Status check error: {e}")
    
    # Test 5: Stop navigation
    print("\n5️⃣ Testing Navigation Stop...")
    
    try:
        response = requests.post(f"{BACKEND_URL}/navigation/stop", timeout=5)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Navigation stopped successfully!")
            print(f"Message: {result['message']}")
        else:
            print(f"❌ Navigation stop failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Navigation stop error: {e}")
    
    print("\n🎉 Navigation test complete!")
    print("\n💡 If you heard detailed voice guidance, the system is working!")
    print("💡 If no voice, check audio settings and backend logs.")
    
    return True

if __name__ == "__main__":
    test_navigation()