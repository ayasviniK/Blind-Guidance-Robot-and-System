/*
  ESP32 Adaptive Obstacle Avoidance Robot + Firebase Navigation
  - Uses 3x HC-SR04 via RMT (precise ultrasonic timing)
  - Smooth adaptive motion control
  - Uploads ultrasonic distances to Firebase every second
  - Reads navigation directions from Firebase and follows them
  - Obstacle avoidance overrides navigation when obstacles detected
*/

// ===== LIBRARIES =====
#include <WiFi.h>                // For connecting ESP32 to Wi-Fi
#include <HTTPClient.h>          // For sending HTTP requests (PUT/POST)
#include <WiFiClientSecure.h>    // For HTTPS (secure connection)
#include <ArduinoJson.h>         // For easy creation of JSON data
#include "driver/rmt.h"          // For using ESP32's RMT (Remote Control) hardware — used to time ultrasonic pulses accurately
#include "freertos/FreeRTOS.h"   // For multitasking utilities
#include "freertos/ringbuf.h"    // For ring buffer handling (used with RMT receive)

// ====== WIFI CONFIG ======
const char* WIFI_SSID = "S";               // Wi-Fi network name
const char* WIFI_PASS = "12345678";        // Wi-Fi password

// ====== FIREBASE CONFIG ======
const char* FIREBASE_HOST = "https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app";  // Firebase Realtime Database URL
const char* FIREBASE_AUTH = "DiyaMtH5KLUO59Vf2cfdNfkbkChgC5KSriiZ8Knm";                                  // Firebase database secret key (authentication)

// ====== ULTRASONIC SENSOR PINS ======
#define FRONT_TRIG 25   // Front sensor trigger pin
#define FRONT_ECHO 34   // Front sensor echo pin
#define LEFT_TRIG  27   // Left sensor trigger pin
#define LEFT_ECHO  33   // Left sensor echo pin
#define RIGHT_TRIG 32   // Right sensor trigger pin
#define RIGHT_ECHO 35   // Right sensor echo pin

// ====== MOTOR DRIVER (L298N) PINS ======
#define ENA 22   // Enable pin for right motor (PWM)
#define IN1 19   // Right motor input 1
#define IN2 21   // Right motor input 2
#define ENB 18   // Enable pin for left motor (PWM)
#define IN3 4    // Left motor input 1
#define IN4 5    // Left motor input 2

// ====== RMT CHANNELS ======
// Each ultrasonic sensor echo pin uses a different RMT channel
#define FRONT_CH RMT_CHANNEL_0
#define LEFT_CH  RMT_CHANNEL_1
#define RIGHT_CH RMT_CHANNEL_2

// ====== SPEED SETTINGS ======
int maxSpeed = 255;       // Full speed for motors
int midSpeed = 180;       // Medium speed
int slowSpeed = 120;      // Reduced speed when near obstacles
int turnSpeed = 150;      // Turning speed for left/right maneuvers

// ====== DISTANCE THRESHOLDS ======
int stopDistance = 50;        // Stop completely if obstacle is closer than 50 cm
int slowDownDistance = 100;   // Slow down if obstacle within 100 cm
int sideThreshold = 40;       // If obstacle too close on one side (<40 cm), steer away

// ====== DISTANCE VARIABLES ======
float frontDist = 0;          // Stores front distance
float leftDist  = 0;          // Stores left distance
float rightDist = 0;          // Stores right distance

// ====== NAVIGATION VARIABLES ======
String navigationDirection = "stopped";        // Current navigation direction from Firebase
String previousDirection = "";                 // Previous direction (to detect changes)
unsigned long lastDirectionCheck = 0;          // Timestamp of last Firebase direction check
unsigned long directionCheckInterval = 1000;   // Check navigation direction every 1 second

// ====== TIMING ======
unsigned long lastUpload = 0;         // Timestamp of last Firebase upload
unsigned long uploadInterval = 1000;  // Upload every 1 second

