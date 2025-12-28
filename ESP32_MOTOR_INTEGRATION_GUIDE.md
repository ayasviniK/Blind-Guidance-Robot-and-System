# ESP32 Robot Motor Integration Guide

## 🎯 Overview

This guide helps you integrate Firebase navigation directions with your ESP32 robot motors.

## 📋 What You Need

### Hardware
- ✅ ESP32 Development Board
- ✅ Motor Driver (L298N or similar)
- ✅ 2x DC Motors (left and right)
- ✅ HMC5883L Magnetometer (optional but recommended for heading)
- ✅ Power supply for motors (6-12V)
- ✅ Connecting wires

### Software Libraries
Install these via Arduino Library Manager:
1. `Firebase ESP Client` by Mobizt
2. `Adafruit HMC5883 Unified` (for magnetometer)
3. `Adafruit Unified Sensor`

## 🔧 Pin Configuration

### Default Pin Setup in Code:
```cpp
// Left Motor (Motor A)
MOTOR_A_IN1 = 26  // Direction pin 1
MOTOR_A_IN2 = 27  // Direction pin 2
MOTOR_A_PWM = 14  // Speed control (PWM)

// Right Motor (Motor B)
MOTOR_B_IN3 = 25  // Direction pin 1
MOTOR_B_IN4 = 33  // Direction pin 2
MOTOR_B_PWM = 32  // Speed control (PWM)
```

### 📌 Adjust These Pins to Match YOUR Motor Setup

Open `ESP32_ROBOT_MOTORS.ino` and modify these lines:

```cpp
// Change these to match your actual wiring
#define MOTOR_A_IN1 26  // ← Change to your left motor pin 1
#define MOTOR_A_IN2 27  // ← Change to your left motor pin 2
#define MOTOR_A_PWM 14  // ← Change to your left motor PWM pin

#define MOTOR_B_IN3 25  // ← Change to your right motor pin 1
#define MOTOR_B_IN4 33  // ← Change to your right motor pin 2
#define MOTOR_B_PWM 32  // ← Change to your right motor PWM pin
```

## 🌐 WiFi Configuration

Update WiFi credentials in the code:

```cpp
#define WIFI_SSID "YOUR_WIFI_SSID"      // ← Your WiFi name
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"  // ← Your WiFi password
```

## 🔥 Firebase Integration

The code uses these Firebase paths:

### Reads From (Input):
- `/devices/esp32B/navigation_direction/direction`
  - Values: `"forward"`, `"left"`, `"right"`, `"stopped"`, `"arrived"`

### Writes To (Output):
- `/devices/esp32B/heading`
  - Value: Heading in degrees (0-360)

## 🚗 Motor Speed Adjustment

Adjust motor speeds to match your robot:

```cpp
const int FORWARD_SPEED = 200;   // 0-255, adjust for your motors
const int TURN_SPEED = 150;      // 0-255, turning speed
const int TURN_DURATION = 500;   // milliseconds, how long to turn
```

### Speed Testing:
1. Start with `FORWARD_SPEED = 150`
2. Test if robot moves smoothly
3. Increase if too slow, decrease if too fast
4. Adjust `TURN_SPEED` for good turning radius

## 📡 How It Works

### System Flow:
```
Backend (Python)
    ↓
Calculates direction based on GPS
    ↓
Updates Firebase: /devices/esp32B/navigation_direction
    ↓
ESP32 reads Firebase every 1 second
    ↓
Executes motor command (forward/left/right/stop)
    ↓
ESP32 updates heading to Firebase every 2 seconds
    ↓
Backend uses heading to calculate next direction
```

### Example:
1. **Backend says:** "Turn right"
2. **Firebase updated:** `{direction: "right", timestamp: 1234567890}`
3. **ESP32 reads:** "right"
4. **ESP32 executes:** `turnRight()`
5. **Motors:** Left motor forward + Right motor backward
6. **After 500ms:** Both motors forward
7. **ESP32 reports:** Current heading to Firebase

## 🔄 Integration with Your Existing Code

### Option 1: Replace Your Motor Control Code
If you have basic motor control, you can replace it entirely with this code.

### Option 2: Merge with Your Code
If you have advanced features (obstacle avoidance, sensors, etc.), merge like this:

