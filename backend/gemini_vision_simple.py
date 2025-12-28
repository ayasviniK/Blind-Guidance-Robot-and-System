#!/usr/bin/env python3

import cv2
import numpy as np
import requests
import time
import subprocess
import threading
import platform
import os
import google.generativeai as genai
from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ======================
# CONFIGURATION
# ======================
ESP32_IP = "172.16.202.189"
ESP32_CAPTURE_URL = f"http://{ESP32_IP}/capture"

# Gemini Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.0-flash-exp"
ANALYSIS_INTERVAL = 6  # Analyze every 6 seconds
AUDIO_ENABLED = True

GEMINI_PROMPT = """
Describe this scene for a blind person who is walking. 
Be concise and focus on immediate obstacles, people, and potential hazards directly ahead.
Mention distances if possible (e.g., 'a person is about 10 feet away').
Start your description with what is most important for navigation.
Example: 'Person walking towards you, about 5 feet away.' 
Example: 'Stairs going down directly ahead.'
Example: 'Clear path ahead.'
"""

# ======================
# AUDIO SYSTEM
# ======================
class AudioSystem:
    def __init__(self, enabled=True):
        self.enabled = enabled
        self.speaking = False
        self.is_macos = platform.system() == "Darwin"
        
        if self.enabled:
            print("🔊 Audio System Ready!")

    def speak(self, message):
        if not self.enabled or self.speaking:
            return
            
        self.speaking = True
        
        def _speak():
            try:
                print(f"🔊 Speaking: '{message}'")
                if self.is_macos:
                    subprocess.run(['say', '-r', '180', '-v', 'Alex', message])
            except Exception as e:
                print(f"⚠️ Audio error: {e}")
            finally:
                self.speaking = False
        
        threading.Thread(target=_speak, daemon=True).start()

# ======================
# GEMINI VISION SYSTEM
# ======================
class GeminiVision:
    def __init__(self, api_key, model_name):
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found!")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)
        print(f"✅ Gemini {model_name} loaded!")

    def analyze_frame(self, frame):
        try:
            # Convert OpenCV BGR to RGB PIL Image
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            
            print("🧠 Analyzing with Gemini...")
            response = self.model.generate_content([GEMINI_PROMPT, pil_image])
            
            description = response.text.strip()
            print(f"🤖 Gemini: '{description}'")
            return description
            
        except Exception as e:
            print(f"❌ Gemini error: {e}")
            return None

# ======================
# ESP32-CAM INTERFACE
# ======================
class ESP32Camera:
    def __init__(self, capture_url):
        self.capture_url = capture_url
        self.session = requests.Session()
        
        # Simple headers for ESP32 compatibility
        self.session.headers.update({
            'User-Agent': 'ESP32Vision/1.0',
            'Connection': 'close'
        })
        
        print(f"📷 ESP32-CAM interface initialized for {capture_url}")
    
    def capture_frame(self):
        """Capture a single frame from ESP32-CAM"""
        try:
            response = self.session.get(self.capture_url, timeout=3)
            
            if response.status_code == 200:
                # Convert image data to OpenCV format
                img_array = np.frombuffer(response.content, dtype=np.uint8)
                frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                return frame
            else:
                print(f"⚠️ Capture failed: HTTP {response.status_code}")
                return None
                
        except requests.exceptions.Timeout:
            print("⚠️ Capture timeout")
            return None
        except requests.exceptions.ConnectionError:
            print("⚠️ Connection error - ESP32 may have reset")
            time.sleep(1)  # Brief pause before retry
            return None
        except Exception as e:
            print(f"⚠️ Capture error: {e}")
            return None

# ======================
# MAIN SYSTEM
# ======================
print("🚀 GEMINI VISION ASSISTANT - Clean ESP32 Mode")
print("="*60)

# Initialize systems
audio_system = AudioSystem(enabled=AUDIO_ENABLED)

try:
    vision_system = GeminiVision(GEMINI_API_KEY, GEMINI_MODEL)
except ValueError as e:
    print(f"❌ {e}")
    exit(1)

camera = ESP32Camera(ESP32_CAPTURE_URL)

# Test ESP32-CAM connection
print(f"📡 Testing ESP32-CAM connection...")
test_frame = camera.capture_frame()
if test_frame is not None:
    print("✅ ESP32-CAM connection working!")
    print(f"   Frame size: {test_frame.shape}")
else:
    print("❌ Cannot connect to ESP32-CAM")
    exit(1)

# ======================
# MAIN LOOP
# ======================
print("\n🎥 Starting vision assistance...")
print("Press Ctrl+C to quit\n")

frame_count = 0
last_analysis_time = 0

try:
    while True:
        # Capture frame
        frame = camera.capture_frame()
        
        if frame is None:
            time.sleep(0.5)  # Wait before retry
            continue
        
        frame_count += 1
        current_time = time.time()
        
        # Show frame count every 30 frames
        if frame_count % 30 == 0:
            print(f"📹 Frame #{frame_count}")
        
        # Analyze with Gemini periodically
        if current_time - last_analysis_time >= ANALYSIS_INTERVAL:
            last_analysis_time = current_time
            
            def analyze_and_speak():
                description = vision_system.analyze_frame(frame)
                if description:
                    audio_system.speak(description)
            
            threading.Thread(target=analyze_and_speak, daemon=True).start()
        
        # Display frame
        display_frame = cv2.resize(frame, (640, 480))
        cv2.imshow("ESP32-CAM Vision Assistant", display_frame)
        
        # Check for quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
        # Control frame rate - don't overwhelm ESP32
        time.sleep(0.1)  # 10 FPS max

except KeyboardInterrupt:
    print("\n👋 User quit")

# Cleanup
cv2.destroyAllWindows()
camera.session.close()
print("🛑 Vision assistant stopped. Goodbye!")