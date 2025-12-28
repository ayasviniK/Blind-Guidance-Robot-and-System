# Guiding Robot Web Application

A real-time control panel for managing and monitoring an IoT-based guiding robot with live camera feed, GPS tracking, navigation controls, and voice commands powered by Firebase and Google Gemini AI.

## Features

- 🎥 **Live Camera Feed** - Real-time video streaming from robot camera
- 🗺️ **GPS Tracking** - Live location tracking with map integration
- 🎮 **Navigation Controls** - Intuitive directional controls (Forward, Backward, Left, Right, Stop)
- 🎤 **Voice Commands** - Speech recognition and AI-powered command processing
- 🔊 **Text-to-Speech** - Audio feedback and navigation instructions
- 📊 **Robot Status** - Battery level, connectivity, and system health monitoring
- 🔥 **Firebase Integration** - Real-time database sync
- 🤖 **Gemini AI** - Intelligent command interpretation and navigation assistance

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Build Tool**: Vite 7
- **Backend**: Firebase Realtime Database
- **AI**: Google Gemini AI
- **APIs**:
  - Web Speech API (Speech Recognition)
  - Speech Synthesis API (Text-to-Speech)
  - Geolocation API

## Prerequisites

- Node.js 18+ and npm/yarn
- Firebase account and project
- Google Gemini API key
- Modern web browser (Chrome, Edge, Safari recommended for best compatibility)

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd guiding-robot-webapp
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your configuration:

   ```env
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_DATABASE_URL=https://your_project_id.firebaseio.com

   # Gemini AI Configuration
   VITE_GEMINI_API_KEY=your_gemini_api_key

   # Robot Configuration
   VITE_ROBOT_STREAM_URL=http://your-robot-ip:8080/stream
   ```

## Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Realtime Database
3. Set up database rules:
   ```json
   {
     "rules": {
       "robot": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```
4. Copy your Firebase configuration to `.env`

## Gemini AI Setup

1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add it to `.env` as `VITE_GEMINI_API_KEY`

## Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── CameraFeed.tsx      # Live video stream component
│   ├── Navigation.tsx      # Robot navigation controls
│   ├── GPSTracker.tsx      # GPS tracking and map display
│   └── AudioControls.tsx   # Voice commands and audio
├── config/
│   ├── firebase.ts         # Firebase configuration
│   └── gemini.ts           # Gemini AI configuration
├── types/
│   └── index.ts            # TypeScript type definitions
├── App.tsx                 # Main application component
├── App.css                 # Application styles
├── index.css               # Global styles
└── main.tsx                # Application entry point
```

## Features Guide

### Navigation Controls

Use the directional buttons to control robot movement:

- **Forward** - Move forward
- **Backward** - Move backward
- **Left** - Turn left
- **Right** - Turn right
- **Stop** - Emergency stop

### Voice Commands

Click "Start Listening" and speak commands like:

- "Move forward"
- "Turn left"
- "Stop"
- "Navigate to [location]"
- "What's my current location?"

### GPS Tracking

- View real-time GPS coordinates
- Set destination addresses
- Open location in Google Maps
- Copy coordinates to clipboard

### Camera Feed

- Live video stream from robot
- Fullscreen mode
- Connection status indicator

## Browser Compatibility

| Feature        | Chrome | Edge | Safari | Firefox |
| -------------- | ------ | ---- | ------ | ------- |
| Camera Feed    | ✅     | ✅   | ✅     | ✅      |
| Voice Commands | ✅     | ✅   | ✅     | ⚠️      |
| GPS Tracking   | ✅     | ✅   | ✅     | ✅      |
| Text-to-Speech | ✅     | ✅   | ✅     | ✅      |

⚠️ Firefox has limited speech recognition support

## Troubleshooting

### Camera feed not loading

- Check `VITE_ROBOT_STREAM_URL` in `.env`
- Ensure robot camera is streaming
- Verify network connectivity

### Voice commands not working

- Use Chrome, Edge, or Safari browser
- Grant microphone permissions
- Check Gemini API key configuration

### GPS not updating

- Verify Firebase Realtime Database rules
- Check robot GPS module connection
- Ensure Firebase configuration is correct

## Firebase Database Structure

The application expects the following structure in Firebase Realtime Database:

```json
{
  "robot": {
    "gps": {
      "latitude": 0,
      "longitude": 0,
      "altitude": 0,
      "accuracy": 0,
      "speed": 0,
      "heading": 0,
      "timestamp": 0
    },
    "navigation": {
      "currentDirection": "stop",
      "speed": 0,
      "status": "stopped",
      "destination": "",
      "distanceToDestination": 0
    },
    "audio": {
      "isListening": false,
      "isSpeaking": false,
      "lastCommand": "",
      "lastResponse": "",
      "volume": 80
    },
    "status": {
      "battery": 100,
      "connectivity": "online",
      "temperature": 25,
      "errors": []
    },
    "commands": {
      "commandId": {
        "command": "navigate",
        "data": {},
        "timestamp": 0
      }
    }
  }
}
```

## License

MIT

## Support

For issues and questions, please create an issue in the repository.