// ====== RMT SETUP FUNCTION ======
void setupRMT(int echoPin, rmt_channel_t ch) {
  rmt_config_t cfg;                          // Create RMT configuration struct
  memset(&cfg, 0, sizeof(cfg));              // Clear all fields
  cfg.rmt_mode = RMT_MODE_RX;                // Set RMT mode to receive
  cfg.channel = ch;                          // Use the specified channel
  cfg.gpio_num = (gpio_num_t)echoPin;        // Assign the echo pin
  cfg.clk_div = 80;                          // Clock divider (1 MHz resolution = 1 µs per tick)
  cfg.mem_block_num = 1;                     // Use one memory block
  cfg.rx_config.filter_en = true;            // Enable input noise filter
  cfg.rx_config.filter_ticks_thresh = 100;   // Ignore pulses shorter than 100 µs
  cfg.rx_config.idle_threshold = 80000;      // Stop after 80 ms of inactivity
  rmt_config(&cfg);                          // Apply configuration
  rmt_driver_install(ch, 2048, 0);           // Install RMT driver and allocate ring buffer
}

// ====== TRIGGER PIN SETUP FUNCTION ======
void setupTrig(int trigPin) {
  pinMode(trigPin, OUTPUT);     // Set trigger pin as output
  digitalWrite(trigPin, LOW);   // Start LOW (idle state)
}

// ====== READ DISTANCE FUNCTION (USING RMT) ======
float readDistance(int trigPin, rmt_channel_t ch) {
  RingbufHandle_t rb = NULL;
  rmt_get_ringbuf_handle(ch, &rb);           // Get ring buffer for the specified RMT channel
  if (!rb) return -1;                        // If no ring buffer, return -1 (error)

  rmt_rx_start(ch, true);                    // Start RMT receiver
  digitalWrite(trigPin, LOW); delayMicroseconds(2);    // Clear trigger
  digitalWrite(trigPin, HIGH); delayMicroseconds(10);  // Send 10 µs pulse
  digitalWrite(trigPin, LOW);                          // Stop trigger

  size_t len = 0;
  // Receive pulse duration data into buffer (timeout 40 ms)
  rmt_item32_t* items = (rmt_item32_t*)xRingbufferReceive(rb, &len, pdMS_TO_TICKS(40));
  float d = -1;                              // Distance result (in cm)

  if (items && len >= sizeof(rmt_item32_t)) {
    size_t count = len / sizeof(rmt_item32_t);
    for (size_t i = 0; i < count; i++) {
      rmt_item32_t it = items[i];            // Get one pulse record
      uint32_t high_us = 0;                  // Variable for high pulse duration
      if (it.level0 == 1 && it.level1 == 0) high_us = it.duration0;   // High pulse first
      else if (it.level0 == 0 && it.level1 == 1) high_us = it.duration1; // High pulse second

      if (high_us > 0) {
        float cm = high_us * 0.034f / 2.0f;  // Convert time to distance (speed of sound: 0.034 cm/µs)
        if (cm >= 2 && cm <= 400) {          // Valid range for HC-SR04
          d = cm; break;                     // Save and exit loop
        }
      }
    }
    vRingbufferReturnItem(rb, (void*)items); // Return buffer memory
  }
  rmt_rx_stop(ch);                           // Stop RMT receiving
  return d;                                  // Return measured distance in cm
}

// ====== MOTOR CONTROL FUNCTIONS ======
void setMotor(int leftSpeed, int rightSpeed) {
  // --- LEFT MOTOR ---
  if (leftSpeed > 0) { digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW); }       // Forward
  else if (leftSpeed < 0) { digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH); }  // Reverse
  else { digitalWrite(IN3, LOW); digitalWrite(IN4, LOW); }                      // Stop

  // --- RIGHT MOTOR ---
  if (rightSpeed > 0) { digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW); }      // Forward
  else if (rightSpeed < 0) { digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH); } // Reverse
  else { digitalWrite(IN1, LOW); digitalWrite(IN2, LOW); }                      // Stop

  // Control motor speed using PWM (analogWrite)
  analogWrite(ENB, abs(leftSpeed));     // Left motor speed
  analogWrite(ENA, abs(rightSpeed));    // Right motor speed
}

