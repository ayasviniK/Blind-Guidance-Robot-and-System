# Robot Navigation System Update

## Overview

The robot controller has been updated to work as a **path-finding system** that only calculates directions and updates Firebase. The robot no longer handles obstacle avoidance or motor control directly.

## How It Works

### 1. **Navigation Starts with Button Press**

- Navigation only begins when the `/robot/navigate-to` endpoint is called
- This happens when the user presses the "Navigate" button in the app
- The system receives a destination (latitude, longitude)

### 2. **Path Calculation**

The robot controller continuously:

- Gets current GPS location from Firebase (`/devices/esp32A/gps`)
- Gets current heading/compass direction from Firebase (`/devices/esp32B/heading`)
- Calculates the bearing (direction) to the destination
- Determines which way the robot should turn

### 3. **Firebase Direction Updates**

Every 2 seconds, the system updates Firebase at:

```
/devices/esp32B/navigation_direction
```

With one of these directions:

- `"forward"` - Robot should move straight ahead
- `"left"` - Robot should turn left
- `"right"` - Robot should turn right
- `"arrived"` - Robot has reached the destination
- `"stopped"` - Navigation has been stopped

### 4. **ESP32 Reads Directions**

The ESP32 should:

1. Listen to Firebase path: `/devices/esp32B/navigation_direction`
2. Read the `direction` field
3. Execute the corresponding motor command
4. Handle obstacle avoidance independently (if needed)
5. Update its GPS and heading to Firebase

## Key Changes

### What Was Removed:

- ❌ Obstacle detection in navigation loop
- ❌ Obstacle avoidance maneuvers
- ❌ Direct motor commands from backend
- ❌ Manual robot control endpoint

### What Was Added:

- ✅ Simple path-finding algorithm
- ✅ Firebase direction updates
- ✅ Heading-based navigation
- ✅ Cleaner separation of concerns

## API Endpoints

### Start Navigation

```http
POST /robot/navigate-to
Content-Type: application/json

{
  "lat": 6.927079,
  "lng": 79.861244
}
```

**Response:**

```json
{
  "success": true,
  "message": "Robot navigation started - directions will be updated in Firebase",
  "destination": { "lat": 6.927079, "lng": 79.861244 },
  "mode": "path_finding",
  "firebase_path": "devices/esp32B/navigation_direction"
}
```

### Stop Navigation

```http
POST /robot/stop
```

### Get Status

```http
GET /robot/status
```

**Response:**

```json
{
  "is_navigating": true,
  "current_location": { "lat": 6.927, "lng": 79.861 },
  "current_heading": 45.5,
  "destination": { "lat": 6.927079, "lng": 79.861244 },
  "distance_to_destination": 12.5,
  "bearing_to_destination": 47.2
}
```

## Firebase Data Structure

### ESP32 Should Write:

```
/devices/esp32A/gps
{
  "lat": 6.927000,
  "lng": 79.861000
}

/devices/esp32B/heading
45.5  // Current compass heading in degrees (0-360)
```

### Backend Writes:

```
/devices/esp32B/navigation_direction
{
  "direction": "forward",  // or "left", "right", "arrived", "stopped"
  "timestamp": 1699800000000
}
```

## ESP32 Implementation Guide

Your ESP32 should implement something like this:

```cpp
// Listen to Firebase for navigation directions
void loop() {
  // Get direction from Firebase
  String direction = Firebase.getString("/devices/esp32B/navigation_direction/direction");

  // Execute motor command based on direction
  if (direction == "forward") {
    moveForward();
  } else if (direction == "left") {
    turnLeft();
  } else if (direction == "right") {
    turnRight();
  } else if (direction == "arrived") {
    stopMotors();
    playArrivalSound();
  } else if (direction == "stopped") {
    stopMotors();
  }

  // Update GPS and heading to Firebase
  updateGPS();
  updateHeading();

  // Check for obstacles independently
  if (obstacleDetected()) {
    handleObstacle();
  }

  delay(500);
}
```

## Testing

1. **Start the backend:**

   ```bash
   cd backend
   python main.py
   ```

2. **Trigger navigation from frontend or API:**

   ```bash
   curl -X POST http://localhost:8000/robot/navigate-to \
     -H "Content-Type: application/json" \
     -d '{"lat": 6.927079, "lng": 79.861244}'
   ```

3. **Monitor Firebase console** to see direction updates every 2 seconds

4. **ESP32 should read and execute** the directions

## Benefits

- ✅ **Simpler backend** - Just path calculation, no motor control
- ✅ **Firebase-based** - Works with real-time database
- ✅ **Decoupled** - ESP32 handles motors, backend handles navigation
- ✅ **Flexible** - ESP32 can override directions for obstacle avoidance
- ✅ **Real-time** - Updates every 2 seconds
- ✅ **Button-activated** - Only starts when user presses navigate

## Next Steps

1. Update ESP32 code to read from `/devices/esp32B/navigation_direction`
2. Implement motor control based on direction field
3. Ensure GPS and heading are continuously updated to Firebase
4. Test with actual hardware
5. Fine-tune `HEADING_TOLERANCE` and `UPDATE_INTERVAL` as needed
