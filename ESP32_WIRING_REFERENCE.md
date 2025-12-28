# ESP32 Motor Wiring Quick Reference

## 🔌 L298N Motor Driver Connections

```
ESP32 Pin    →    L298N Pin    →    Function
─────────────────────────────────────────────
GPIO 26      →    IN1          →    Left Motor Dir 1
GPIO 27      →    IN2          →    Left Motor Dir 2
GPIO 14      →    ENA          →    Left Motor Speed (PWM)

GPIO 25      →    IN3          →    Right Motor Dir 1
GPIO 33      →    IN4          →    Right Motor Dir 2
GPIO 32      →    ENB          →    Right Motor Speed (PWM)

GND          →    GND          →    Common Ground
```

## 🔋 Power Connections

```
L298N Motor Driver:
- 12V Input → Connect to battery (+)
- GND → Connect to battery (-) AND ESP32 GND
- 5V Output → Can power ESP32 (optional)

Motors:
- Motor A → OUT1 & OUT2 (Left Motor)
- Motor B → OUT3 & OUT4 (Right Motor)
```

## ⚙️ Motor Driver Jumpers

```
L298N Jumpers:
✅ Keep ENA jumper ON (for PWM speed control)
✅ Keep ENB jumper ON (for PWM speed control)
```

## 📝 Copy-Paste Pin Configuration

For your existing motor code, update to these pins:

```cpp
// Motor A (Left Motor)
int leftMotorPin1 = 26;   // IN1
int leftMotorPin2 = 27;   // IN2
int leftMotorPWM = 14;    // ENA

// Motor B (Right Motor)
int rightMotorPin1 = 25;  // IN3
int rightMotorPin2 = 33;  // IN4
int rightMotorPWM = 32;   // ENB
```

## 🧭 Optional: Magnetometer (HMC5883L)

```
ESP32 Pin    →    HMC5883L Pin
──────────────────────────────
GPIO 21      →    SDA
GPIO 22      →    SCL
3.3V         →    VCC
GND          →    GND
```

## 🧪 Quick Test Sketch

```cpp
// Test if motors work
void setup() {
  pinMode(26, OUTPUT);
  pinMode(27, OUTPUT);
  pinMode(14, OUTPUT);
  
  // Move forward for 2 seconds
  digitalWrite(26, HIGH);
  digitalWrite(27, LOW);
  analogWrite(14, 200);
  delay(2000);
  
  // Stop
  digitalWrite(26, LOW);
  digitalWrite(27, LOW);
  analogWrite(14, 0);
}

void loop() {}
```

## 🎯 Motor Direction Troubleshooting

If motor goes backwards when it should go forward, swap two wires:
```
Problem: Left motor backwards
Solution: Swap wires on OUT1 and OUT2

Problem: Right motor backwards  
Solution: Swap wires on OUT3 and OUT4
```

OR change in code:
```cpp
// Original
digitalWrite(MOTOR_A_IN1, HIGH);  // Forward
digitalWrite(MOTOR_A_IN2, LOW);

// Reversed
digitalWrite(MOTOR_A_IN1, LOW);   // Forward (swapped)
digitalWrite(MOTOR_A_IN2, HIGH);
```
