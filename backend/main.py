"""
FastAPI Backend for Guiding Robot
Proxies MJPEG stream from ESP32-CAM and handles CORS
Integrates with vision_assistant module for Gemini AI analysis
"""

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import requests
import logging
from dotenv import load_dotenv
import os
import time

# Import our vision assistant module
from vision_assistant import (
    ESP32_CAPTURE_URL,
    ESP32_IP,
    capture_frame_bytes,
    capture_frame_from_esp32,
    GeminiVision,
    GEMINI_MODEL
)
import cv2
import numpy as np
import requests
import threading
import time
import subprocess
import platform
from queue import Queue
import google.generativeai as genai
import json

# Set ESP32 stream URL for backward compatibility
ESP32_STREAM_URL = f"http://{ESP32_IP}:81/stream"

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Guiding Robot Backend", version="1.0.0")

# CORS configuration - allow React app to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:5174", 
        "http://localhost:3000",
        "https://guiding-robot-webapp-m1v6v4xij-saduka-athukoralas-projects.vercel.app",
        "https://guiding-robot-webapp.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini Configuration
GEMINI_API_KEY = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")

# Initialize Gemini if API key is available
vision_model = None
if GEMINI_API_KEY:
    try:
        vision_model = GeminiVision(GEMINI_API_KEY, GEMINI_MODEL)
        logger.info(f"✅ Gemini vision model loaded!")
    except Exception as e:
        logger.warning(f"⚠️ Gemini initialization failed: {e}")
else:
    logger.warning("⚠️ GEMINI_API_KEY not found - vision analysis disabled")

# ======================
# NAVIGATION SYSTEM
# ======================

class AudioSystem:
    def __init__(self, enabled=True):
        self.enabled = enabled
        self.is_macos = platform.system() == "Darwin"
        self.audio_queue = Queue()
        self.audio_worker_running = True
        self.currently_speaking = False
        
        # Start audio worker thread
        self.audio_thread = threading.Thread(target=self._audio_worker, daemon=True)
        self.audio_thread.start()
        logger.info("🔊 Audio System Ready with Queue!")

    def _audio_worker(self):
        """Worker thread that processes audio queue sequentially."""
        logger.info("🎵 Audio worker thread started")
        while self.audio_worker_running:
            try:
                # Wait for a message in the queue
                message = self.audio_queue.get(timeout=1)
                
                if message is None:  # Shutdown signal
                    break
                
                logger.info(f"� Speaking: '{message}'")
                self.currently_speaking = True
                
                try:
                    if self.is_macos:
                        # Speak the message - blocks until complete
                        subprocess.run(['say', '-r', '200', '-v', 'Alex', message], 
                                     check=True, timeout=60)
                        logger.info(f"✅ Audio completed: {message[:50]}...")
                    else:
                        logger.info(f"🔊 [Non-macOS] Would speak: {message}")
                        time.sleep(len(message) * 0.08)
                    
                except subprocess.TimeoutExpired:
                    logger.warning("⚠️ Audio timeout")
                except Exception as e:
                    logger.error(f"⚠️ Audio error: {e}")
                finally:
                    self.currently_speaking = False
                    self.audio_queue.task_done()
                    # Small pause between messages
                    time.sleep(0.3)
                    
            except:
                # Queue timeout (empty) - just continue waiting
                pass
                
        logger.info("Audio worker thread stopped")

    def speak(self, message):
        """Add message to audio queue for sequential playback."""
        if not self.enabled or not message:
            return
        
        try:
            self.audio_queue.put(message, timeout=5)
            queue_size = self.audio_queue.qsize()
            logger.info(f"✅ Audio queued at position {queue_size}: {message[:80]}...")
        except Exception as e:
            logger.error(f"❌ Failed to queue audio: {e}")
    
    def clear_queue(self):
        """Clear all pending audio messages from the queue."""
        try:
            while not self.audio_queue.empty():
                try:
                    self.audio_queue.get_nowait()
                    self.audio_queue.task_done()
                except:
                    break
            logger.info("🔇 Audio queue cleared")
        except Exception as e:
            logger.error(f"❌ Failed to clear audio queue: {e}")
    
    def shutdown(self):
        """Shutdown the audio system gracefully."""
        self.audio_worker_running = False
        try:
            self.audio_queue.put(None)  # Signal shutdown
            self.audio_thread.join(timeout=2)
        except:
            pass

