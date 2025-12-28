# Quick Start Guide - Guiding Robot Web Application

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit `.env` and add your credentials:

### Get Firebase Credentials:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Go to Project Settings > General
4. Scroll to "Your apps" and click on Web app (</>) icon
5. Copy the config values to your `.env` file

### Get Gemini API Key:

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key to `.env` as `VITE_GEMINI_API_KEY`

### Set Robot Stream URL:

- Update `VITE_ROBOT_STREAM_URL` with your robot's camera stream URL
- Example: `http://192.168.1.100:8080/stream`

## Step 3: Set Up Firebase Realtime Database

1. In Firebase Console, go to Realtime Database
2. Click "Create Database"
3. Choose location and start in test mode
4. Update database rules:

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

5. Initialize database structure (optional - will auto-create):

```json
{
  "robot": {
    "gps": {
      "latitude": 0,
      "longitude": 0,
      "timestamp": 0
    },
    "navigation": {
      "currentDirection": "stop",
      "speed": 0,
      "status": "stopped"
    },
    "audio": {
      "volume": 80
    },
    "status": {
      "battery": 100,
      "connectivity": "online"
    }
  }
}
```

## Step 4: Run the Application

Start the development server:

```bash
npm run dev
```

Open your browser and navigate to:

```
http://localhost:5173
```

## Step 5: Test Features

### Test Camera Feed

1. Ensure your robot camera is streaming
2. Check the camera feed section in the app
3. Click fullscreen button to expand

### Test Navigation

1. Click directional buttons
2. Commands will be sent to Firebase
3. Check Firebase console to see command data

### Test Voice Commands

1. Click "Start Listening" button
2. Grant microphone permissions when prompted
3. Speak a command like "move forward"
4. View the transcription and AI analysis

### Test GPS Tracking

1. Robot should send GPS coordinates to Firebase
2. View coordinates in the GPS Tracker section
3. Click "Open in Maps" to view location

## Troubleshooting

### Issue: "Failed to load camera feed"

**Solution:**

- Verify `VITE_ROBOT_STREAM_URL` in `.env`
- Ensure robot camera is streaming
- Check network connectivity
- Try accessing stream URL directly in browser

### Issue: "Voice commands not working"

**Solution:**

- Use Chrome, Edge, or Safari (Firefox has limited support)
- Grant microphone permissions
- Check Gemini API key is correct
- Open browser console for error details

### Issue: "GPS not updating"

**Solution:**

- Verify Firebase database rules allow read/write
- Check robot is sending GPS data to Firebase
- Ensure Firebase config in `.env` is correct
- Check browser console for connection errors

### Issue: "Environment variables not loading"

**Solution:**

- Ensure `.env` file is in project root
- Restart development server after changing `.env`
- All env vars must start with `VITE_`
- Don't commit `.env` to version control

## Production Build

When ready to deploy:

1. Build the application:

```bash
npm run build
```

2. Test the build locally:

```bash
npm run preview
```

3. Deploy the `dist` folder to your hosting service:
   - Firebase Hosting
   - Vercel
   - Netlify
   - GitHub Pages
   - Any static hosting service

## Robot Integration

Your robot should send data to Firebase in this format:

```javascript
// Example: Sending GPS data from robot
firebase.database().ref("robot/gps").set({
  latitude: 40.7128,
  longitude: -74.006,
  altitude: 10,
  accuracy: 5,
  speed: 2.5,
  heading: 180,
  timestamp: Date.now(),
});

// Example: Listening for commands on robot
firebase
  .database()
  .ref("robot/commands")
  .on("child_added", (snapshot) => {
    const command = snapshot.val();
    console.log("Received command:", command);
    // Execute command on robot
  });
```

## Next Steps

1. ✅ Configure environment variables
2. ✅ Set up Firebase Realtime Database
3. ✅ Test all features in development
4. 📱 Integrate with your physical robot
5. 🚀 Build and deploy to production
6. 🔐 Secure Firebase rules for production use

## Need Help?

- Check `README_APP.md` for detailed documentation
- Review component code in `src/components/`
- Check Firebase Console for data flow
- Open browser DevTools console for errors

Happy coding! 🤖
