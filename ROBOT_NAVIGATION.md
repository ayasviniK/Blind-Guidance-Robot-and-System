# 🤖 Autonomous Robot Navigation System

## Overview

The Guiding Robot now has **autonomous navigation** capabilities! The robot can navigate to GPS coordinates automatically using:

- **GPS positioning** for location tracking
- **Ultrasonic sensors** for obstacle avoidance
- **Heading correction** to stay on course
- **Real-time status monitoring** via the web interface

## Features

### 1. **Autonomous Navigation**

- Robot automatically moves toward GPS destination
- Uses bearing calculations to determine direction
- Corrects heading periodically to stay on course
- Stops when within 5 meters of destination

### 2. **Obstacle Avoidance**

- Monitors front, left, and right ultrasonic sensors
- Stops and maneuvers around obstacles automatically
- Configurable obstacle detection threshold (default: 30cm)

### 3. **Real-time Monitoring**

- Live distance to destination display
- Robot status indicators (GPS active, obstacle avoidance, autonomous control)
- Emergency stop button always accessible

## How to Use

### Step 1: Start Backend Server

```bash
cd backend
source venv/bin/activate  # On Mac/Linux
python main.py
```

### Step 2: Set Destination

1. Open the web app (http://localhost:5173)
2. Enter a destination address or GPS coordinates
3. Click **"Navigate"** to calculate the route

### Step 3: Start Robot Navigation

1. Click the **"🤖 Auto-Navigate"** button (purple)
2. Robot will begin moving autonomously toward destination
3. Monitor progress in the Robot Status card (appears in right sidebar)

### Step 4: Monitor & Stop

- Watch the distance counter decrease as robot approaches destination
- Click **"Stop Robot"** or **"Emergency Stop"** to halt navigation anytime
- Robot automatically stops when destination is reached (within 5m)

## API Endpoints

### Start Robot Navigation

```http
POST /robot/navigate-to
Content-Type: application/json

{
  "lat": 7.2906,
  "lng": 80.6337
}
```

**Response:**

```json
{
  "success": true,
  "message": "Robot autonomous navigation started",
  "destination": { "lat": 7.2906, "lng": 80.6337 },
  "mode": "autonomous"
}
```

### Stop Robot

```http
POST /robot/stop
```

**Response:**

```json
{
  "success": true,
  "message": "Robot stopped"
}
```

### Get Robot Status

```http
GET /robot/status
```

**Response:**

```json
{
  "is_navigating": true,
  "current_location": { "lat": 7.2905, "lng": 80.6335 },
  "destination": { "lat": 7.2906, "lng": 80.6337 },
  "sensors": { "front": 45, "left": 120, "right": 85 },
  "distance_to_destination": 15.3
}
```

### Manual Control

```http
POST /robot/manual-command
Content-Type: application/json

{
  "command": "forward"  // or "backward", "left", "right", "stop"
}
```

## ESP32 Integration

### Required Firebase Structure

The robot controller expects motor commands to be written to Firebase:

```
devices/
  esp32B/
    motor_command/
      command: "forward" | "backward" | "left" | "right" | "stop"
      timestamp: <milliseconds>
```

### ESP32 Firmware Requirements

Your ESP32 firmware should:

1. **Listen for motor commands:**

   ```cpp
   Firebase.getString(firebaseData, "/devices/esp32B/motor_command/command");
   String command = firebaseData.stringData();
   ```

2. **Execute commands:**

   - `"forward"` - Move forward
   - `"backward"` - Move backward
   - `"left"` - Turn left
   - `"right"` - Turn right
   - `"stop"` - Stop all motors

3. **Publish sensor data:**

   ```cpp
   Firebase.setInt(firebaseData, "/devices/esp32B/sensors/front", frontDistance);
   Firebase.setInt(firebaseData, "/devices/esp32B/sensors/left", leftDistance);
   Firebase.setInt(firebaseData, "/devices/esp32B/sensors/right", rightDistance);
   ```

4. **Publish GPS data:**
   ```cpp
   Firebase.setFloat(firebaseData, "/devices/esp32A/gps/lat", latitude);
   Firebase.setFloat(firebaseData, "/devices/esp32A/gps/lng", longitude);
   ```

## Configuration

### Robot Controller Parameters

Edit `backend/robot_controller.py` to adjust:

```python
# Navigation parameters
DESTINATION_THRESHOLD = 5.0      # meters - arrival threshold
OBSTACLE_THRESHOLD = 30          # cm - obstacle detection distance
HEADING_TOLERANCE = 15           # degrees - acceptable heading error
CORRECTION_INTERVAL = 2.0        # seconds between heading corrections
```

### Turn Calibration

Adjust turn duration calculations in `correct_heading()`:

```python
# Calculate turn duration (rough approximation: 90° = 1.5 seconds)
turn_duration = abs(angle_diff) / 90.0 * 1.5
```

Calibrate based on your robot's turn rate.

## Troubleshooting

### Robot doesn't move

1. Check Firebase connection: `GET /health`
2. Verify ESP32 is reading motor commands from Firebase
3. Check motor power supply
4. Verify motor_command path in Firebase

### Robot goes off course

1. Increase `CORRECTION_INTERVAL` for more frequent corrections
2. Reduce `HEADING_TOLERANCE` for stricter heading requirements
3. Calibrate turn duration for your robot's motors
4. Check GPS accuracy (should be < 5m error)

### Obstacle avoidance not working

1. Verify ultrasonic sensors are connected and publishing to Firebase
2. Check sensor values in Firebase: `/devices/esp32B/sensors`
3. Adjust `OBSTACLE_THRESHOLD` based on sensor range
4. Ensure sensors update frequently (< 1 second interval)

### Backend not available

1. Start backend server: `python backend/main.py`
2. Check backend URL in frontend: `VITE_BACKEND_URL`
3. Verify CORS settings in `main.py`
4. Check logs: `backend/main.py` console output

## Safety Notes

⚠️ **IMPORTANT:**

- Always test in a safe, open area first
- Keep emergency stop button accessible
- Monitor robot visually during autonomous operation
- Test obstacle avoidance before deploying
- Start with short distances for initial testing

## Future Improvements

- [ ] Add compass/IMU for accurate heading measurement
- [ ] Implement path planning with waypoint following
- [ ] Add dynamic obstacle avoidance (moving objects)
- [ ] Support multiple simultaneous robots
- [ ] Add battery level monitoring
- [ ] Implement return-to-home function
- [ ] Add geofencing for safety boundaries

## Architecture

```
┌─────────────────┐
│   React Web UI  │  User sets destination
└────────┬────────┘
         │ HTTP POST /robot/navigate-to
         ▼
┌─────────────────┐
│  FastAPI Backend│  Calculates bearing, sends commands
└────────┬────────┘
         │ Firebase Realtime Database
         ▼
┌─────────────────┐
│  ESP32 Firmware │  Reads commands, controls motors
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Robot Hardware │  DC motors, ultrasonic sensors, GPS
└─────────────────┘
```

## License

MIT License - See main project README
