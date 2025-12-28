#!/usr/bin/env python3

import requests
import os
import google.generativeai as genai
from dotenv import load_dotenv
import subprocess
import threading
import platform
import time
import math
import json
import sys
import signal
from queue import Queue

# Load environment variables
load_dotenv()

# --- CONFIGURATION ---
# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
GEMINI_MODEL = "gemini-2.0-flash-exp"

# Firebase Configuration
FIREBASE_DATABASE_URL = "https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app"

# Navigation Configuration
LOCATION_UPDATE_THRESHOLD = 0.0001  # ~11 meters in degrees
GUIDANCE_DISTANCE_THRESHOLD = 20  # meters - when to give next instruction
# --- END CONFIGURATION ---

class VoiceNavigator:
    def __init__(self):
        # Initialize Firebase (REST API approach for now)
        self.firebase_url = FIREBASE_DATABASE_URL
        print("✅ Firebase REST API connection configured!")
        
        # Test Firebase connection
        try:
            test_response = requests.get(f"{self.firebase_url}/devices.json", timeout=5)
            if test_response.status_code == 200:
                print("✅ Firebase database connection successful!")
            else:
                print(f"⚠️ Firebase connection issue: {test_response.status_code}")
        except Exception as e:
            print(f"⚠️ Firebase connection warning: {e}")
            print("📱 Will attempt to connect during navigation...")
        
        # Initialize Gemini
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not found!")
        genai.configure(api_key=GEMINI_API_KEY)
        self.gemini = genai.GenerativeModel(GEMINI_MODEL)
        
        # Initialize Google Maps
        self.maps_api_key = GOOGLE_MAPS_API_KEY
        self.maps_base_url = "https://maps.googleapis.com/maps/api"
        
        # Strict audio system - only one message at a time
        self.is_macos = platform.system() == "Darwin"
        self.audio_queue = Queue()
        self.is_speaking = False
        self.currently_speaking = False  # Track if audio worker is actively speaking
        self.audio_worker_running = True
        self.audio_thread = None
        self.last_queue_time = 0  # Track when we last queued a message
        self.start_audio_worker()
        
        # Process management
        self.should_exit = False
        self.frontend_last_seen = time.time()
        self.frontend_timeout = 30  # seconds - if no frontend activity for 30s, shutdown
        self.monitor_thread = None
        self.setup_signal_handlers()
        self.start_frontend_monitor()
        
        # Navigation state
        self.current_location = {"lat": 0.0, "lng": 0.0}
        self.destination = None
        self.route_waypoints = []
        self.current_waypoint_index = 0
        self.is_navigating = False
        self.last_spoken_instruction = ""
        
        print("✅ Enhanced Voice Navigator Ready!")
        self.speak("Advanced voice navigation system for blind navigation is now active. I will provide detailed guidance including landmarks, surface conditions, environmental cues, and safety warnings. I am monitoring your GPS location and ready to guide you safely to your destination.")
    
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown."""
        def signal_handler(signum, frame):
            print(f"\n🛑 Received signal {signum}. Shutting down gracefully...")
            self.should_exit = True
            self.shutdown()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)   # Ctrl+C
        signal.signal(signal.SIGTERM, signal_handler)  # Termination request
    
    def start_frontend_monitor(self):
        """Monitor frontend activity and auto-shutdown if disconnected."""
        def monitor_frontend():
            while not self.should_exit:
                try:
                    # Check for active trip as a sign of frontend activity
                    trip_status = self.monitor_trip_status()
                    
                    if trip_status.get('active', False) or self.is_navigating:
                        # Update last seen time if there's activity
                        self.frontend_last_seen = time.time()
                    else:
                        # Check if frontend has been inactive for too long
                        inactive_time = time.time() - self.frontend_last_seen
                        if inactive_time > self.frontend_timeout:
                            print(f"⏰ No frontend activity for {inactive_time:.0f}s. Auto-shutting down...")
                            self.speak("No frontend connection detected. Navigation system shutting down automatically.")
                            time.sleep(3)  # Give time for speech to complete
                            self.should_exit = True
                            self.shutdown()
                            break
                    
                    time.sleep(10)  # Check every 10 seconds
                    
                except Exception as e:
                    print(f"❌ Frontend monitor error: {e}")
                    time.sleep(10)
        
        self.monitor_thread = threading.Thread(target=monitor_frontend, daemon=True)
        self.monitor_thread.start()
    
    def shutdown(self):
        """Properly shutdown the voice navigation system."""
        print("🛑 Shutting down Voice Navigator...")
        self.is_navigating = False
        self.should_exit = True
        
        # Kill any remaining speech processes
        if self.is_macos:
            try:
                subprocess.run(['killall', 'say'], check=False, capture_output=True)
            except:
                pass
        
        print("✅ Voice Navigator shutdown complete.")
    
    def start_audio_worker(self):
        """Start the audio worker thread to process speech queue sequentially."""
        def audio_worker():
            print("🎵 Audio worker thread started")
            while self.audio_worker_running:
                try:
                    # Wait for a message in the queue (blocking)
                    message = self.audio_queue.get(timeout=1)
                    
                    if message is None:  # Shutdown signal
                        break
                    
                    print(f"🔊 Processing audio: {message[:100]}...")
                    
                    # Kill any existing speech processes
                    if self.is_macos:
                        try:
                            subprocess.run(['killall', 'say'], check=False, capture_output=True)
                            time.sleep(0.1)
                        except:
                            pass
                    
                    self.is_speaking = True
                    self.currently_speaking = True  # Mark as actively speaking
                    
                    try:
                        if self.is_macos:
                            # Speak the message - this blocks until complete
                            subprocess.run(['say', '-r', '180', '-v', 'Alex', message], 
                                         check=True, timeout=60)
                            print(f"✅ Audio completed: {message[:50]}...")
                        else:
                            print(f"🔊 [Non-macOS] Would speak: {message}")
                            time.sleep(len(message) * 0.08)  # Simulate speech time
                        
                    except subprocess.TimeoutExpired:
                        print("⚠️ Audio timeout - killing speech process")
                        subprocess.run(['killall', 'say'], check=False, capture_output=True)
                    except Exception as e:
                        print(f"❌ Audio error: {e}")
                    finally:
                        self.is_speaking = False
                        self.currently_speaking = False  # Mark as not speaking
                        # Update the last speech time when message actually completes
                        self.last_speech_time = time.time()
                        # Mark task as done
                        self.audio_queue.task_done()
                        # Small pause between messages
                        time.sleep(0.3)
                
                except Exception as e:
                    if "Empty" not in str(e):  # Ignore timeout from queue.get()
                        print(f"Audio worker error: {e}")
                    self.is_speaking = False
                    self.currently_speaking = False
                    
            print("🎵 Audio worker thread stopped")
        
        self.audio_thread = threading.Thread(target=audio_worker, daemon=True)
        self.audio_thread.start()
    
    def speak(self, message, priority=False):
        """Queue audio messages to play sequentially without interruption."""
        if not message or message.strip() == "":
            return
        
        # Check if audio worker is running - for startup messages
        if not self.audio_worker_running and priority:
            print(f"⚠️ Audio worker not ready, using direct speech: {message[:50]}...")
            try:
                if self.is_macos:
                    subprocess.run(['say', '-r', '180', '-v', 'Alex', message], 
                                 check=True, timeout=60)
                else:
                    print(f"🔊 [Non-macOS] Would speak: {message}")
                    time.sleep(len(message) * 0.08)
                return
            except Exception as e:
                print(f"❌ Direct speech failed: {e}")
                return
        
        # Simply add message to queue - will play sequentially, no interruption
        try:
            self.audio_queue.put(message, timeout=5)
            queue_size = self.audio_queue.qsize()
            print(f"Audio queued at position {queue_size}: {message[:80]}...")
        except Exception as e:
            print(f"Failed to queue audio: {e}")
    
    def speak_immediate(self, message):
        """Add message to queue (same as speak, no priority handling)."""
        self.speak(message, priority=False)
    
    def get_current_gps_location(self):
        """Get current GPS location from Firebase in real-time."""
        try:
            # Get GPS data from Firebase using REST API
            response = requests.get(f"{self.firebase_url}/devices/esp32A/gps.json", timeout=5)
            
            if response.status_code == 200:
                gps_data = response.json()
                
                if gps_data and 'lat' in gps_data and 'lng' in gps_data:
                    self.current_location = {
                        "lat": float(gps_data['lat']), 
                        "lng": float(gps_data['lng'])
                    }
                    return self.current_location
                else:
                    print("⚠️ No GPS data found in Firebase")
                    return None
            else:
                print(f"❌ Firebase request failed: {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ Error getting GPS location: {e}")
            return None
    
    def monitor_trip_status(self):
        """Monitor Firebase for active trip status."""
        try:
            response = requests.get(f"{self.firebase_url}/devices/esp32A/trip.json", timeout=5)
            
            if response.status_code == 200:
                trip_data = response.json()
                
                if trip_data and trip_data.get('active', False):
                    return {
                        'active': True,
                        'startLat': trip_data.get('startLat'),
                        'startLng': trip_data.get('startLng'),
                        'destLat': trip_data.get('destLat'),
                        'destLng': trip_data.get('destLng'),
                        'startTime': trip_data.get('startTime')
                    }
            return {'active': False}
        except Exception as e:
            print(f"❌ Error monitoring trip status: {e}")
            return {'active': False}
    
    def get_route_waypoints(self):
        """Get route waypoints from Firebase."""
        try:
            response = requests.get(f"{self.firebase_url}/devices/esp32A/waypoints.json", timeout=5)
            
            if response.status_code == 200:
                waypoints_data = response.json()
                
                if waypoints_data:
                    # Convert Firebase data to list of waypoints
                    self.route_waypoints = []
                    for key, waypoint in waypoints_data.items():
                        self.route_waypoints.append({
                            'lat': waypoint.get('lat'),
                            'lng': waypoint.get('lng'),
                            'instruction': waypoint.get('instruction', ''),
                            'distance': waypoint.get('distance', 0)
                        })
                    return self.route_waypoints
            return []
        except Exception as e:
            print(f"❌ Error getting waypoints: {e}")
            return []
    
    def calculate_distance(self, lat1, lng1, lat2, lng2):
        """Calculate distance between two GPS coordinates in meters."""
        # Haversine formula
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat/2) * math.sin(delta_lat/2) + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(delta_lng/2) * math.sin(delta_lng/2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def get_bearing(self, lat1, lng1, lat2, lng2):
        """Calculate bearing (direction) from point 1 to point 2."""
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lng = math.radians(lng2 - lng1)
        
        y = math.sin(delta_lng) * math.cos(lat2_rad)
        x = (math.cos(lat1_rad) * math.sin(lat2_rad) - 
             math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(delta_lng))
        
        bearing = math.atan2(y, x)
        return (math.degrees(bearing) + 360) % 360
    
    def bearing_to_direction(self, bearing):
        """Convert bearing to human-readable direction."""
        directions = [
            "North", "North-East", "East", "South-East",
            "South", "South-West", "West", "North-West"
        ]
        idx = round(bearing / 45) % 8
        return directions[idx]
    
    def get_coordinates_for_place(self, place_name):
        """Convert a place name (like 'Temple of the Tooth') into coordinates."""
        if not self.maps_api_key or self.maps_api_key == "your_google_maps_api_key_here":
            self.speak("I can't look up locations. The Google Maps API key is missing.")
            return None
        
        try:
            geocode_url = f"{self.maps_base_url}/geocode/json"
            params = {
                'address': place_name,
                'key': self.maps_api_key
            }
            
            response = requests.get(geocode_url, params=params)
            data = response.json()
            
            if data['status'] == 'OK' and data['results']:
                location = data['results'][0]['geometry']['location']
                return {"lat": location['lat'], "lng": location['lng']}
            
            self.speak(f"Sorry, I couldn't find the location for {place_name}.")
            return None
            
        except Exception as e:
            self.speak(f"There was an error looking up the location. {e}")
            return None

    def get_nearby_landmarks(self, location, radius=50):
        """Get nearby landmarks and points of interest for spatial reference."""
        if not self.maps_api_key:
            return []
        
        try:
            places_url = f"{self.maps_base_url}/place/nearbysearch/json"
            params = {
                'location': f"{location['lat']},{location['lng']}",
                'radius': radius,
                'key': self.maps_api_key,
                'type': 'establishment'
            }
            
            response = requests.get(places_url, params=params)
            data = response.json()
            
            landmarks = []
            if data['status'] == 'OK':
                for place in data.get('results', [])[:5]:  # Top 5 closest landmarks
                    landmarks.append({
                        'name': place.get('name', ''),
                        'type': place.get('types', []),
                        'rating': place.get('rating', 0),
                        'distance': self.calculate_distance(
                            location['lat'], location['lng'],
                            place['geometry']['location']['lat'],
                            place['geometry']['location']['lng']
                        )
                    })
            
            return sorted(landmarks, key=lambda x: x['distance'])
            
        except Exception as e:
            print(f"❌ Error getting landmarks: {e}")
            return []
    
    def analyze_surface_and_environment(self, location):
        """Analyze surface conditions and environmental factors for blind navigation."""
        # This would ideally connect to additional APIs or sensors
        # For now, we'll use Gemini AI to provide contextual surface information
        
        prompt = f"""
