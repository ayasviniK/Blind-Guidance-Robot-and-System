# 🤖 ESP32 Robot Navigation Setup Guide

## Overview

This guide explains how to set up your ESP32 to work with the autonomous robot navigation system.

## Key Changes from Original Code

### ✅ What Changed

**Before (Obstacle Avoidance Mode):**

- Robot autonomously avoided obstacles
- Made its own navigation decisions
- No external control

**After (Command-Controlled Mode):**

- Robot receives commands from Firebase
- Backend controls navigation decisions
- Obstacle data sent to backend for processing
- Backend sends motor commands based on GPS + sensors

## Firebase Structure

### Commands Published BY Backend → Read BY ESP32

```
/devices/esp32B/motor_command/
  ├── command: "forward" | "backward" | "left" | "right" | "stop"
  └── timestamp: 1729512345678
```

### Data Published BY ESP32 → Read BY Backend

```
/devices/esp32B/sensors/
  ├── front: 45    (cm)
  ├── left: 120    (cm)
  ├── right: 85    (cm)
  └── timestamp: 1729512345678

/devices/esp32B/status/
  ├── state: "forward"
  ├── sev: 0       (0=safe, 100=caution, 200=danger)
  └── timestamp: 1729512345678
```

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    NAVIGATION FLOW                       │
└─────────────────────────────────────────────────────────┘

1. ESP32 reads sensors (every 100ms)
   ↓
2. ESP32 publishes sensor data to Firebase (every 1s)
   ↓
3. Backend reads sensor data from Firebase
   ↓
4. Backend calculates:
   - Distance to destination (GPS)
   - Bearing/direction needed
   - Obstacle avoidance strategy
   ↓
5. Backend publishes motor command to Firebase
   ↓
6. ESP32 reads command (every 500ms)
   ↓
7. ESP32 executes command (forward/left/right/stop)
   ↓
8. Repeat from step 1
```

## Arduino Code Features

### 🔄 Command Reading

- Checks Firebase every **500ms** for new commands
- Only executes if command timestamp is newer
- Prevents duplicate execution of same command

### 📡 Sensor Publishing

- Reads sensors every **100ms** for fast response
- Publishes to Firebase every **1 second** to avoid rate limits
- All three sensors: front, left, right

### ⏱️ Safety Timeout

- If no new command for **5 seconds**, automatically stops
- Prevents runaway robot if backend crashes
- Can be adjusted via `commandTimeout` variable

### 🔌 WiFi Reconnection

- Automatically reconnects if WiFi drops
- Waits and retries connection
- Continues operation after reconnect

## Installation Steps

### 1. Install Required Libraries

Open Arduino IDE and install:

```
Tools → Manage Libraries → Search and Install:
- WiFi (built-in)
- HTTPClient (built-in)
- WiFiClientSecure (built-in)
- ArduinoJson (by Benoit Blanchon) - Install version 6.x
```

### 2. Update WiFi Credentials

```cpp
const char* WIFI_SSID = "YourWiFiName";
const char* WIFI_PASS = "YourWiFiPassword";
```

### 3. Verify Firebase Settings

The code is already configured for your Firebase:

```cpp
const char* FIREBASE_HOST = "https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* FIREBASE_AUTH = "DiyaMtH5KLUO59Vf2cfdNfkbkChgC5KSriiZ8Knm";
```

### 4. Check Pin Connections

**Ultrasonic Sensors:**

```
Front: TRIG=32, ECHO=34
Right: TRIG=27, ECHO=39
Left:  TRIG=13, ECHO=33
```

**L298N Motor Driver:**

```
Right Motor: ENA=22, IN1=19, IN2=21
Left Motor:  ENB=18, IN3=4,  IN4=5
```

### 5. Upload Code

1. Connect ESP32 via USB
2. Select board: `Tools → Board → ESP32 Dev Module`
3. Select port: `Tools → Port → /dev/cu.usbserial-XXXX`
4. Click Upload ⬆️

### 6. Monitor Serial Output

Open Serial Monitor at **115200 baud** to see:

```
🤖 ESP32 Robot Navigation System Starting...
🌐 Connecting to WiFi: YourWiFi
...
✅ WiFi Connected!
📍 IP Address: 192.168.1.123
🚀 Robot Navigation System Ready!
📡 Listening for commands from Firebase...
```

## Testing

### Test 1: Sensor Reading

Watch Serial Monitor for sensor readings every 2 seconds:

```
📏 Sensors -> Front: 45cm | Left: 120cm | Right: 85cm
```

### Test 2: Manual Commands

Use the web interface "Manual Control" or send via Firebase:

```json
// In Firebase Console, set:
/devices/esp32B/motor_command
{
  "command": "forward",
  "timestamp": 1729512345678
}
```

ESP32 should show:

```
🤖 New command: forward (timestamp: 1729512345678)
⬆️ Moving FORWARD
```

### Test 3: Autonomous Navigation

1. Set destination in web app
2. Click "🤖 Auto-Navigate"
3. Watch Serial Monitor for commands:

```
🤖 New command: forward
⬆️ Moving FORWARD
📡 Sensors published -> HTTP 200
🤖 New command: right
➡️ Turning RIGHT
🤖 New command: forward
⬆️ Moving FORWARD
🤖 New command: stop
🛑 Motors STOPPED
```

## Troubleshooting

### WiFi Won't Connect

```cpp
// Increase connection attempts
int attempts = 0;
while (WiFi.status() != WL_CONNECTED && attempts < 40) {  // was 20
  delay(500);
  Serial.print(".");
  attempts++;
}
```

### Commands Not Received

1. Check Firebase path: `/devices/esp32B/motor_command`
2. Verify Firebase Auth key is correct
3. Check internet connection
4. Look for errors in Serial Monitor

### Motors Not Moving

1. Check L298N power supply (7-12V)
2. Verify all wire connections
3. Test motor direction:

```cpp
void setup() {
  // ... existing setup ...

  // Test motors
  moveForward();
  delay(2000);
  stopMotors();
  delay(1000);
  turnLeft();
  delay(1000);
  stopMotors();
}
```

### Sensors Reading 400cm

- Check ultrasonic sensor connections
- Verify TRIG and ECHO pins are correct
- Ensure 5V power to sensors
- Check for loose wires

### Robot Keeps Stopping

- Command timeout may be too short
- Backend may not be sending commands fast enough
- Increase timeout:

```cpp
unsigned long commandTimeout = 10000;  // 10 seconds instead of 5
```

## Tuning Parameters

### Speed Adjustment

```cpp
int baseSpeed = 90;      // Forward speed (0-255)
int turnSpeed = 110;     // Turn speed (0-255)
int backwardSpeed = 80;  // Backward speed (0-255)
```

### Timing Adjustment

```cpp
lastSensorRead >= 100     // Sensor read frequency (ms)
lastCommandFetch >= 500   // Command check frequency (ms)
lastFirebaseUpdate >= 1000 // Data publish frequency (ms)
commandTimeout = 5000     // Safety stop timeout (ms)
```

### Command Fetch Frequency

For faster response, reduce command fetch interval:

```cpp
if (millis() - lastCommandFetch >= 250) {  // Check every 250ms instead of 500ms
  fetchMotorCommand();
  lastCommandFetch = millis();
}
```

## Advanced Features

### Add GPS Module (Optional)

If you have a GPS module (NEO-6M, NEO-7M, etc.):

```cpp
#include <TinyGPS++.h>
TinyGPSPlus gps;
HardwareSerial GPS_Serial(1);  // Use Serial1

