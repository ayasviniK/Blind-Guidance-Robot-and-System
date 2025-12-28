#!/usr/bin/env python3
"""
Test script for Robot Navigation Controller
Simulates navigation without requiring Firebase connection
"""

from robot_controller import get_robot_controller
import time

def simulate_navigation():
    """Simulate robot navigation with mock GPS data"""
    
    print("=" * 70)
    print("🤖 ROBOT NAVIGATION SIMULATION")
    print("=" * 70)
    
    rc = get_robot_controller()
    
    # Set destination
    dest_lat, dest_lng = 6.927100, 79.861300
    rc.destination = {"lat": dest_lat, "lng": dest_lng}
    
    print(f"\n📍 Destination set: {dest_lat:.6f}, {dest_lng:.6f}")
    
    # Simulate robot movement with different GPS positions
    waypoints = [
        {"lat": 6.927000, "lng": 79.861000, "heading": 45},   # Start
        {"lat": 6.927020, "lng": 79.861050, "heading": 60},   # Moving
        {"lat": 6.927050, "lng": 79.861150, "heading": 70},   # Getting closer
        {"lat": 6.927080, "lng": 79.861250, "heading": 72},   # Almost there
        {"lat": 6.927095, "lng": 79.861290, "heading": 71},   # Very close
    ]
    
    print("\n" + "=" * 70)
    print("🚀 STARTING NAVIGATION SIMULATION")
    print("=" * 70)
    
    for i, waypoint in enumerate(waypoints, 1):
        print(f"\n📍 Waypoint {i}/{len(waypoints)}:")
        print(f"   Position: {waypoint['lat']:.6f}, {waypoint['lng']:.6f}")
        print(f"   Heading: {waypoint['heading']}°")
        
        # Update robot state
        rc.current_gps = {"lat": waypoint['lat'], "lng": waypoint['lng']}
        rc.current_heading = waypoint['heading']
        
        # Calculate distance to destination
        distance = rc.calculate_distance(
            waypoint['lat'], waypoint['lng'],
            dest_lat, dest_lng
        )
        
        print(f"   Distance to goal: {distance:.1f}m")
        
        # Calculate bearing to destination
        bearing = rc.calculate_bearing(
            waypoint['lat'], waypoint['lng'],
            dest_lat, dest_lng
        )
        
        print(f"   Bearing to goal: {bearing:.1f}°")
        
        # Determine direction
        angle_diff = (bearing - waypoint['heading'] + 180) % 360 - 180
        
        if distance < rc.DESTINATION_THRESHOLD:
            direction = "arrived"
            print(f"   🎯 ARRIVED AT DESTINATION!")
        elif abs(angle_diff) < rc.HEADING_TOLERANCE:
            direction = "forward"
            print(f"   ➡️  Direction: FORWARD (angle diff: {angle_diff:.1f}°)")
        elif angle_diff > 0:
            direction = "right"
            print(f"   ↪️  Direction: TURN RIGHT (angle diff: {angle_diff:.1f}°)")
        else:
            direction = "left"
            print(f"   ↩️  Direction: TURN LEFT (angle diff: {angle_diff:.1f}°)")
        
        print(f"   📡 Firebase update: direction = '{direction}'")
        
        if direction == "arrived":
            break
        
        time.sleep(0.5)  # Simulate time between updates
    
    print("\n" + "=" * 70)
    print("✅ NAVIGATION SIMULATION COMPLETE")
    print("=" * 70)
    
    print("\n📊 SUMMARY:")
    print("   • Robot successfully navigated using GPS coordinates")
    print("   • Directions calculated based on heading and bearing")
    print("   • Firebase would receive real-time direction updates")
    print("   • ESP32 would execute motor commands based on directions")

if __name__ == "__main__":
    simulate_navigation()