// Helper shortcuts for direction control
void stopMotors() { setMotor(0, 0); }                           // Stop both motors
void moveForward(int speed) { setMotor(speed, speed); }          // Move forward
void turnLeft(int speed) { setMotor(-speed / 2, speed); }        // Turn left (right motor faster)
void turnRight(int speed) { setMotor(speed, -speed / 2); }       // Turn right (left motor faster)
void moveBackward(int speed) { setMotor(-speed, -speed); }       // Move backward

// ====== READ NAVIGATION DIRECTION FROM FIREBASE ======
void readNavigationDirection() {
  if (WiFi.status() != WL_CONNECTED) return;  // Skip if not connected to Wi-Fi

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  // Get navigation direction from Firebase
  String url = String(FIREBASE_HOST) + "/devices/esp32B/navigation_direction/direction.json?auth=" + FIREBASE_AUTH;
  http.begin(client, url);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {  // Success
    String payload = http.getString();
    payload.trim();
    payload.replace("\"", "");  // Remove quotes from JSON string
    
    if (payload.length() > 0 && payload != "null") {
      navigationDirection = payload;
      
      // Only log when direction changes
      if (navigationDirection != previousDirection) {
        Serial.print("🧭 Navigation Direction: ");
        Serial.println(navigationDirection);
        previousDirection = navigationDirection;
      }
    }
  } else if (httpCode != 404) {  // Ignore "not found" errors
    Serial.printf("⚠️ Failed to read direction: %d\n", httpCode);
  }
  
  http.end();
}

// ====== MAIN DECISION LOGIC (WITH NAVIGATION) ======
void navigate() {
  // --- CHECK FOR FREE SPACE (WHEN SENSORS CAN'T DETECT OBSTACLES) ---
  // If sensors read -1 (no echo) or very far (>300cm), it means free space
  bool frontFree = (frontDist < 0 || frontDist > 300);
  bool leftFree = (leftDist < 0 || leftDist > 300);
  bool rightFree = (rightDist < 0 || rightDist > 300);
  
  // If front is free (no obstacles detected), go forward
  if (frontFree) {
    Serial.println("🟢 Free space ahead — moving FORWARD");
    moveForward(maxSpeed);
    return;  // Skip other logic, just go forward
  }
  
  // --- OBSTACLE AVOIDANCE (HIGHEST PRIORITY) ---
  // If obstacle detected, obstacle avoidance overrides navigation
  
  if (frontDist < stopDistance) {                       // Too close to obstacle
    Serial.println("🟥 Obstacle too close! STOP");
    stopMotors();                                       // Immediately stop
    delay(100);
    moveBackward(120);                                  // Move slightly backward
    delay(250);
    stopMotors();                                       // Stop again
    return;  // Skip navigation commands
  } 
  else if (frontDist < slowDownDistance) {              // Obstacle ahead but not too close
    Serial.println("🟧 Approaching obstacle — slow down");
    
    // Still follow navigation direction but at reduced speed
    if (navigationDirection == "forward") {
      moveForward(slowSpeed);                           // Reduce speed
    } else if (navigationDirection == "left") {
      turnLeft(slowSpeed);
    } else if (navigationDirection == "right") {
      turnRight(slowSpeed);
    }
  } 
  else {
    // --- NO IMMEDIATE OBSTACLE - FOLLOW NAVIGATION DIRECTION ---
    if (navigationDirection == "forward") {
      moveForward(maxSpeed);                            // Full speed forward
    } 
    else if (navigationDirection == "left") {
      Serial.println("↩️ Navigation: Turning LEFT");
      turnLeft(turnSpeed);
      delay(150);
    } 
    else if (navigationDirection == "right") {
      Serial.println("↪️ Navigation: Turning RIGHT");
      turnRight(turnSpeed);
      delay(150);
    } 
    else if (navigationDirection == "stopped" || navigationDirection == "arrived") {
      Serial.println("🛑 Navigation: STOPPED");
      stopMotors();
      return;  // Don't continue with side avoidance
    }
  }

  // --- SIDE AVOIDANCE LOGIC (SECONDARY PRIORITY) ---
  if (leftDist < sideThreshold && rightDist >= sideThreshold) { // Too close on left side only
    Serial.println("↪️ Too close on LEFT — steering RIGHT");
    turnRight(turnSpeed);
    delay(150);
  } 
  else if (rightDist < sideThreshold && leftDist >= sideThreshold) { // Too close on right side only
    Serial.println("↩️ Too close on RIGHT — steering LEFT");
    turnLeft(turnSpeed);
    delay(150);
  }
}