class VoiceNavigator:
    def __init__(self, api_key):
        self.audio_system = AudioSystem(enabled=True)
        self.gemini_api_key = api_key
        self.current_gps = None
        self.destination = None
        self.route_instructions = []
        self.current_instruction_index = 0
        self.navigation_active = False
        self.last_announcement_time = 0
        self.last_spoken_instruction = ""
        self.waypoints = []
        self.current_waypoint_index = 0
        
        # Navigation thresholds (matching original)
        self.GUIDANCE_DISTANCE_THRESHOLD = 20  # meters - when to give next instruction
        self.OFF_ROUTE_THRESHOLD = 50  # meters - when user is off route
        
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel("gemini-1.5-flash")
            logger.info("✅ Voice Navigator initialized!")
        else:
            logger.error("❌ No Gemini API key provided for Voice Navigator")

    def set_current_location(self, lat, lng):
        """Update current GPS location from Firebase"""
        self.current_gps = {"lat": lat, "lng": lng}
        logger.info(f"📍 GPS updated: {lat:.6f}, {lng:.6f}")

    def set_destination(self, lat, lng, route_instructions=None):
        """Set navigation destination and route with detailed waypoint instructions"""
        self.destination = {"lat": lat, "lng": lng}
        self.route_instructions = route_instructions or []
        self.current_instruction_index = 0
        self.current_waypoint_index = 0
        self.navigation_active = True
        self.last_spoken_instruction = ""
        
        # Convert route instructions to waypoints if provided
        if self.route_instructions:
            self.waypoints = []
            for i, instruction in enumerate(self.route_instructions):
                # Create waypoint for each instruction
                # For simplicity, we'll distribute waypoints evenly toward destination
                # In a real app, these would come from Google Directions API
                progress = (i + 1) / len(self.route_instructions)
                waypoint_lat = self.current_gps["lat"] + (lat - self.current_gps["lat"]) * progress if self.current_gps else lat
                waypoint_lng = self.current_gps["lng"] + (lng - self.current_gps["lng"]) * progress if self.current_gps else lng
                
                self.waypoints.append({
                    "lat": waypoint_lat,
                    "lng": waypoint_lng,
                    "instruction": instruction,
                    "index": i
                })
        else:
            # Create a single waypoint at destination
            self.waypoints = [{"lat": lat, "lng": lng, "instruction": "Arrive at destination", "index": 0}]
        
        message = f"Navigation started to destination at {lat:.4f}, {lng:.4f}"
        if self.route_instructions:
            message += f" with {len(self.route_instructions)} route instructions"
        
        logger.info(f"🧭 {message}")
        
        # Get readable location names
        destination_name = self.get_location_name(lat, lng)
        
        # Detailed initial message like original home_navigator
        if self.current_gps:
            current_location_name = self.get_location_name(self.current_gps['lat'], self.current_gps['lng'])
            initial_message = f"Live navigation started! I can see you are currently at {current_location_name}. "
        else:
            initial_message = "Live navigation started! "
        
        initial_message += f"Your destination is {destination_name}. "
        
        if self.route_instructions:
            initial_message += f"The journey has {len(self.route_instructions)} steps. I will guide you turn by turn. Please start walking and I will provide detailed directions."
        else:
            initial_message += "I will guide you directly to your destination. Please start walking and I will provide turn-by-turn directions based on your GPS location."
        
        self.audio_system.speak(initial_message)

    def calculate_distance(self, lat1, lng1, lat2, lng2):
        """Calculate distance between two GPS points in meters"""
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = radians(lat1)
        lat2_rad = radians(lat2)
        delta_lat = radians(lat2 - lat1)
        delta_lng = radians(lng2 - lng1)
        
        a = sin(delta_lat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = R * c
        
        return distance

    def calculate_bearing(self, lat1, lng1, lat2, lng2):
        """Calculate bearing from point 1 to point 2 in degrees"""
        from math import radians, degrees, sin, cos, atan2
        
        lat1_rad = radians(lat1)
        lat2_rad = radians(lat2)
        delta_lng = radians(lng2 - lng1)
        
        y = sin(delta_lng) * cos(lat2_rad)
        x = cos(lat1_rad) * sin(lat2_rad) - sin(lat1_rad) * cos(lat2_rad) * cos(delta_lng)
        
        bearing = atan2(y, x)
        bearing = degrees(bearing)
        bearing = (bearing + 360) % 360  # Convert to 0-360 degrees
        
        return bearing

    def bearing_to_direction(self, bearing):
        """Convert bearing to human-readable direction"""
        directions = [
            "north", "north-northeast", "northeast", "east-northeast",
            "east", "east-southeast", "southeast", "south-southeast",
            "south", "south-southwest", "southwest", "west-southwest",
            "west", "west-northwest", "northwest", "north-northwest"
        ]
        
        index = round(bearing / 22.5) % 16
        return directions[index]

    def get_location_name(self, lat, lng):
        """Convert GPS coordinates to readable location name using reverse geocoding"""
        try:
            # Try multiple free geocoding services
            
            # 1. Try Nominatim (OpenStreetMap) - Free and reliable
            nominatim_url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=18&addressdetails=1"
            headers = {'User-Agent': 'GuidingRobotApp/1.0'}
            
            response = requests.get(nominatim_url, headers=headers, timeout=3)
            if response.status_code == 200:
                data = response.json()
                
                # Extract meaningful location components
                address = data.get('address', {})
                
                # Try to build a natural location description
                location_parts = []
                
                # Add house number and road
                house_number = address.get('house_number', '')
                road = address.get('road', '')
                if house_number and road:
                    location_parts.append(f"{house_number} {road}")
                elif road:
                    location_parts.append(road)
                
                # Add neighborhood or suburb
                neighborhood = (address.get('neighbourhood') or 
                              address.get('suburb') or 
                              address.get('quarter') or
                              address.get('district'))
                if neighborhood:
                    location_parts.append(neighborhood)
                
                # Add city
                city = (address.get('city') or 
                       address.get('town') or 
                       address.get('village'))
                if city:
                    location_parts.append(city)
                
                if location_parts:
                    location_name = ", ".join(location_parts[:2])  # Take first 2 most relevant parts
                    logger.info(f"📍 Location: {lat:.6f}, {lng:.6f} → {location_name}")
                    return location_name
                
                # Fallback to display name
                display_name = data.get('display_name', '')
                if display_name:
                    # Take first part of display name (usually most relevant)
                    parts = display_name.split(',')
                    return parts[0].strip() if parts else "Unknown location"
        
        except Exception as e:
            logger.warning(f"⚠️ Geocoding error: {e}")
        
        # Fallback to coordinates if geocoding fails
        return f"location at {lat:.4f}, {lng:.4f}"

    def provide_navigation_guidance(self):
        """
        Provide detailed waypoint-based navigation guidance like original home_navigator
        Uses turn-by-turn instructions and monitors progress through waypoints
        """
        if not self.navigation_active or not self.current_gps or not self.waypoints:
            return
        
        current_time = time.time()
        
        # Check if we've completed all waypoints
        if self.current_waypoint_index >= len(self.waypoints):
            # Clear any queued audio first
            self.audio_system.clear_queue()
            
            self.audio_system.speak("Congratulations! You have reached your destination. Navigation complete.")
            self.navigation_active = False
            self.waypoints = []  # Clear waypoints
            self.current_waypoint_index = 0  # Reset index
            self.destination = None  # Clear destination
            self.route_instructions = []  # Clear route instructions
            return
        
        # Get current waypoint
        current_waypoint = self.waypoints[self.current_waypoint_index]
        
        # Calculate distance to current waypoint
        distance_to_waypoint = self.calculate_distance(
            self.current_gps["lat"], self.current_gps["lng"],
            current_waypoint["lat"], current_waypoint["lng"]
        )
        
        logger.info(f"📍 Current: {self.current_gps['lat']:.6f}, {self.current_gps['lng']:.6f}")
        logger.info(f"🎯 Waypoint {self.current_waypoint_index + 1}: {distance_to_waypoint:.1f}m away")
        
        # If we're close to the waypoint, move to next one
        if distance_to_waypoint < self.GUIDANCE_DISTANCE_THRESHOLD:
            self.current_waypoint_index += 1
            
            if self.current_waypoint_index < len(self.waypoints):
                # Give instruction for next waypoint
                next_waypoint = self.waypoints[self.current_waypoint_index]
                instruction = next_waypoint.get('instruction', 'Continue forward')
                
                if instruction and instruction != self.last_spoken_instruction:
                    # Clean up HTML tags from instruction (like original)
                    clean_instruction = instruction.replace('<b>', '').replace('</b>', '').replace('<div>', ' ').replace('</div>', ' ')
                    
                    # Calculate bearing for direction
                    bearing = self.calculate_bearing(
                        self.current_gps["lat"], self.current_gps["lng"],
                        next_waypoint["lat"], next_waypoint["lng"]
                    )
                    direction = self.bearing_to_direction(bearing)
                    
                    guidance = f"Next instruction: {clean_instruction}. Head {direction}."
                    self.audio_system.speak(guidance)
                    self.last_spoken_instruction = instruction
                    self.last_announcement_time = current_time
                    logger.info(f"🧭 Waypoint guidance: {guidance}")
            else:
                self.audio_system.speak("You are approaching your final destination!")
                self.last_announcement_time = current_time
        
        # Check if user is going off route (more than threshold from waypoint)
        elif distance_to_waypoint > self.OFF_ROUTE_THRESHOLD:
            # Only announce off-route warning every 10 seconds
            if current_time - self.last_announcement_time > 10:
                bearing = self.calculate_bearing(
                    self.current_gps["lat"], self.current_gps["lng"],
                    current_waypoint["lat"], current_waypoint["lng"]
                )
                direction = self.bearing_to_direction(bearing)
                
                try:
                    current_location = self.get_location_name(self.current_gps["lat"], self.current_gps["lng"])
                    off_route_msg = f"You may be off route at {current_location}. Head {direction} to get back on track. The waypoint is {distance_to_waypoint:.0f} meters away."
                except:
                    off_route_msg = f"You may be off route. Head {direction} to get back on track. The waypoint is {distance_to_waypoint:.0f} meters away."
                self.audio_system.speak(off_route_msg)
                self.last_announcement_time = current_time
                logger.info(f"⚠️ Off-route warning: {off_route_msg}")
        
        # Provide regular progress updates when on route
        else:
            # Dynamic announcement frequency based on distance (like original)
            if distance_to_waypoint < 30:
                min_interval = 5  # Every 5 seconds when very close
            elif distance_to_waypoint < 100:
                min_interval = 8  # Every 8 seconds when close
            else:
                min_interval = 15  # Every 15 seconds when medium distance
            
            if current_time - self.last_announcement_time > min_interval:
                bearing = self.calculate_bearing(
                    self.current_gps["lat"], self.current_gps["lng"],
                    current_waypoint["lat"], current_waypoint["lng"]
                )
                direction = self.bearing_to_direction(bearing)
                
                # Create contextual guidance message with location name
                try:
                    current_location = self.get_location_name(self.current_gps["lat"], self.current_gps["lng"])
                    location_prefix = f"You are at {current_location}. "
                except:
                    location_prefix = ""
                
                if distance_to_waypoint < 30:
                    guidance_msg = f"{location_prefix}Almost at waypoint. Continue {direction}. {distance_to_waypoint:.0f} meters ahead."
                else:
                    guidance_msg = f"{location_prefix}Continue {direction}. Next waypoint is {distance_to_waypoint:.0f} meters away."
                
                # Add current instruction context
                current_instruction = current_waypoint.get('instruction', '')
                if current_instruction:
                    clean_instruction = current_instruction.replace('<b>', '').replace('</b>', '').replace('<div>', ' ').replace('</div>', ' ')
                    if location_prefix:
                        guidance_msg = f"{clean_instruction} From {current_location}, continue {direction}. {distance_to_waypoint:.0f} meters ahead."
                    else:
                        guidance_msg = f"{clean_instruction} Continue {direction}. {distance_to_waypoint:.0f} meters ahead."
                
                self.audio_system.speak(guidance_msg)
                self.last_announcement_time = current_time
                logger.info(f"🧭 Progress guidance: {guidance_msg}")

# Initialize global navigation system
voice_navigator = VoiceNavigator(GEMINI_API_KEY) if GEMINI_API_KEY else None

# ======================
# ROBOT CONTROL SYSTEM
# ======================

from robot_controller import get_robot_controller
import threading

robot_controller = get_robot_controller()
robot_navigation_thread = None

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "message": "Guiding Robot Backend API",
        "endpoints": {
            "stream": "/stream - MJPEG video stream from ESP32",
            "health": "/health - Backend health status",
            "esp32": "/esp32/status - ESP32 connection status"
        }
    }

