/*
 * ESP32 Robot Motor Controller with Firebase Navigation
 * 
 * This code integrates with the Guiding Robot system to:
 * 1. Read navigation directions from Firebase (/devices/esp32B/navigation_direction)
 * 2. Control robot motors based on directions (forward, left, right, stopped)
 * 3. Read heading from magnetometer and update Firebase
 * 4. Provide autonomous navigation following Firebase commands
 * 
 * Firebase Structure:
 * /devices/esp32B/navigation_direction/direction: "forward"|"left"|"right"|"stopped"|"arrived"
 * /devices/esp32B/heading: <degrees 0-360>
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_HMC5883_U.h>  // Magnetometer for heading

// Provide the token generation process info
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions
#include "addons/RTDBHelper.h"

// ===========================
// WiFi Credentials
// ===========================
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// ===========================
// Firebase Configuration
// ===========================
#define API_KEY "AIzaSyD5FgSjod88Z0uVDWzJqZxkPHrOi9rB6ng"
#define DATABASE_URL "https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app"

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ===========================
// Motor Pin Configuration
// ===========================
// Left Motor (Motor A)
#define MOTOR_A_IN1 26  // Left motor direction pin 1
#define MOTOR_A_IN2 27  // Left motor direction pin 2
#define MOTOR_A_PWM 14  // Left motor speed (PWM)

// Right Motor (Motor B)
#define MOTOR_B_IN3 25  // Right motor direction pin 1
#define MOTOR_B_IN4 33  // Right motor direction pin 2
#define MOTOR_B_PWM 32  // Right motor speed (PWM)

// PWM Configuration
const int PWM_FREQ = 5000;      // 5 kHz PWM frequency
const int PWM_RESOLUTION = 8;   // 8-bit resolution (0-255)
const int PWM_CHANNEL_A = 0;    // PWM channel for motor A
const int PWM_CHANNEL_B = 1;    // PWM channel for motor B

// ===========================
// Motor Speed Settings
// ===========================
const int FORWARD_SPEED = 200;   // Speed when moving forward (0-255)
const int TURN_SPEED = 150;      // Speed when turning (0-255)
const int TURN_DURATION = 500;   // How long to turn (milliseconds)

// ===========================
// Magnetometer (HMC5883L)
// ===========================
Adafruit_HMC5883_Unified mag = Adafruit_HMC5883_Unified(12345);
float currentHeading = 0.0;

// ===========================
// Navigation Variables
// ===========================
String currentDirection = "stopped";
String previousDirection = "";
unsigned long lastDirectionCheck = 0;
const unsigned long DIRECTION_CHECK_INTERVAL = 1000;  // Check Firebase every 1 second

unsigned long lastHeadingUpdate = 0;
const unsigned long HEADING_UPDATE_INTERVAL = 2000;   // Update heading every 2 seconds

bool signupOK = false;

// ===========================
// Function Declarations
// ===========================
void setupWiFi();
void setupFirebase();
void setupMotors();
void setupMagnetometer();
void readNavigationDirection();
void updateHeading();
void executeDirection(String direction);
void moveForward();
void turnLeft();
void turnRight();
void stopMotors();
float calculateHeading();

// ===========================
// SETUP
// ===========================
void setup() {
  Serial.begin(115200);
  Serial.println("🤖 ESP32 Robot Motor Controller Starting...");

  // Setup components
  setupWiFi();
  setupFirebase();
  setupMotors();
  setupMagnetometer();

  Serial.println("✅ ESP32 Robot Ready!");
  Serial.println("📡 Listening for navigation directions from Firebase...");
}

// ===========================
// MAIN LOOP
// ===========================
void loop() {
  unsigned long currentMillis = millis();

  // Check for new navigation directions from Firebase
  if (currentMillis - lastDirectionCheck >= DIRECTION_CHECK_INTERVAL) {
    lastDirectionCheck = currentMillis;
    readNavigationDirection();
  }

  // Update heading to Firebase
  if (currentMillis - lastHeadingUpdate >= HEADING_UPDATE_INTERVAL) {
    lastHeadingUpdate = currentMillis;
    updateHeading();
  }
}

// ===========================
// WiFi Setup
// ===========================
void setupWiFi() {
  Serial.print("📶 Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected!");
    Serial.print("📍 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ WiFi Connection Failed!");
  }
}

// ===========================
// Firebase Setup
// ===========================
void setupFirebase() {
  Serial.println("🔥 Setting up Firebase...");

  // Assign the api key
  config.api_key = API_KEY;

  // Assign the RTDB URL
  config.database_url = DATABASE_URL;

  // Sign up (anonymous)
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("✅ Firebase Authentication OK");
    signupOK = true;
  } else {
    Serial.printf("❌ Firebase signup error: %s\n", config.signer.signupError.message.c_str());
  }

  // Assign the callback function for the long running token generation task
  config.token_status_callback = tokenStatusCallback;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("✅ Firebase Ready!");
}

// ===========================
// Motor Setup
// ===========================
void setupMotors() {
  Serial.println("🔧 Setting up motors...");

  // Configure motor pins as outputs
  pinMode(MOTOR_A_IN1, OUTPUT);
  pinMode(MOTOR_A_IN2, OUTPUT);
  pinMode(MOTOR_B_IN3, OUTPUT);
  pinMode(MOTOR_B_IN4, OUTPUT);

  // Setup PWM channels
  ledcSetup(PWM_CHANNEL_A, PWM_FREQ, PWM_RESOLUTION);
  ledcSetup(PWM_CHANNEL_B, PWM_FREQ, PWM_RESOLUTION);

  // Attach PWM channels to pins
  ledcAttachPin(MOTOR_A_PWM, PWM_CHANNEL_A);
  ledcAttachPin(MOTOR_B_PWM, PWM_CHANNEL_B);

  // Initialize motors in stopped state
  stopMotors();

  Serial.println("✅ Motors configured!");
}

// ===========================
// Magnetometer Setup
// ===========================
void setupMagnetometer() {
  Serial.println("🧭 Setting up magnetometer...");

  if (!mag.begin()) {
    Serial.println("⚠️ No HMC5883L magnetometer detected. Heading will be 0.");
    Serial.println("ℹ️  Robot will still work, but heading won't be accurate.");
  } else {
    Serial.println("✅ Magnetometer ready!");
  }
}

// ===========================
// Read Navigation Direction from Firebase
// ===========================
void readNavigationDirection() {
  if (Firebase.ready() && signupOK) {
    if (Firebase.RTDB.getString(&fbdo, "/devices/esp32B/navigation_direction/direction")) {
      if (fbdo.dataType() == "string") {
        currentDirection = fbdo.stringData();
        
        // Only execute if direction changed
        if (currentDirection != previousDirection) {
          Serial.print("🧭 New direction from Firebase: ");
          Serial.println(currentDirection);
          
          executeDirection(currentDirection);
          previousDirection = currentDirection;
        }
      }
    } else {
      // No direction set yet or error
      if (fbdo.httpCode() != 404) {  // Ignore "not found" errors
        Serial.print("⚠️ Firebase read error: ");
        Serial.println(fbdo.errorReason());
      }
    }
  }
}

// ===========================
// Update Heading to Firebase
// ===========================
void updateHeading() {
  currentHeading = calculateHeading();
  
  if (Firebase.ready() && signupOK) {
    if (Firebase.RTDB.setFloat(&fbdo, "/devices/esp32B/heading", currentHeading)) {
      Serial.print("🧭 Heading updated: ");
      Serial.print(currentHeading);
      Serial.println("°");
    } else {
      Serial.print("⚠️ Heading update failed: ");
      Serial.println(fbdo.errorReason());
    }
  }
}

// ===========================
// Calculate Heading from Magnetometer
// ===========================
float calculateHeading() {
  sensors_event_t event;
  mag.getEvent(&event);

  // Calculate heading from magnetometer
  float heading = atan2(event.magnetic.y, event.magnetic.x);
  
  // Convert to degrees
  float headingDegrees = heading * 180 / PI;
  
  // Normalize to 0-360
  if (headingDegrees < 0) {
    headingDegrees += 360;
  }
  
  return headingDegrees;
}

// ===========================
// Execute Navigation Direction
// ===========================
void executeDirection(String direction) {
  direction.toLowerCase();
  
  if (direction == "forward") {
    Serial.println("➡️ Moving FORWARD");
    moveForward();
  } 
  else if (direction == "left") {
    Serial.println("⬅️ Turning LEFT");
    turnLeft();
  } 
  else if (direction == "right") {
    Serial.println("➡️ Turning RIGHT");
    turnRight();
  } 
  else if (direction == "stopped" || direction == "arrived") {
    Serial.println("🛑 STOPPING");
    stopMotors();
  }
  else {
    Serial.print("⚠️ Unknown direction: ");
    Serial.println(direction);
    stopMotors();
  }
}

// ===========================
// Move Forward
// ===========================
void moveForward() {
  // Left motor forward
  digitalWrite(MOTOR_A_IN1, HIGH);
  digitalWrite(MOTOR_A_IN2, LOW);
  ledcWrite(PWM_CHANNEL_A, FORWARD_SPEED);

  // Right motor forward
  digitalWrite(MOTOR_B_IN3, HIGH);
  digitalWrite(MOTOR_B_IN4, LOW);
  ledcWrite(PWM_CHANNEL_B, FORWARD_SPEED);
}

// ===========================
// Turn Left
// ===========================
void turnLeft() {
  // Left motor backward (slower)
  digitalWrite(MOTOR_A_IN1, LOW);
  digitalWrite(MOTOR_A_IN2, HIGH);
  ledcWrite(PWM_CHANNEL_A, TURN_SPEED);

  // Right motor forward
  digitalWrite(MOTOR_B_IN3, HIGH);
  digitalWrite(MOTOR_B_IN4, LOW);
  ledcWrite(PWM_CHANNEL_B, TURN_SPEED);

  // Turn for specified duration then go forward
  delay(TURN_DURATION);
  moveForward();
}

// ===========================
// Turn Right
// ===========================
void turnRight() {
  // Left motor forward
  digitalWrite(MOTOR_A_IN1, HIGH);
  digitalWrite(MOTOR_A_IN2, LOW);
  ledcWrite(PWM_CHANNEL_A, TURN_SPEED);

  // Right motor backward (slower)
  digitalWrite(MOTOR_B_IN3, LOW);
  digitalWrite(MOTOR_B_IN4, HIGH);
  ledcWrite(PWM_CHANNEL_B, TURN_SPEED);

  // Turn for specified duration then go forward
  delay(TURN_DURATION);
  moveForward();
}

// ===========================
// Stop Motors
// ===========================
void stopMotors() {
  // Stop left motor
  digitalWrite(MOTOR_A_IN1, LOW);
  digitalWrite(MOTOR_A_IN2, LOW);
  ledcWrite(PWM_CHANNEL_A, 0);

  // Stop right motor
  digitalWrite(MOTOR_B_IN3, LOW);
  digitalWrite(MOTOR_B_IN4, LOW);
  ledcWrite(PWM_CHANNEL_B, 0);
}