Analyze the likely surface conditions and environmental features for a blind person walking in Kandy, Sri Lanka at coordinates {location['lat']:.6f}, {location['lng']:.6f}.

Based on typical urban infrastructure in Kandy, provide information about:

1. SURFACE CONDITIONS:
   - Sidewalk material (concrete, asphalt, brick, uneven stones)
   - Road surface quality (smooth, rough, potholed)
   - Presence of tactile paving or textured surfaces
   - Level changes (curbs, steps, slopes)

2. ENVIRONMENTAL HAZARDS:
   - Traffic density and road crossing safety
   - Construction areas or temporary obstacles
   - Street vendors or temporary stalls
   - Monsoon weather considerations (puddles, slippery surfaces)

3. NAVIGATION AIDS:
   - Handrails or guide surfaces
   - Distinctive building textures or materials
   - Sound landmarks (busy shops, traffic patterns)
   - Tactile reference points

Provide a brief, practical assessment focusing on what matters for safe blind navigation.
"""
        
        try:
            response = self.gemini.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"❌ Error analyzing environment: {e}")
            return "Continue with caution. Use your cane to detect surface changes and obstacles."

    def start_live_navigation(self):
        """Start live navigation using Firebase trip data."""
        self.speak("Starting live navigation system. Checking for active trip...")
        
        # Check for active trip
        trip_status = self.monitor_trip_status()
        
        if not trip_status['active']:
            self.speak("No active trip found. Please start a trip from the web interface first.")
            return False
        
        # Get route waypoints
        waypoints = self.get_route_waypoints()
        
        if not waypoints:
            self.speak("No route waypoints found. Please ensure the route is properly loaded.")
            return False
        
        # Get current location
        current_location = self.get_current_gps_location()
        
        if not current_location:
            self.speak("Cannot get your current GPS location. Please ensure GPS is working.")
            return False
        
        self.is_navigating = True
        self.current_waypoint_index = 0
        
        destination_lat = trip_status['destLat']
        destination_lng = trip_status['destLng']
        
        # Combine multiple messages into one to avoid overlap
        startup_message = f"Enhanced live navigation started! I can see you are currently at latitude {current_location['lat']:.4f}, longitude {current_location['lng']:.4f}. Your destination is {len(waypoints)} steps away. I will provide detailed guidance including landmarks, surface conditions, and safety warnings at each turn. Let me know if you need me to repeat any instructions."
        self.speak(startup_message)
        
        # Start the navigation monitoring loop
        self.navigate_to_destination()
        return True
    
    def navigate_to_destination(self):
        """Main navigation loop - provides real-time guidance."""
        self.speak("Starting real-time navigation. I am now monitoring your movement.")
        
        # Announce initial status
        print(f"🗺️ Total waypoints: {len(self.route_waypoints)}")
        if self.route_waypoints:
            print(f"🎯 First waypoint: {self.route_waypoints[0]}")
            # Announce waypoint count to user
            self.speak(f"I have loaded {len(self.route_waypoints)} navigation waypoints for your journey.", priority=True)
        else:
            print("❌ No waypoints available!")
            self.speak("Warning: No navigation waypoints are available. Please check the route setup.", priority=True)
            return
        
        location_update_counter = 0
        
        while self.is_navigating and not self.should_exit:
            try:
                # Get current location
                current_location = self.get_current_gps_location()
                
                if not current_location:
                    print("⚠️ No GPS location available, waiting...")
                    time.sleep(2)
                    continue
                
                print(f"🌍 GPS Location received: {current_location}")
                
                # Check if we still have waypoints to navigate to
                if self.current_waypoint_index >= len(self.route_waypoints):
                    self.speak("Congratulations! You have reached your destination. Navigation complete.")
                    self.is_navigating = False
                    break
                
                # Get current waypoint
                current_waypoint = self.route_waypoints[self.current_waypoint_index]
                
                # Calculate distance to current waypoint
                distance_to_waypoint = self.calculate_distance(
                    current_location['lat'], current_location['lng'],
                    current_waypoint['lat'], current_waypoint['lng']
                )
                
                print(f"📍 Current: {current_location['lat']:.6f}, {current_location['lng']:.6f}")
                print(f"🎯 Waypoint {self.current_waypoint_index + 1}: {distance_to_waypoint:.1f}m away")
                
                # Provide location updates much less frequently to prevent overlap (every 25 loops = about 125 seconds)
                location_update_counter += 1
                if location_update_counter % 25 == 0 and self.audio_queue.qsize() < 2 and distance_to_waypoint > 30:
                    location_status = f"Navigation status: You are {distance_to_waypoint:.0f} meters from waypoint {self.current_waypoint_index + 1}."
                    self.speak(location_status)
                    print(f"📢 Regular location update provided")
                
                # If we're close to the waypoint, move to next one
                if distance_to_waypoint < GUIDANCE_DISTANCE_THRESHOLD:
                    self.current_waypoint_index += 1
                    
                    if self.current_waypoint_index < len(self.route_waypoints):
                        # Give comprehensive instruction for next waypoint
                        next_waypoint = self.route_waypoints[self.current_waypoint_index]
                        instruction = next_waypoint.get('instruction', '')
                        
                        print(f"🔍 Waypoint instruction check: '{instruction}'")
                        print(f"🔍 Last spoken: '{self.last_spoken_instruction}'")
                        
                        # Provide guidance for ANY waypoint approach, with or without specific instructions
                        print(f"🎯 Processing waypoint {self.current_waypoint_index + 1} guidance...")
                        
                        # Calculate direction to next waypoint
                        bearing = self.get_bearing(
                            current_location['lat'], current_location['lng'],
                            next_waypoint['lat'], next_waypoint['lng']
                        )
                        direction = self.bearing_to_direction(bearing)
                        
                        print(f"🧭 Calculated direction: {direction} (bearing: {bearing:.1f}°)")
                        
                        # Only provide waypoint guidance if queue is not full and enough time has passed
                        if self.audio_queue.qsize() < 3 and (time.time() - self.last_speech_time) >= 8:
                            
                            try:
                                print(f"🤖 Generating navigation guidance...")
                                
                                # Always provide at least basic directional guidance
                                distance_m = int(distance_to_waypoint)
                                basic_guidance = f"Head {direction} for approximately {distance_m} meters to reach your next navigation point."
                                
                                # Try to enhance with AI if available
                                try:
                                    enhanced_guidance = self.get_contextual_guidance(current_location, next_waypoint)
                                    if enhanced_guidance and len(enhanced_guidance) > 20:
                                        final_guidance = enhanced_guidance
                                    else:
                                        final_guidance = basic_guidance
                                except:
                                    final_guidance = basic_guidance
                                
                                # Add landmark information if available
                                try:
                                    landmarks = self.get_nearby_landmarks(current_location)
                                    if landmarks and len(landmarks) > 0:
                                        closest = landmarks[0]
                                        if closest['distance'] < 30:
                                            final_guidance += f" You are near {closest['name']}."
                                except:
                                    pass
                                
                                print(f"📝 Final guidance: {final_guidance}")
                                
                                # Speak the guidance (will block until complete)
                                self.speak(final_guidance, priority=True)
                                self.last_spoken_instruction = instruction if instruction else f"waypoint_{self.current_waypoint_index}"
                                print(f"✅ Waypoint navigation instruction completed")
                                
                            except Exception as e:
                                print(f"❌ Error in waypoint guidance: {e}")
                                # Absolute fallback
                                distance_m = int(distance_to_waypoint)
                                emergency_message = f"Navigate {direction} for {distance_m} meters."
                                self.speak(emergency_message, priority=True)
                                self.last_spoken_instruction = f"emergency_waypoint_{self.current_waypoint_index}"
                    else:
                        # Final destination announcement
                        self.speak("You are approaching your final destination! Listen for familiar sounds and use your cane to locate the entrance.", priority=True)
                
                # Enhanced off-route detection with environmental guidance
                elif distance_to_waypoint > 30:  # More sensitive - 30m instead of 50m
                    # Only announce off-route if queue is not full
                    if self.audio_queue.qsize() < 2:
                        print(f"🚨 OFF-ROUTE DETECTED: {distance_to_waypoint:.1f}m from waypoint")
                        
                        bearing = self.get_bearing(
                            current_location['lat'], current_location['lng'],
                            current_waypoint['lat'], current_waypoint['lng']
                        )
                        direction = self.bearing_to_direction(bearing)
                        
                        print(f"🧭 Direction to waypoint: {direction}")
                        
                        # Get landmarks for reorientation
                        landmarks = self.get_nearby_landmarks(current_location)
                        landmark_info = ""
                        if landmarks and len(landmarks) > 0:
                            landmark_info = f" You are currently near {landmarks[0]['name']}."
                            print(f"🏢 Nearby landmark: {landmarks[0]['name']}")
                        
                        # Comprehensive reorientation message
                        reorientation_guidance = f"You appear to be off the planned route.{landmark_info} Head {direction} to get back on track, approximately {distance_to_waypoint:.0f} meters away. Listen for environmental cues and use your cane to navigate safely."
                        
                        print(f"📢 Off-route message: {reorientation_guidance}")
                        self.speak(reorientation_guidance)
                    else:
                        print(f"⏸️ Off-route detected but speech in progress")
                
                # Provide intermediate guidance very infrequently (every 50 loops = about 250 seconds)
                elif location_update_counter % 50 == 0 and distance_to_waypoint > 50 and self.audio_queue.qsize() < 2 and (time.time() - self.last_speech_time) >= 15:
                    bearing = self.get_bearing(
                        current_location['lat'], current_location['lng'],
                        current_waypoint['lat'], current_waypoint['lng']
                    )
                    direction = self.bearing_to_direction(bearing)
                    
                    intermediate_guidance = f"Continue {direction} for {distance_to_waypoint:.0f} meters to reach your navigation point."
                    self.speak(intermediate_guidance)
                    print(f"🧭 Intermediate guidance provided")
                
                # Much longer sleep to significantly reduce frequency of checks and prevent speech overlap
                time.sleep(8)
                
            except KeyboardInterrupt:
                self.speak("Navigation stopped by user.")
                self.is_navigating = False
                self.should_exit = True
                break
            except Exception as e:
                print(f"❌ Navigation error: {e}")
                time.sleep(2)
                
                # Check if we should exit due to repeated errors
                if self.should_exit:
                    break
    
    def get_contextual_guidance(self, current_location, waypoint):
        """Generate enhanced contextual guidance with environmental awareness for blind navigation."""
        prompt = f"""