@app.get("/health")
async def health_check():
    """Check if backend and ESP32 are accessible"""
    try:
        # Use same timeout as working script (5 seconds)
        response = requests.get(ESP32_STREAM_URL, timeout=5, stream=True)
        esp32_status = "online" if response.status_code == 200 else "offline"
        response.close()
    except Exception as e:
        esp32_status = f"offline - {str(e)}"
    
    return {
        "backend": "online",
        "esp32": esp32_status,
        "esp32_url": ESP32_STREAM_URL
    }

@app.get("/esp32/status")
async def esp32_status():
    """Check ESP32 camera status - using working script method"""
    try:
        # Match the working script: 5 second timeout, stream=True
        logger.info(f"📡 Testing ESP32-CAM at {ESP32_STREAM_URL}...")
        response = requests.get(ESP32_STREAM_URL, timeout=5, stream=True)
        
        if response.status_code == 200:
            logger.info("✅ ESP32-CAM stream endpoint working!")
            headers = dict(response.headers)
            response.close()
            return {
                "status": "online",
                "url": ESP32_STREAM_URL,
                "status_code": response.status_code,
                "headers": headers,
                "message": "ESP32 is accessible and streaming"
            }
        else:
            return {
                "status": "error",
                "url": ESP32_STREAM_URL,
                "status_code": response.status_code,
                "message": f"ESP32 returned status: {response.status_code}"
            }
    except requests.exceptions.Timeout:
        logger.error("❌ ESP32 connection timeout")
        return {
            "status": "timeout",
            "url": ESP32_STREAM_URL,
            "message": "ESP32 not responding (timeout after 5s)"
        }
    except requests.exceptions.ConnectionError:
        return {
            "status": "offline",
            "url": ESP32_STREAM_URL,
            "message": "Cannot connect to ESP32. Check power and network."
        }
    except Exception as e:
        return {
            "status": "error",
            "url": ESP32_STREAM_URL,
            "message": str(e)
        }

