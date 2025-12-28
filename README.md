# 🧭 The Guiding Robot
### An Assistive Navigation System for Real-Time Obstacle Detection and Path Guidance

## 📌 Overview
The Guiding Robot is an assistive navigation device designed to support visually impaired users through real-time obstacle detection, adaptive movement, and voice-guided navigation. The system combines embedded hardware, sensor fusion, on-device vision AI, and a mobile application to deliver safe and intuitive navigation in real-world environments.

This project was developed as an academic–professional prototype with a strong focus on reliability, modularity, and real-time decision-making.

## 🧠 System Architecture
The system follows a distributed architecture using two ESP32-based controllers:
ESP32 (Base Unit)
>Handles obstacle detection, motor control, and real-time navigation decisions.

ESP32-CAM (Vision Unit)
>Performs image-based obstacle recognition using Google’s on-device vision APIs.

Both controllers communicate through Firebase Realtime Database, enabling synchronized decision-making and scalability.

## 🔧 Hardware Components
ESP32 Dev Module (Base Controller)

ESP32-CAM Module (Vision Processing)

HC-SR04 Ultrasonic Sensors (Front, Left, Right)

L298N Motor Driver

DC Motors & Chassis

Power Supply Module

## 🤖 Core Features
Real-time obstacle detection using ultrasonic sensors

Image-based obstacle recognition via on-device vision AI

Continuous movement with adaptive turning (no stop-and-check logic)

Path deviation handling with automatic return-to-original direction

Dual ESP32 communication via Firebase

#### Mobile application integration with:
Google Maps navigation

Voice-assisted turn-by-turn guidance

Modular design allowing future IMU integration

## 🧩 Navigation Logic (Base Unit)
Continuously reads ultrasonic sensor data while moving

Calculates obstacle proximity dynamically

Adjusts turning angle and speed proportionally

Avoids obstacles without halting movement

Gradually realigns with the original path after clearance

#### This logic ensures smooth, human-like navigation suitable for real-world usage.

## 🌐 Communication & Cloud
Firebase Realtime Database

Sensor data synchronization

Inter-ESP32 communication

Status monitoring for mobile app

ESP-NOW

Low-latency local communication between controllers

## 📱 Mobile Application
Google Maps–based routing

Voice-based destination input
#### Audio feedback for:
Turns (left/right/forward)

Detected obstacles (people, objects, bending posture, etc.)

Hands-free interaction via connected earpiece

## 🚀 Future Improvements
IMU-based orientation correction

Enhanced sensor fusion (vision + distance confidence scoring)

Improved outdoor robustness

Custom lightweight object detection models
