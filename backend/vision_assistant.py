"""
Vision Assistant Module
Uses the exact working approach from gemini_vision_simple.py
"""

import cv2
import numpy as np
import requests
import os
import google.generativeai as genai
from PIL import Image
import logging
import time

logger = logging.getLogger(__name__)

# ESP32 Camera Configuration - EXACT same as working script
ESP32_IP = "172.16.202.189"
ESP32_STREAM_URL = f"http://{ESP32_IP}:81/stream"  # For MJPEG stream
ESP32_CAPTURE_URL = f"http://{ESP32_IP}/capture"   # For single frame capture

# Gemini Configuration - Use current stable model
GEMINI_MODEL = "gemini-2.0-flash-exp"  # Current stable model with vision support

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
# ESP32-CAM INTERFACE (Exact same as working script)
# ======================
class ESP32Camera:
    """ESP32-CAM interface using the exact working approach"""
    
    def __init__(self, capture_url):
        self.capture_url = capture_url
        self.session = requests.Session()
        
        # Simple headers for ESP32 compatibility
        self.session.headers.update({
            'User-Agent': 'ESP32Vision/1.0',
            'Connection': 'close'
        })
        
        logger.info(f"📷 ESP32-CAM interface initialized for {capture_url}")
    
    def capture_frame(self):
        """Capture a single frame from ESP32-CAM using /capture endpoint"""
        try:
            response = self.session.get(self.capture_url, timeout=3)
            
            if response.status_code == 200:
                # Convert image data to OpenCV format
                img_array = np.frombuffer(response.content, dtype=np.uint8)
                frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                return frame
            else:
                logger.warning(f"⚠️ Capture failed: HTTP {response.status_code}")
                return None
                
        except requests.exceptions.Timeout:
            logger.warning("⚠️ Capture timeout")
            return None
        except requests.exceptions.ConnectionError:
            logger.warning("⚠️ Connection error - ESP32 may have reset")
            time.sleep(0.1)  # Brief pause before retry
            return None
        except Exception as e:
            logger.error(f"⚠️ Capture error: {e}")
            return None

# ======================
# GEMINI VISION SYSTEM
# ======================
class GeminiVision:
    def __init__(self, api_key, model_name):
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found!")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)
        logger.info(f"✅ Gemini {model_name} loaded!")

    def analyze_frame(self, frame):
        """Analyze OpenCV frame with Gemini Vision"""
        try:
            # Convert OpenCV BGR to RGB PIL Image
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            
            logger.info("🧠 Analyzing with Gemini...")
            response = self.model.generate_content([GEMINI_PROMPT, pil_image])
            
            description = response.text.strip()
            logger.info(f"🤖 Gemini: '{description}'")
            return description
            
        except Exception as e:
            logger.error(f"❌ Gemini error: {e}")
            return None

# ======================
# UTILITY FUNCTIONS FOR FASTAPI
# ======================
def capture_frame_from_esp32():
    """
    Capture a single frame from ESP32 using the working /capture method
    """
    camera = ESP32Camera(ESP32_CAPTURE_URL)
    return camera.capture_frame()

def capture_frame_bytes():
    """
    Capture a single frame and return as JPEG bytes for FastAPI streaming
    """
    camera = ESP32Camera(ESP32_CAPTURE_URL)
    frame = camera.capture_frame()
    
    if frame is not None:
        # Encode frame as JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        return buffer.tobytes()
    
    return None

def analyze_captured_frame(gemini_api_key):
    """
    Capture a frame and analyze it with Gemini
    Returns analysis text or None
    """
    try:
        # Initialize Gemini if not already done
        vision_system = GeminiVision(gemini_api_key, GEMINI_MODEL)
        
        # Capture frame
        frame = capture_frame_from_esp32()
        if frame is None:
            return None
        
        # Analyze frame
        return vision_system.analyze_frame(frame)
        
    except Exception as e:
        logger.error(f"❌ Analysis error: {e}")
        return None

def test_esp32_connection():
    """
    Test ESP32-CAM connection using the /capture endpoint
    Returns True if working, False otherwise
    """
    try:
        camera = ESP32Camera(ESP32_CAPTURE_URL)
        frame = camera.capture_frame()
        if frame is not None:
            logger.info(f"✅ ESP32-CAM connection working! Frame size: {frame.shape}")
            return True
        else:
            logger.error("❌ ESP32-CAM connection failed")
            return False
    except Exception as e:
        logger.error(f"❌ ESP32-CAM test failed: {e}")
        return False

# Global camera instance for reuse
_camera_instance = None

def get_camera():
    """Get singleton camera instance"""
    global _camera_instance
    if _camera_instance is None:
        _camera_instance = ESP32Camera(ESP32_CAPTURE_URL)
    return _camera_instance

if __name__ == "__main__":
    # Test the connection
    print("🧪 Testing ESP32-CAM connection...")
    if test_esp32_connection():
        print("✅ Connection test passed!")
    else:
        print("❌ Connection test failed!")