@app.get("/esp32/find-stream")
async def find_stream_endpoint():
    """Test common ESP32-CAM stream endpoints to find the correct one"""
    base_ip = "172.20.10.3"
    test_paths = [
        f"http://{base_ip}",
        f"http://{base_ip}/stream",
        f"http://{base_ip}/cam",
        f"http://{base_ip}/mjpeg",
        f"http://{base_ip}:81/stream",
        f"http://{base_ip}:80/stream",
    ]
    
    results = []
    for url in test_paths:
        try:
            response = requests.get(url, timeout=2, stream=True)
            content_type = response.headers.get('content-type', '')
            is_mjpeg = 'multipart' in content_type.lower() or 'mixed-replace' in content_type.lower()
            
            results.append({
                "url": url,
                "status": "online",
                "status_code": response.status_code,
                "content_type": content_type,
                "is_mjpeg_stream": is_mjpeg,
                "recommended": is_mjpeg
            })
        except Exception as e:
            results.append({
                "url": url,
                "status": "error",
                "message": str(e),
                "is_mjpeg_stream": False,
                "recommended": False
            })
    
    # Find recommended URL
    recommended = [r for r in results if r.get("recommended")]
    
    return {
        "test_results": results,
        "recommended_url": recommended[0]["url"] if recommended else None,
        "current_url": ESP32_STREAM_URL
    }

