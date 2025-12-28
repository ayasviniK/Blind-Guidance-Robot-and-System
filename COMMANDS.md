# 🤖 Guiding Robot - Command Reference

## NPM Commands

### Development

```bash
# Install all dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run ESLint
npm run lint
```

### Port Information

- **Development**: http://localhost:5173
- **Preview**: http://localhost:4173

## Voice Commands Examples

Say these commands when "Start Listening" is active:

### Navigation Commands

- "Move forward"
- "Go forward"
- "Move backward"
- "Go back"
- "Turn left"
- "Turn right"
- "Stop"
- "Emergency stop"

### Destination Commands

- "Navigate to [location name]"
- "Go to [destination]"
- "Take me to [place]"
- "Set destination to [address]"

### Status Commands

- "What's my location?"
- "Where am I?"
- "Check battery"
- "Robot status"

### General Commands

- "Help"
- "What can you do?"

## Firebase Realtime Database Commands

### View Data

```bash
# Open Firebase Console
https://console.firebase.google.com/project/theguidingrobot/database
```

### REST API Examples

#### Get Robot Data

```bash
curl https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app/robot.json
```

#### Get GPS Data

```bash
curl https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app/robot/gps.json
```

#### Update GPS (from robot)

```bash
curl -X PUT \
  https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app/robot/gps.json \
  -d '{
    "latitude": 40.7128,
    "longitude": -74.0060,
    "altitude": 10,
    "accuracy": 5,
    "timestamp": 1704672000000
  }'
```

#### Send Command (from web app)

```bash
curl -X POST \
  https://theguidingrobot-default-rtdb.asia-southeast1.firebasedatabase.app/robot/commands.json \
  -d '{
    "command": "navigate",
    "data": {"direction": "forward"},
    "timestamp": 1704672000000
  }'
```

## Robot Stream URL

### Test Camera Stream

```bash
# Open in browser or curl
http://172.20.10.3:8080/stream
```

### Update Stream URL

Edit `.env` file:

```env
VITE_ROBOT_STREAM_URL=http://[YOUR_ROBOT_IP]:8080/stream
```

## Git Commands

### Initial Setup (if using Git)

```bash
# Initialize repository
git init

# Add all files (except .env - it's in .gitignore)
git add .

# First commit
git commit -m "Initial commit: Guiding Robot Web App"

# Add remote repository
git remote add origin [your-repo-url]

# Push to GitHub
git push -u origin main
```

### Important: Never commit .env file!

The `.env` file is already in `.gitignore` to protect your API keys.

## Testing Commands

### Browser DevTools

- **Open Console**: `Cmd + Option + J` (Mac) or `Ctrl + Shift + J` (Windows)
- **Open DevTools**: `Cmd + Option + I` (Mac) or `F12` (Windows)
- **Network Tab**: Monitor Firebase requests
- **Console Tab**: View errors and logs

### Test Firebase Connection

```javascript
// Open browser console and run:
console.log("Testing Firebase connection...");
```

### Test Gemini AI

```javascript
// The AudioControls component will log AI responses
console.log(
  "Gemini AI configured:",
  import.meta.env.VITE_GEMINI_API_KEY ? "Yes" : "No"
);
```

## Environment Variables

### View Current Variables (in development)

```bash
# Start dev server with verbose output
npm run dev -- --debug
```

### All Available Variables

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_URL=
VITE_GEMINI_API_KEY=
VITE_GOOGLE_MAPS_API_KEY=
VITE_ROBOT_STREAM_URL=
```

## Keyboard Shortcuts (in app)

### Navigation Component

- Arrow keys can be used if keyboard navigation is enabled
- Tab: Navigate between controls
- Enter: Activate button
- Escape: Stop/Cancel

### Audio Controls

- Click "Start Listening" then speak
- Volume slider: Click and drag

### GPS Tracker

- Enter: Confirm destination (when input is focused)
- Escape: Cancel destination input

## Deployment Commands

### Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase Hosting
firebase init hosting

# Build and deploy
npm run build
firebase deploy
```

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
npm run build
netlify deploy --prod
```

## Troubleshooting Commands

### Clear Cache and Reinstall

```bash
# Remove node_modules and lock file
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall
npm install
```

### Clear Vite Cache

```bash
# Remove Vite cache
rm -rf node_modules/.vite

# Restart dev server
npm run dev
```

### Check Node Version

```bash
node --version  # Should be 18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
```

### View Port Usage

```bash
# Check if port 5173 is in use (Mac/Linux)
lsof -i :5173

# Kill process on port (Mac/Linux)
kill -9 $(lsof -t -i :5173)
```

## API Testing

### Test Gemini AI

```bash
# Using curl (replace with your API key)
curl -X POST \
  'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

### Test Google Maps Geocoding

```bash
# Test geocoding API
curl 'https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=YOUR_API_KEY'
```

## Useful URLs

- **Local App**: http://localhost:5173
- **Firebase Console**: https://console.firebase.google.com/project/theguidingrobot
- **Firebase Database**: https://console.firebase.google.com/project/theguidingrobot/database
- **Gemini AI Studio**: https://makersuite.google.com/
- **Google Cloud Console**: https://console.cloud.google.com/

## Quick Reference

### Project Status

- ✅ All components created
- ✅ Firebase configured
- ✅ Gemini AI integrated
- ✅ Environment variables set
- ✅ Ready for development

### Next Steps

1. Run `npm install`
2. Run `npm run dev`
3. Open http://localhost:5173
4. Test all features
5. Connect your robot!

---

**Pro Tip**: Bookmark this file for quick command reference! 📚
