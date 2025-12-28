/*
  ESP32 Robot Navigation with Firebase Control
  - Reads navigation commands from Firebase
  - Publishes sensor data every 1 second
  - Supports both manual and autonomous control
  - Non-blocking motor execution
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ====== WIFI CONFIG ======
const char* WIFI_SSID = "Sanath";
const char* WIFI_PASS = "Beetle-1302";

// ====== FIREBASE CONFIG ======
const char* FIREBASE_HOST = "https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* FIREBASE_AUTH = "DiyaMtH5KLUO59Vf2cfdNfkbkChgC5KSriiZ8Knm";

// ====== ULTRASONIC PINS ======
#define FRONT_TRIG 32
#define FRONT_ECHO 34
#define RIGHT_TRIG 27
#define RIGHT_ECHO 39
#define LEFT_TRIG 13
#define LEFT_ECHO 33

// ====== L298N MOTOR DRIVER ======
#define ENA 22  // Right Motor Enable
#define IN1 19
#define IN2 21
#define ENB 18  // Left Motor Enable
#define IN3 4
#define IN4 5

// ====== MOTOR SETTINGS ======
int baseSpeed = 90;      // forward speed
int turnSpeed = 110;     // turning speed
int backwardSpeed = 80;  // backward speed

// ====== CONTROL MODE ======
String currentCommand = "stop";
unsigned long commandTimestamp = 0;
unsigned long lastCommandCheck = 0;
unsigned long commandTimeout = 5000;  // Stop if no new command for 5 seconds

// ====== TIMING ======
unsigned long lastFirebaseUpdate = 0;
unsigned long lastSensorRead = 0;
unsigned long lastCommandFetch = 0;

// ====== SENSOR DATA ======
long frontDistance = 0;
long leftDistance = 0;
long rightDistance = 0;

// ====== ULTRASONIC FUNCTION ======
long getDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 25000);  // faster timeout
  long distance = duration * 0.034 / 2;
  if (distance == 0 || distance > 400) distance = 400;
  return distance;
}

// ====== MOTOR CONTROL FUNCTIONS ======
void setMotor(int leftSpeed, int rightSpeed) {
  // Left motor (ENB, IN3, IN4)
  if (leftSpeed > 0) {
    digitalWrite(IN3, HIGH);
    digitalWrite(IN4, LOW);
  } else if (leftSpeed < 0) {
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, HIGH);
  } else {
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, LOW);
  }
  
  // Right motor (ENA, IN1, IN2)
  if (rightSpeed > 0) {
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
  } else if (rightSpeed < 0) {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, HIGH);
  } else {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
  }

  analogWrite(ENB, abs(leftSpeed));
  analogWrite(ENA, abs(rightSpeed));
}

void stopMotors() { 
  setMotor(0, 0); 
  Serial.println("🛑 Motors STOPPED");
}

void moveForward() { 
  setMotor(baseSpeed, baseSpeed); 
  Serial.println("⬆️ Moving FORWARD");
}

void moveBackward() { 
  setMotor(-backwardSpeed, -backwardSpeed); 
  Serial.println("⬇️ Moving BACKWARD");
}

void turnLeft() { 
  setMotor(-turnSpeed / 2, turnSpeed); 
  Serial.println("⬅️ Turning LEFT");
}

void turnRight() { 
  setMotor(turnSpeed, -turnSpeed / 2); 
  Serial.println("➡️ Turning RIGHT");
}

// ====== EXECUTE MOTOR COMMAND ======
void executeCommand(String command) {
  if (command == "forward") {
    moveForward();
  } else if (command == "backward") {
    moveBackward();
  } else if (command == "left") {
    turnLeft();
  } else if (command == "right") {
    turnRight();
  } else if (command == "stop") {
    stopMotors();
  } else {
    Serial.println("⚠️ Unknown command: " + command);
  }
}

// ====== FETCH MOTOR COMMAND FROM FIREBASE ======
void fetchMotorCommand() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String path = "/devices/esp32B/motor_command.json";
  String url = String(FIREBASE_HOST) + path + "?auth=" + FIREBASE_AUTH;

  if (https.begin(client, url)) {
    int httpCode = https.GET();
    
    if (httpCode == HTTP_CODE_OK) {
      String payload = https.getString();
      
      // Parse JSON
      StaticJsonDocument<200> doc;
      DeserializationError error = deserializeJson(doc, payload);
      
      if (!error) {
        String newCommand = doc["command"].as<String>();
        unsigned long newTimestamp = doc["timestamp"].as<unsigned long>();
        
        // Only execute if it's a new command
        if (newTimestamp > commandTimestamp) {
          Serial.printf("🤖 New command: %s (timestamp: %lu)\n", newCommand.c_str(), newTimestamp);
          currentCommand = newCommand;
          commandTimestamp = newTimestamp;
          executeCommand(currentCommand);
          lastCommandCheck = millis();
        }
      } else {
        Serial.println("❌ JSON parse error");
      }
    } else if (httpCode == HTTP_CODE_NOT_FOUND) {
      // No command yet, that's okay
      if (currentCommand != "stop") {
        Serial.println("ℹ️ No command found, stopping");
        currentCommand = "stop";
        stopMotors();
      }
    }
    
    https.end();
  } else {
    Serial.println("❌ Failed to connect to Firebase");
  }
}

// ====== PUBLISH SENSOR DATA TO FIREBASE ======
void publishSensorData() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  // Publish sensor readings
  String path = "/devices/esp32B/sensors.json";
  String payload = "{";
  payload += "\"front\":" + String(frontDistance) + ",";
  payload += "\"left\":" + String(leftDistance) + ",";
  payload += "\"right\":" + String(rightDistance) + ",";
  payload += "\"timestamp\":" + String(millis());
  payload += "}";
  
  String url = String(FIREBASE_HOST) + path + "?auth=" + FIREBASE_AUTH;

  if (https.begin(client, url)) {
    https.addHeader("Content-Type", "application/json");
    int code = https.PUT(payload);
    Serial.printf("📡 Sensors published -> HTTP %d\n", code);
    https.end();
  }

  // Publish status
  String statePath = "/devices/esp32B/status.json";
  String stateJson = "{";
  stateJson += "\"state\":\"" + currentCommand + "\",";
  stateJson += "\"sev\":" + String(frontDistance < 30 ? 200 : (frontDistance < 50 ? 100 : 0)) + ",";
  stateJson += "\"timestamp\":" + String(millis());
  stateJson += "}";
  
  if (https.begin(client, String(FIREBASE_HOST) + statePath + "?auth=" + FIREBASE_AUTH)) {
    https.addHeader("Content-Type", "application/json");
    int code = https.PUT(stateJson);
    Serial.printf("📊 Status published -> HTTP %d\n", code);
    https.end();
  }
}

// ====== SETUP ======
void setup() {
  Serial.begin(115200);
  Serial.println("\n🤖 ESP32 Robot Navigation System Starting...");
  
  // Initialize ultrasonic sensors
  pinMode(FRONT_TRIG, OUTPUT); 
  pinMode(FRONT_ECHO, INPUT);
  pinMode(LEFT_TRIG, OUTPUT); 
  pinMode(LEFT_ECHO, INPUT);
  pinMode(RIGHT_TRIG, OUTPUT); 
  pinMode(RIGHT_ECHO, INPUT);
  
  // Initialize motor pins
  pinMode(ENA, OUTPUT); 
  pinMode(IN1, OUTPUT); 
  pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT); 
  pinMode(IN3, OUTPUT); 
  pinMode(IN4, OUTPUT);
  
  // Start with motors stopped
  stopMotors();

  // Connect to WiFi
  Serial.printf("🌐 Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
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
    Serial.println("\n❌ WiFi connection failed!");
  }
  
  Serial.println("🚀 Robot Navigation System Ready!");
  Serial.println("📡 Listening for commands from Firebase...");
}

// ====== MAIN LOOP ======
void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi disconnected, reconnecting...");
    WiFi.reconnect();
    delay(1000);
    return;
  }

  // ---- READ SENSORS (every 100ms) ----
  if (millis() - lastSensorRead >= 100) {
    leftDistance = getDistance(LEFT_TRIG, LEFT_ECHO);
    delayMicroseconds(200);
    frontDistance = getDistance(FRONT_TRIG, FRONT_ECHO);
    delayMicroseconds(200);
    rightDistance = getDistance(RIGHT_TRIG, RIGHT_ECHO);
    lastSensorRead = millis();

    // Print sensor readings (less frequently to reduce spam)
    static unsigned long lastPrint = 0;
    if (millis() - lastPrint >= 2000) {
      Serial.printf("📏 Sensors -> Front: %ldcm | Left: %ldcm | Right: %ldcm\n", 
                    frontDistance, leftDistance, rightDistance);
      lastPrint = millis();
    }
  }

  // ---- FETCH MOTOR COMMANDS (every 500ms) ----
  if (millis() - lastCommandFetch >= 500) {
    fetchMotorCommand();
    lastCommandFetch = millis();
  }

  // ---- COMMAND TIMEOUT CHECK ----
  // If no new command for 5 seconds and currently moving, stop for safety
  if (millis() - lastCommandCheck > commandTimeout && currentCommand != "stop") {
    Serial.println("⏱️ Command timeout - stopping for safety");
    currentCommand = "stop";
    stopMotors();
  }

  // ---- PUBLISH TO FIREBASE (every 1 second) ----
  if (millis() - lastFirebaseUpdate >= 1000) {
    publishSensorData();
    lastFirebaseUpdate = millis();
  }

  // Small delay to prevent overwhelming the system
  delay(10);
}