```cpp
void loop() {
  // Your existing code
  readSensors();
  checkObstacles();
  
  // Add Firebase navigation
  if (currentMillis - lastDirectionCheck >= DIRECTION_CHECK_INTERVAL) {
    lastDirectionCheck = currentMillis;
    readNavigationDirection();  // ← Add this
  }
  
  // Your existing code
  updateDisplay();
}
```

### Option 3: Use Your Motor Functions
If you already have motor functions, just update the direction execution:

```cpp
void executeDirection(String direction) {
  if (direction == "forward") {
    yourMoveForwardFunction();  // ← Use your function
  } else if (direction == "left") {
    yourTurnLeftFunction();     // ← Use your function
  }
  // etc...
}
```

## 🧪 Testing Steps

### 1. Upload and Test WiFi
```
Expected Serial Output:
📶 Connecting to WiFi...
✅ WiFi Connected!
📍 IP Address: 192.168.x.x
```

### 2. Test Firebase Connection
```
Expected Serial Output:
🔥 Setting up Firebase...
✅ Firebase Authentication OK
✅ Firebase Ready!
```

### 3. Test Motor Control Manually
Add to `setup()` for testing:
```cpp
// Test motors (add temporarily to setup())
Serial.println("Testing motors...");
moveForward();
delay(2000);
stopMotors();
delay(1000);
turnLeft();
delay(2000);
stopMotors();
```

### 4. Test Firebase Navigation
1. **Start your backend:** `cd backend && python main.py`
2. **Start a trip** in your web app
3. **Watch Serial Monitor:**
```
🧭 New direction from Firebase: right
➡️ Turning RIGHT
🧭 Heading updated: 135.5°
```

## 🐛 Troubleshooting

### Motors Not Moving
- ✅ Check power supply to motors (not ESP32 power!)
- ✅ Verify motor driver connections
- ✅ Test with manual code (see Testing Steps #3)
- ✅ Check if pins match your wiring

### Firebase Not Connecting
- ✅ Check WiFi credentials
- ✅ Verify Firebase URL and API key
- ✅ Check Serial Monitor for error messages
- ✅ Ensure internet connection is stable

### Wrong Direction
- ✅ Motors might be wired backwards - swap IN1/IN2 or IN3/IN4
- ✅ Adjust turn logic in `turnLeft()` and `turnRight()`

### Robot Keeps Stopping
- ✅ Check Firebase connection
- ✅ Verify backend is running
- ✅ Check if navigation was actually started in web app

## 🎚️ Fine-Tuning

### Turning Accuracy
```cpp
const int TURN_DURATION = 500;  // Increase for sharper turns
```
- Too little: Robot doesn't turn enough
- Too much: Robot overshoots turns

### Speed Balance
If robot veers to one side:
```cpp
void moveForward() {
  ledcWrite(PWM_CHANNEL_A, FORWARD_SPEED);      // Left motor
  ledcWrite(PWM_CHANNEL_B, FORWARD_SPEED - 10); // Right motor slower
}
```

## 📊 Serial Monitor Commands

Watch for these messages:

| Message | Meaning |
|---------|---------|
| `➡️ Moving FORWARD` | Robot moving straight |
| `⬅️ Turning LEFT` | Robot turning left |
| `➡️ Turning RIGHT` | Robot turning right |
| `🛑 STOPPING` | Motors stopped |
| `🧭 Heading updated: X°` | Compass heading sent to Firebase |
| `🧭 New direction: X` | New command received |

## 🚀 Next Steps

1. **Upload the code** to ESP32
2. **Test motor movement** with manual test
3. **Start backend server**
4. **Test with web app** navigation
5. **Fine-tune speeds and turn duration**
6. **Add your custom features** (obstacle avoidance, etc.)

## 💡 Pro Tips

1. **Battery Life:** Lower PWM values = longer battery life
2. **Smooth Turns:** Reduce `TURN_SPEED` for gentler turns
3. **Debug Mode:** Add `Serial.println()` everywhere to track issues
4. **Safety:** Add timeout - stop motors if no Firebase update for 10 seconds

## 📝 Example Full System Test

1. **Power on ESP32** → Watch Serial: WiFi + Firebase connect
2. **Open web app** → Set destination
3. **Click "Start Navigation"** 
4. **Watch Serial Monitor:**
   ```
   🧭 New direction from Firebase: right
   ➡️ Turning RIGHT
   🧭 Heading updated: 90.0°
   🧭 New direction from Firebase: forward
   ➡️ Moving FORWARD
   ```
5. **Robot should move!** 🎉

Need help? Check the serial monitor output and compare with expected messages!