void setup() {
  // ... existing setup ...
  GPS_Serial.begin(9600, SERIAL_8N1, 16, 17);  // RX=16, TX=17
}

void publishGPS() {
  if (GPS_Serial.available() > 0) {
    if (gps.encode(GPS_Serial.read())) {
      if (gps.location.isValid()) {
        float lat = gps.location.lat();
        float lng = gps.location.lng();

        // Publish to Firebase
        String gpsPath = "/devices/esp32A/gps.json";
        String gpsJson = "{\"lat\":" + String(lat, 6) + ",\"lng\":" + String(lng, 6) + "}";
        // ... publish code ...
      }
    }
  }
}
```

### Add Compass/IMU (Optional)

For accurate heading measurements:

```cpp
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BNO055.h>

Adafruit_BNO055 bno = Adafruit_BNO055(55);

void setup() {
  // ... existing setup ...
  if (!bno.begin()) {
    Serial.println("No BNO055 detected");
  }
}

float getHeading() {
  sensors_event_t event;
  bno.getEvent(&event);
  return event.orientation.x;  // Heading in degrees
}
```

## Safety Recommendations

1. **Always test in a safe area first**
2. **Keep emergency stop button accessible**
3. **Monitor robot during initial runs**
4. **Use lower speeds for testing**
5. **Add physical stop button on robot**

Example physical stop button:

```cpp
#define EMERGENCY_STOP_PIN 15
pinMode(EMERGENCY_STOP_PIN, INPUT_PULLUP);

void loop() {
  // Check emergency stop button
  if (digitalRead(EMERGENCY_STOP_PIN) == LOW) {
    stopMotors();
    while(1) { delay(100); }  // Halt forever until reset
  }

  // ... rest of loop ...
}
```

## Performance Tips

1. **Reduce Serial.print() calls** - Serial output slows down the loop
2. **Use const for strings** - Saves memory
3. **Avoid String concatenation in loops** - Use char arrays
4. **Increase HTTPS timeout** if WiFi is slow:

```cpp
https.setTimeout(10000);  // 10 second timeout
```

## Monitoring Dashboard

Watch these metrics in Serial Monitor:

| Metric            | Expected   | Action if Different   |
| ----------------- | ---------- | --------------------- |
| WiFi Connected    | ✅         | Check credentials     |
| Sensor readings   | 0-400cm    | Check connections     |
| HTTP codes        | 200        | Check Firebase auth   |
| Commands received | Every 0.5s | Check backend running |
| Motor response    | Immediate  | Check power supply    |

## Next Steps

Once ESP32 is working:

1. ✅ Test manual commands from web interface
2. ✅ Verify sensor data appears in web interface
3. ✅ Test autonomous navigation with short distances
4. ✅ Calibrate turn durations in `robot_controller.py`
5. ✅ Add GPS module for outdoor navigation
6. ✅ Fine-tune speed and timing parameters

## Support

If you encounter issues:

1. Check Serial Monitor output
2. Verify Firebase data in Firebase Console
3. Check backend logs: `python backend/main.py`
4. Review web browser console (F12)

Common error patterns:

- `HTTP 401` = Firebase auth key wrong
- `HTTP 404` = Path doesn't exist yet
- `Timeout` = WiFi or internet issue
- `JSON parse error` = Malformed command data
