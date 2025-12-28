"""
Robot Navigation Controller
Calculates path to next location and updates Firebase with directions
Navigation starts only when navigate button is pressed
"""

import requests
import math
import time
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Firebase Configuration
FIREBASE_URL = "https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app"

class RobotController:
    def __init__(self):
        self.current_gps = {"lat": 0.0, "lng": 0.0}
        self.destination = None
        self.is_navigating = False
        self.current_heading = 0.0  # Robot's current heading in degrees
        
        # Navigation parameters
        self.DESTINATION_THRESHOLD = 5.0  # meters - when to consider arrived
        self.HEADING_TOLERANCE = 15  # degrees - acceptable heading error
        self.UPDATE_INTERVAL = 2.0  # seconds between direction updates
        
        self.last_update_time = 0
        
        logger.info("🤖 Robot Controller initialized")
    
    def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two GPS points in meters (Haversine formula)"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)
        
        a = (math.sin(delta_lat/2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(delta_lng/2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def calculate_bearing(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate bearing from point 1 to point 2 in degrees (0-360)"""
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lng = math.radians(lng2 - lng1)
        
        y = math.sin(delta_lng) * math.cos(lat2_rad)
        x = (math.cos(lat1_rad) * math.sin(lat2_rad) - 
             math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(delta_lng))
        
        bearing = math.atan2(y, x)
        bearing_degrees = (math.degrees(bearing) + 360) % 360
        
        return bearing_degrees
    
    def get_gps_from_firebase(self) -> Optional[Dict[str, float]]:
        """Get current GPS location from Firebase"""
        try:
            response = requests.get(f"{FIREBASE_URL}/devices/esp32A/gps.json", timeout=5)
            if response.status_code == 200:
                gps_data = response.json()
                if gps_data and 'lat' in gps_data and 'lng' in gps_data:
                    self.current_gps = {
                        "lat": float(gps_data['lat']),
                        "lng": float(gps_data['lng'])
                    }
                    return self.current_gps
        except Exception as e:
            logger.error(f"Error getting GPS: {e}")
        return None
    
    def get_heading_from_firebase(self) -> Optional[float]:
        """Get current heading/compass direction from Firebase (if available)"""
        try:
            response = requests.get(f"{FIREBASE_URL}/devices/esp32B/heading.json", timeout=5)
            if response.status_code == 200:
                heading_data = response.json()
                if heading_data is not None:
                    self.current_heading = float(heading_data)
                    return self.current_heading
        except Exception as e:
            logger.error(f"Error getting heading: {e}")
        return None
    
    def update_direction_to_firebase(self, direction: str) -> bool:
        """
        Update Firebase with the direction robot should go
        Directions: 'forward', 'left', 'right', 'arrived'
        """
        try:
            direction_data = {
                "direction": direction,
                "timestamp": int(time.time() * 1000)
            }
            
            response = requests.put(
                f"{FIREBASE_URL}/devices/esp32B/navigation_direction.json",
                json=direction_data,
                timeout=5
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Direction updated in Firebase: {direction}")
                return True
            else:
                logger.error(f"❌ Failed to update direction: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error updating direction: {e}")
            return False
    
    def calculate_next_direction(self) -> Optional[str]:
        """
        Calculate which direction the robot should go to reach destination
        Returns: 'forward', 'left', 'right', or 'arrived'
        """
        # Get current position
        gps = self.get_gps_from_firebase()
        if not gps or not self.destination:
            logger.error("❌ No GPS or destination")
            return None
        
        # Calculate distance to destination
        distance = self.calculate_distance(
            gps['lat'], gps['lng'],
            self.destination['lat'], self.destination['lng']
        )
        
        logger.info(f"📍 Distance to destination: {distance:.1f}m")
        
        # Check if arrived
        if distance < self.DESTINATION_THRESHOLD:
            logger.info("🎯 ARRIVED at destination!")
            return 'arrived'
        
        # Calculate bearing to destination
        target_bearing = self.calculate_bearing(
            gps['lat'], gps['lng'],
            self.destination['lat'], self.destination['lng']
        )
        
        # Get current heading (try from Firebase, otherwise use last known)
        current_heading = self.get_heading_from_firebase()
        if current_heading is None:
            current_heading = self.current_heading
        
        # Calculate the angle difference
        angle_diff = (target_bearing - current_heading + 180) % 360 - 180
        
        logger.info(f"🧭 Current heading: {current_heading:.1f}°, Target: {target_bearing:.1f}°, Diff: {angle_diff:.1f}°")
        
        # Determine direction based on angle difference
        if abs(angle_diff) < self.HEADING_TOLERANCE:
            # Heading is good, go forward
            return 'forward'
        elif angle_diff > 0:
            # Need to turn right
            return 'right'
        else:
            # Need to turn left
            return 'left'
    
    def start_navigation(self, dest_lat: float, dest_lng: float) -> bool:
        """
        Start navigation to destination
        Only calculates path and updates Firebase with directions
        """
        self.destination = {"lat": dest_lat, "lng": dest_lng}
        self.is_navigating = True
        
        logger.info(f"🚀 Starting navigation to {dest_lat:.6f}, {dest_lng:.6f}")
        
        # Get initial position
        gps = self.get_gps_from_firebase()
        if not gps:
            logger.error("❌ Cannot get initial GPS position")
            return False
        
        # Calculate initial distance
        initial_distance = self.calculate_distance(
            gps['lat'], gps['lng'],
            dest_lat, dest_lng
        )
        
        logger.info(f"📏 Initial distance: {initial_distance:.1f}m")
        
        # Main navigation loop - just calculate and update direction
        try:
            while self.is_navigating:
                current_time = time.time()
                
                # Update direction at regular intervals
                if current_time - self.last_update_time >= self.UPDATE_INTERVAL:
                    # Calculate next direction
                    direction = self.calculate_next_direction()
                    
                    if direction is None:
                        logger.error("❌ Could not calculate direction")
                        time.sleep(1.0)
                        continue
                    
                    # Update Firebase with direction
                    self.update_direction_to_firebase(direction)
                    
                    # If arrived, stop navigation
                    if direction == 'arrived':
                        logger.info("✅ Navigation completed - arrived at destination")
                        self.is_navigating = False
                        break
                    
                    self.last_update_time = current_time
                
                # Short sleep to avoid busy loop
                time.sleep(0.5)
            
            logger.info("✅ Navigation completed")
            return True
            
        except KeyboardInterrupt:
            logger.info("⚠️ Navigation interrupted by user")
            self.is_navigating = False
            return False
        except Exception as e:
            logger.error(f"❌ Navigation error: {e}")
            self.is_navigating = False
            return False
    
    def stop_navigation(self):
        """Stop navigation"""
        logger.info("🛑 Stopping navigation")
        self.is_navigating = False
        # Update Firebase to indicate stopped
        self.update_direction_to_firebase('stopped')

# Singleton instance
_robot_controller = None

def get_robot_controller() -> RobotController:
    """Get or create robot controller instance"""
    global _robot_controller
    if _robot_controller is None:
        _robot_controller = RobotController()
    return _robot_controller