@app.get("/stream")
async def stream_video():
    """
    Proxy MJPEG stream from ESP32-CAM to React frontend
    Uses the exact working method from vision_assistant module
    """
    try:
        logger.info(f"📹 Starting stream proxy from {ESP32_STREAM_URL}")
        
        def generate():
            """Generator function using the working ESP32Camera capture method"""
            try:
                from vision_assistant import get_camera
                
                camera = get_camera()
                frame_count = 0
                logger.info(f"✅ Using ESP32Camera at {ESP32_CAPTURE_URL}")
                
                while True:
                    # Use the WORKING capture method from your script
                    frame = camera.capture_frame()
                    
                    if frame is not None:
                        # Encode frame as JPEG
                        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                        frame_bytes = buffer.tobytes()
                        
                        # Send as MJPEG frame with proper boundaries
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                        
                        frame_count += 1
                        if frame_count % 50 == 0:
                            logger.info(f"📹 Streamed {frame_count} frames to React")
                    else:
                        logger.warning("⚠️ Frame capture failed, retrying...")
                    
                    # Control frame rate - be gentle on ESP32
                    import time
                    time.sleep(0.1)  # 10 FPS
                        
            except Exception as e:
                logger.error(f"❌ Stream generation error: {str(e)}")
                yield b"--frame\r\nContent-Type: text/plain\r\n\r\nStream Error\r\n"
        
        # Return streaming response with proper MJPEG headers
        return StreamingResponse(
            generate(),
            media_type="multipart/x-mixed-replace; boundary=frame",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to start stream: {str(e)}")
        return Response(
            content=f"Stream error: {str(e)}",
            status_code=500,
            media_type="text/plain"
        )

@app.get("/capture")
async def capture_frame():
    """
    Capture a single frame from the ESP32 stream
    Uses the working capture_frame_bytes function from vision_assistant
    """
    try:
        logger.info(f"📸 Capturing frame from {ESP32_STREAM_URL}")
        
        # Use the working capture function from vision_assistant
        jpeg_data = capture_frame_bytes(ESP32_STREAM_URL, timeout=5)
        
        if jpeg_data:
            return Response(
                content=jpeg_data,
                media_type="image/jpeg",
                headers={
                    "Cache-Control": "no-cache",
                    "Access-Control-Allow-Origin": "*"
                }
            )
        else:
            return Response(
                content="Could not capture frame from ESP32",
                status_code=500,
                media_type="text/plain"
            )
        
    except Exception as e:
        logger.error(f"❌ Frame capture error: {str(e)}")
        return Response(
            content=f"Capture error: {str(e)}",
            status_code=500,
            media_type="text/plain"
        )

@app.post("/analyze")
async def analyze_frame():
    """
    Capture a frame and analyze it with Gemini Vision
    Returns scene description for blind users
    """
    try:
        if not vision_model:
            error_msg = "Gemini Vision not initialized. Check API key."
            if voice_navigator and voice_navigator.audio_system:
                voice_navigator.audio_system.speak("Vision analysis system is not available")
            return JSONResponse(
                content={"error": error_msg},
                status_code=500
            )
        
        logger.info("🧠 Analyzing frame with Gemini...")
        
        # Capture frame using working method
        frame = capture_frame_from_esp32()
        
        if frame is None:
            error_msg = "Could not capture frame from camera"
            if voice_navigator and voice_navigator.audio_system:
                voice_navigator.audio_system.speak(error_msg)
            return JSONResponse(
                content={"error": error_msg},
                status_code=500
            )
        
        # Analyze with Gemini
        description = vision_model.analyze_frame(frame)
        
        if description:
            # Speak the description through audio system
            if voice_navigator and voice_navigator.audio_system:
                voice_navigator.audio_system.speak(description)
                logger.info(f"🔊 Vision analysis queued for speech: {description[:100]}...")
            
            return JSONResponse(
                content={
                    "success": True,
                    "description": description,
                    "timestamp": int(time.time() * 1000)
                }
            )
        else:
            error_msg = "Gemini analysis failed"
            if voice_navigator and voice_navigator.audio_system:
                voice_navigator.audio_system.speak(error_msg)
            return JSONResponse(
                content={"error": error_msg},
                status_code=500
            )
        
    except Exception as e:
        logger.error(f"❌ Analysis error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.post("/analyze-and-speak")
async def analyze_and_speak():
    """
    Capture a frame, analyze it with Gemini Vision, and speak the description
    Used during navigation for environmental awareness
    """
    try:
        if not vision_model:
            return JSONResponse(
                content={"error": "Gemini Vision not initialized. Check API key."},
                status_code=500
            )
        
        if not voice_navigator:
            return JSONResponse(
                content={"error": "Voice Navigator not initialized."},
                status_code=500
            )
        
        logger.info("🧠 Analyzing frame with Gemini and speaking...")
        
        # Capture frame
        frame = capture_frame_from_esp32()
        
        if frame is None:
            error_msg = "Could not capture frame from camera"
            logger.error(f"❌ {error_msg}")
            voice_navigator.audio_system.speak(error_msg)
            return JSONResponse(
                content={"error": error_msg},
                status_code=500
            )
        
        # Analyze with Gemini
        description = vision_model.analyze_frame(frame)
        
        if description:
            # Speak the description through the audio queue
            voice_navigator.audio_system.speak(description)
            logger.info(f"✅ Vision analysis queued for speech: {description[:100]}...")
            
            return JSONResponse(
                content={
                    "success": True,
                    "description": description,
                    "timestamp": int(time.time() * 1000)
                }
            )
        else:
            error_msg = "Vision analysis failed"
            voice_navigator.audio_system.speak(error_msg)
            return JSONResponse(
                content={"error": error_msg},
                status_code=500
            )
        
    except Exception as e:
        error_msg = f"Analysis error: {str(e)}"
        logger.error(f"❌ {error_msg}")
        if voice_navigator:
            voice_navigator.audio_system.speak("Vision analysis encountered an error")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

# ======================
# NAVIGATION ENDPOINTS
# ======================

@app.post("/navigation/start")
async def start_navigation(request_data: dict):
    """
    Start navigation to destination with real-time GPS guidance
    Expected data: {"lat": float, "lng": float, "route_instructions": [str], "current_location": {"lat": float, "lng": float}}
    """
    try:
        if not voice_navigator:
            return JSONResponse(
                content={"error": "Voice Navigator not initialized. Check Gemini API key."},
                status_code=500
            )
        
        lat = request_data.get("lat")
        lng = request_data.get("lng")
        route_instructions = request_data.get("route_instructions", [])
        current_location = request_data.get("current_location")
        
        if lat is None or lng is None:
            return JSONResponse(
                content={"error": "Missing lat/lng coordinates"},
                status_code=400
            )
        
        # Set current location first if provided
        if current_location and current_location.get("lat") and current_location.get("lng"):
            voice_navigator.set_current_location(current_location["lat"], current_location["lng"])
            logger.info(f"📍 Current location set: {current_location['lat']:.6f}, {current_location['lng']:.6f}")
        
        # Generate sample route instructions if none provided (like original home_navigator)
        if not route_instructions:
            route_instructions = generate_sample_route_instructions(lat, lng)
            logger.info(f"🗺️ Generated {len(route_instructions)} sample route instructions")
        
        # Set destination and start navigation
        voice_navigator.set_destination(lat, lng, route_instructions)
        
        logger.info(f"🧭 Navigation started to: {lat:.6f}, {lng:.6f}")
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Navigation started",
                "destination": {"lat": lat, "lng": lng},
                "current_location": voice_navigator.current_gps,
                "route_instructions_count": len(route_instructions),
                "waypoints_count": len(voice_navigator.waypoints)
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Navigation start error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

def generate_sample_route_instructions(dest_lat: float, dest_lng: float):
    """
    Generate realistic sample route instructions like the original system
    This simulates what would come from Google Directions API
    """
    sample_instructions = [
        "Head southeast on your current street",
        "Turn right at the next intersection",
        "Continue straight for 200 meters",
        "Turn left at the traffic light",
        "Walk straight past the bus stop",
        "Turn right onto the main road", 
        "Continue for 150 meters",
        "Turn left at the roundabout",
        "Walk straight toward the destination",
        "Your destination will be on the right"
    ]
    
    # Return a subset for variety (3-7 instructions)
    import random
    num_instructions = min(random.randint(3, 7), len(sample_instructions))
    return sample_instructions[:num_instructions]

@app.post("/navigation/update-gps")
async def update_gps_location(request_data: dict):
    """
    Update current GPS location and provide navigation guidance
    Expected data: {"lat": float, "lng": float}
    """
    try:
        if not voice_navigator:
            return JSONResponse(
                content={"error": "Voice Navigator not initialized"},
                status_code=500
            )
        
        lat = request_data.get("lat")
        lng = request_data.get("lng")
        
        if lat is None or lng is None:
            return JSONResponse(
                content={"error": "Missing lat/lng coordinates"},
                status_code=400
            )
        
        # Update GPS location
        voice_navigator.set_current_location(lat, lng)
        
        # Provide navigation guidance if active
        if voice_navigator.navigation_active:
            voice_navigator.provide_navigation_guidance()
        
        return JSONResponse(
            content={
                "success": True,
                "current_location": {"lat": lat, "lng": lng},
                "navigation_active": voice_navigator.navigation_active
            }
        )
        
    except Exception as e:
        logger.error(f"❌ GPS update error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.post("/navigation/stop")
async def stop_navigation():
    """Stop active navigation"""
    try:
        if not voice_navigator:
            return JSONResponse(
                content={"error": "Voice Navigator not initialized"},
                status_code=500
            )
        
        # Clear all navigation state
        voice_navigator.navigation_active = False
        voice_navigator.destination = None
        voice_navigator.route_instructions = []
        voice_navigator.current_instruction_index = 0
        voice_navigator.waypoints = []  # Clear waypoints
        voice_navigator.current_waypoint_index = 0  # Reset waypoint index
        
        # Clear any queued audio messages
        voice_navigator.audio_system.clear_queue()
        
        # Announce stop
        voice_navigator.audio_system.speak("Navigation stopped.")
        
        logger.info("🛑 Navigation stopped")
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Navigation stopped"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Navigation stop error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.post("/navigation/test-guidance")
async def test_navigation_guidance():
    """
    Trigger navigation guidance manually for testing
    Useful for testing without waiting for GPS updates
    """
    try:
        if not voice_navigator:
            return JSONResponse(
                content={"error": "Voice Navigator not initialized"},
                status_code=500
            )
        
        if not voice_navigator.navigation_active:
            return JSONResponse(
                content={"error": "No active navigation. Start navigation first."},
                status_code=400
            )
        
        # Force guidance announcement regardless of time interval
        old_time = voice_navigator.last_announcement_time
        voice_navigator.last_announcement_time = 0  # Reset to force announcement
        
        voice_navigator.provide_navigation_guidance()
        
        # Restore original time if no guidance was provided
        if voice_navigator.last_announcement_time == 0:
            voice_navigator.last_announcement_time = old_time
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Navigation guidance triggered",
                "navigation_active": voice_navigator.navigation_active,
                "current_location": voice_navigator.current_gps,
                "destination": voice_navigator.destination
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Test guidance error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.get("/navigation/status")
async def get_navigation_status():
    """Get current navigation status"""
    try:
        if not voice_navigator:
            return JSONResponse(
                content={"error": "Voice Navigator not initialized"},
                status_code=500
            )
        
        return JSONResponse(
            content={
                "navigation_active": voice_navigator.navigation_active,
                "current_location": voice_navigator.current_gps,
                "destination": voice_navigator.destination,
                "route_instructions_count": len(voice_navigator.route_instructions),
                "current_instruction_index": voice_navigator.current_instruction_index,
                "audio_enabled": voice_navigator.audio_system.enabled
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Navigation status error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

# ======================
# ROBOT AUTONOMOUS NAVIGATION ENDPOINTS
# ======================

@app.post("/robot/navigate-to")
async def robot_navigate_to(request_data: dict):
    """
    Command robot to navigate to GPS coordinates
    Calculates path and updates Firebase with directions (forward/left/right)
    Navigation starts only when this endpoint is called (navigate button pressed)
    Expected data: {"lat": float, "lng": float}
    """
    global robot_navigation_thread
    
    try:
        lat = request_data.get("lat")
        lng = request_data.get("lng")
        
        if lat is None or lng is None:
            return JSONResponse(
                content={"error": "Missing lat/lng coordinates"},
                status_code=400
            )
        
        # Check if already navigating
        if robot_controller.is_navigating:
            return JSONResponse(
                content={"error": "Robot is already navigating. Stop current navigation first."},
                status_code=409
            )
        
        # Start navigation in a separate thread
        def navigate_async():
            try:
                robot_controller.start_navigation(lat, lng)
            except Exception as e:
                logger.error(f"❌ Robot navigation error: {e}")
        
        robot_navigation_thread = threading.Thread(target=navigate_async, daemon=True)
        robot_navigation_thread.start()
        
        logger.info(f"🤖 Robot navigation started to: {lat:.6f}, {lng:.6f}")
        logger.info("📍 Robot will calculate path and update Firebase with directions")
        
        # Also start voice navigation for audio feedback
        if voice_navigator:
            try:
                voice_navigator.set_destination(lat, lng, [])
                voice_navigator.audio_system.speak(
                    f"Robot navigation activated. Calculating path to destination. "
                    "The robot will receive turn-by-turn directions via Firebase."
                )
            except Exception as e:
                logger.warning(f"⚠️ Voice navigation not available: {e}")
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Robot navigation started - directions will be updated in Firebase",
                "destination": {"lat": lat, "lng": lng},
                "mode": "path_finding",
                "firebase_path": "devices/esp32B/navigation_direction"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Robot navigation start error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.post("/robot/stop")
async def robot_stop():
    """Stop robot navigation"""
    try:
        robot_controller.stop_navigation()
        
        if voice_navigator:
            voice_navigator.audio_system.speak("Robot navigation stopped.")
        
        logger.info("🛑 Robot navigation stopped")
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Robot navigation stopped"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Robot stop error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.get("/robot/status")
async def robot_status():
    """Get current robot navigation status"""
    try:
        gps = robot_controller.get_gps_from_firebase()
        heading = robot_controller.get_heading_from_firebase()
        
        status_data = {
            "is_navigating": robot_controller.is_navigating,
            "current_location": gps,
            "current_heading": heading,
            "destination": robot_controller.destination
        }
        
        if gps and robot_controller.destination:
            # Calculate distance to destination
            distance = robot_controller.calculate_distance(
                gps['lat'], gps['lng'],
                robot_controller.destination['lat'], robot_controller.destination['lng']
            )
            status_data["distance_to_destination"] = round(distance, 2)
            
            # Calculate bearing to destination
            bearing = robot_controller.calculate_bearing(
                gps['lat'], gps['lng'],
                robot_controller.destination['lat'], robot_controller.destination['lng']
            )
            status_data["bearing_to_destination"] = round(bearing, 2)
        
        return JSONResponse(content=status_data)
        
    except Exception as e:
        logger.error(f"❌ Robot status error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )


if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Starting Guiding Robot Backend Server")
    logger.info(f"📡 ESP32 Stream URL: {ESP32_STREAM_URL}")
    logger.info("🌐 API will be available at: http://localhost:8000")
    logger.info("🤖 Robot navigation mode: Path finding with Firebase directions")
    uvicorn.run(app, host="0.0.0.0", port=8000)