// ====== FIREBASE UPLOAD FUNCTION ======
void uploadToFirebase(float f, float l, float r) {
  if (WiFi.status() != WL_CONNECTED) return;        // Skip if not connected to Wi-Fi

  WiFiClientSecure client;                          // Create secure Wi-Fi client
  client.setInsecure();                             // Skip SSL certificate check (for simplicity)
  HTTPClient http;                                  // Create HTTP client for PUT request

  // Construct Firebase URL and include authentication
  String url = String(FIREBASE_HOST) + "/devices/esp32B/sensors.json?auth=" + FIREBASE_AUTH;
  http.begin(client, url);                          // Begin HTTPS connection

  // Create JSON payload
  StaticJsonDocument<200> doc;                      // JSON document with up to 200 bytes
  doc["front"] = f;                                 // Front distance
  doc["left"] = l;                                  // Left distance
  doc["right"] = r;                                 // Right distance
  doc["timestamp"] = millis();                      // Timestamp in ms

  String body;
  serializeJson(doc, body);                         // Convert JSON object to string

  http.addHeader("Content-Type", "application/json");  // Set header
  int code = http.PUT(body);                        // Send HTTP PUT with JSON body

  // Check result
  if (code > 0) Serial.printf("📤 Firebase upload: %d\n", code);   // Success (code 200 = OK)
  else Serial.printf("❌ Upload failed: %s\n", http.errorToString(code).c_str()); // Error message

  http.end();                                       // Close connection
}

// ====== SETUP FUNCTION ======
void setup() {
  Serial.begin(115200);  // Start serial monitor for debugging
  Serial.println("🤖 Adaptive Obstacle Avoidance Robot + Firebase Navigation Starting...");

  // --- Connect to Wi-Fi ---
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {  // Wait until connected
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ Wi-Fi connected!"); // Print success message

  // --- Setup Ultrasonic Sensors ---
  setupTrig(FRONT_TRIG);
  setupTrig(LEFT_TRIG);
  setupTrig(RIGHT_TRIG);
  setupRMT(FRONT_ECHO, FRONT_CH);
  setupRMT(LEFT_ECHO, LEFT_CH);
  setupRMT(RIGHT_ECHO, RIGHT_CH);

  // --- Setup Motor Pins ---
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  stopMotors();          // Ensure motors are stopped at startup
  delay(1000);           // Wait 1 second before starting
  
  Serial.println("📡 Ready to receive navigation directions from Firebase...");
}

// ====== MAIN LOOP ======
void loop() {
  // --- Read navigation direction from Firebase every second ---
  if (millis() - lastDirectionCheck > directionCheckInterval) {
    readNavigationDirection();
    lastDirectionCheck = millis();
  }
  
  // --- Measure distances ---
  leftDist  = readDistance(LEFT_TRIG, LEFT_CH);   // Get left sensor distance
  delay(50);
  frontDist = readDistance(FRONT_TRIG, FRONT_CH); // Get front sensor distance
  delay(50);
  rightDist = readDistance(RIGHT_TRIG, RIGHT_CH); // Get right sensor distance

  // --- Print distances for debugging ---
  Serial.printf("📏 F: %.1f | L: %.1f | R: %.1f cm | Dir: %s\n", 
                frontDist, leftDist, rightDist, navigationDirection.c_str());

  // --- Navigate based on sensor readings AND Firebase direction ---
  navigate();

  // --- Upload distances to Firebase every 1 second ---
  if (millis() - lastUpload > uploadInterval) {
    uploadToFirebase(frontDist, leftDist, rightDist);
    lastUpload = millis();
  }

  delay(100);  // Short delay to avoid overloading CPU
}