You are providing detailed navigation guidance to a blind person in Kandy, Sri Lanka. 
This person relies on environmental cues, landmarks, and surface information for safe navigation.

Current Location: {current_location['lat']:.6f}, {current_location['lng']:.6f}
Next Waypoint: {waypoint['lat']:.6f}, {waypoint['lng']:.6f}
Route Instruction: {waypoint.get('instruction', 'Continue forward')}

Provide comprehensive guidance that includes:

1. IMMEDIATE NAVIGATION ACTION (turn left, continue straight, etc.)
2. LANDMARKS & REFERENCE POINTS (shops, buildings, distinctive sounds)
3. SURFACE CONDITIONS (paved road, gravel path, concrete sidewalk, uneven ground)
4. SAFETY WARNINGS (traffic, construction, obstacles, curbs, stairs)
5. SPATIAL ORIENTATION (distance estimates, direction confirmations)
6. ENVIRONMENTAL CUES (sounds, textures, tactile markers)

Focus on what a blind person can:
- HEAR (traffic sounds, construction noise, shop sounds, footsteps)
- FEEL (pavement texture, curb edges, handrails, tactile paving)
- DETECT (obstacles, level changes, surface materials)

Example good guidance:
"Turn left at the next intersection. You'll hear traffic from your right as you turn. The sidewalk has tactile paving strips that will guide you. Listen for the pharmacy on your left - you'll hear the air conditioning unit. The surface is smooth concrete. Watch for a small step down at the curb in 20 meters."

Provide 2-3 sentences with practical, actionable information for safe blind navigation.
Do not include coordinates or technical details.
"""
        
        try:
            print(f"🤖 Calling Gemini AI for contextual guidance...")
            response = self.gemini.generate_content(prompt)
            
            if response and response.text:
                ai_guidance = response.text.strip()
                print(f"✅ AI Response received: {ai_guidance[:100]}...")
                return ai_guidance
            else:
                print("⚠️ Empty response from AI")
                return f"Navigate: {waypoint.get('instruction', 'Continue forward')}. Listen for environmental cues and use your cane for guidance."
                
        except Exception as e:
            print(f"❌ Error generating AI guidance: {e}")
            # Provide detailed fallback guidance
            basic_instruction = waypoint.get('instruction', 'Continue forward')
            enhanced_fallback = f"{basic_instruction}. Pay attention to surface texture changes, traffic sounds, and nearby establishments. Use your cane to detect obstacles and curbs."
            return enhanced_fallback

    def listen_for_command(self):
        """Listen for voice commands or check Firebase for trip status."""
        try:
            print("\n" + "="*50)
            print("🎤 Voice Navigation Options:")
            print("1. Type 'start navigation' - Begin live GPS navigation")
            print("2. Type 'check trip' - Check Firebase trip status")  
            print("3. Type 'location' - Get current GPS location and direction")
            print("4. Type 'test direction' - Test direction calculation to waypoint")
            print("5. Type 'exit' - Exit the system")
            print("="*50)
            
            command = input("Enter command: ")
            return command.lower().strip()
        except (KeyboardInterrupt, EOFError):
            return "exit"

    def start(self):
        """Main loop for Firebase-integrated navigation."""
        print("🚀 Starting Voice Navigator...")
        
        # Test audio immediately
        print("🔊 Testing audio system...")
        if self.is_macos:
            try:
                subprocess.run(['say', 'Audio test'], check=True, timeout=5)
                print("✅ Audio test successful")
            except Exception as e:
                print(f"❌ Audio test failed: {e}")
        
        self.start_audio_worker()
        # Give audio worker a moment to start
        time.sleep(1.0)
        print("🔊 Playing startup message...")
        self.speak("Voice navigation system is ready. I can provide live turn by turn directions using your GPS location.", priority=True)
        print("✅ Startup message queued/played")
        
        while not self.should_exit:
            try:
                command = self.listen_for_command()
                
                if not command or self.should_exit:
                    continue

                if "exit" in command or "quit" in command:
                    self.speak("Navigation system shutting down. Goodbye!")
                    # Wait for final message to complete
                    time.sleep(2)
                    self.shutdown()
                    break
                
                elif "start navigation" in command or "navigate" in command:
                    # Update frontend activity timestamp
                    self.frontend_last_seen = time.time()
                    self.start_live_navigation()
                
                elif "check trip" in command:
                    # Update frontend activity timestamp
                    self.frontend_last_seen = time.time()
                    trip_status = self.monitor_trip_status()
                    if trip_status['active']:
                        self.speak("There is an active trip. You can start navigation now.")
                        print(f"📍 Trip Details:")
                        print(f"   Start: {trip_status['startLat']:.4f}, {trip_status['startLng']:.4f}")
                        print(f"   Destination: {trip_status['destLat']:.4f}, {trip_status['destLng']:.4f}")
                    else:
                        self.speak("No active trip found. Please start a trip from the web interface first.")
                
                elif "location" in command:
                    # Update frontend activity timestamp
                    self.frontend_last_seen = time.time()
                    current_location = self.get_current_gps_location()
                    if current_location:
                        location_message = f"Your current location is latitude {current_location['lat']:.4f}, longitude {current_location['lng']:.4f}."
                        
                        # If we have waypoints, also provide direction guidance
                        if self.route_waypoints and self.current_waypoint_index < len(self.route_waypoints):
                            current_waypoint = self.route_waypoints[self.current_waypoint_index]
                            distance = self.calculate_distance(
                                current_location['lat'], current_location['lng'],
                                current_waypoint['lat'], current_waypoint['lng']
                            )
                            bearing = self.get_bearing(
                                current_location['lat'], current_location['lng'],
                                current_waypoint['lat'], current_waypoint['lng']
                            )
                            direction = self.bearing_to_direction(bearing)
                            
                            location_message += f" Your next waypoint is {distance:.0f} meters to the {direction}."
                        
                        self.speak(location_message)
                        print(f"📍 GPS: {current_location['lat']:.6f}, {current_location['lng']:.6f}")
                    else:
                        self.speak("Cannot get your current GPS location. Please check if the device is sending GPS data to Firebase.")
                
                elif "test direction" in command:
                    # Test direction calculation
                    current_location = self.get_current_gps_location()
                    if current_location and self.route_waypoints and self.current_waypoint_index < len(self.route_waypoints):
                        current_waypoint = self.route_waypoints[self.current_waypoint_index]
                        bearing = self.get_bearing(
                            current_location['lat'], current_location['lng'],
                            current_waypoint['lat'], current_waypoint['lng']
                        )
                        direction = self.bearing_to_direction(bearing)
                        distance = self.calculate_distance(
                            current_location['lat'], current_location['lng'],
                            current_waypoint['lat'], current_waypoint['lng']
                        )
                        
                        test_message = f"Direction test: Head {direction} for {distance:.0f} meters to reach your waypoint."
                        self.speak(test_message)
                        print(f"🧪 Direction test: {direction}, Distance: {distance:.1f}m, Bearing: {bearing:.1f}°")
                    else:
                        self.speak("Cannot test direction - no GPS location or waypoints available.")
                
                else:
                    self.speak("I didn't understand that command. Please try 'start navigation', 'check trip', 'location', or 'exit'.")
                    
            except KeyboardInterrupt:
                print("\n🛑 Keyboard interrupt received. Shutting down...")
                self.should_exit = True
                self.shutdown()
                break
            except Exception as e:
                print(f"❌ Main loop error: {e}")
                if self.should_exit:
                    break
    
    def shutdown(self):
        """Gracefully shutdown the navigation system."""
        print("🔄 Shutting down navigation system...")
        
        # Stop audio worker
        if self.audio_worker_running:
            self.audio_worker_running = False
            try:
                self.audio_queue.put(None)  # Signal shutdown
                if hasattr(self, 'audio_thread') and self.audio_thread:
                    self.audio_thread.join(timeout=2)
            except:
                pass
        
        # Stop frontend monitor
        if hasattr(self, 'frontend_thread') and self.frontend_thread:
            self.frontend_thread.join(timeout=1)
        
        print("✅ Navigation system shutdown complete")

if __name__ == "__main__":
    navigator = None
    try:
        navigator = VoiceNavigator()
        navigator.start()
    except KeyboardInterrupt:
        print("\n🛑 Keyboard interrupt received.")
    except Exception as e:
        print(f"❌ Fatal error: {e}")
    finally:
        if navigator:
            navigator.shutdown()
        print("👋 Navigation system terminated.")
