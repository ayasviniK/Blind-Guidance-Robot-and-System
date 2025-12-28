# ESP32 Camera Stream Troubleshooting Guide

## Current Issue

The MJPEG stream from ESP32 at `http://172.20.10.3` is not loading in the browser.

## Error Details

```
MJPEG stream error: Event {isTrusted: true, type: 'error', target: img, ...}
```

This means the browser cannot load the image from the ESP32 stream URL.

---

## Quick Diagnostic Checklist

### 1. ✅ Check ESP32 Power

- [ ] ESP32 is powered on (check LED indicator)
- [ ] Camera module is properly connected
- [ ] Power supply is stable (5V, sufficient amperage)

### 2. ✅ Check Network Connection

#### Test from Terminal (Mac/Linux):

```bash
# Check if ESP32 is reachable
ping 172.20.10.3

# Expected: Reply from 172.20.10.3
# If timeout: ESP32 is not on network
```

#### Test HTTP Connection:

```bash
# Try to fetch from ESP32
curl -I http://172.20.10.3

# Expected: HTTP/1.1 200 OK with Content-Type: multipart/x-mixed-replace
# If failed: ESP32 web server not running
```

#### Test in Browser:

1. Open new tab
2. Navigate to: `http://172.20.10.3`
3. You should see MJPEG stream directly

### 3. ✅ Check Same Network

- [ ] Computer and ESP32 on **same WiFi network**
- [ ] No VPN active (can block local network access)
- [ ] No firewall blocking local IP ranges

### 4. ✅ Common ESP32 Stream URLs

ESP32-CAM can serve streams at different endpoints. Try these:

```
http://172.20.10.3
http://172.20.10.3:81/stream
http://172.20.10.3/stream
http://172.20.10.3/cam
http://172.20.10.3/mjpeg
http://172.20.10.3:80/stream
```

---

## Step-by-Step Troubleshooting

### Step 1: Verify ESP32 IP Address

The ESP32 IP might have changed. Check your ESP32 serial monitor for the actual IP:

```
WiFi connected
IP address: 172.20.10.3  <-- This is what you need
Starting web server on port 80
Camera Ready! Use 'http://172.20.10.3/stream' to connect
```

### Step 2: Test Stream Endpoints

Open terminal and test each endpoint:

```bash
# Test root
curl -I http://172.20.10.3/

# Test common stream paths
curl -I http://172.20.10.3/stream
curl -I http://172.20.10.3:81/stream
curl -I http://172.20.10.3/cam
```

Look for response with:

```
HTTP/1.1 200 OK
Content-Type: multipart/x-mixed-replace; boundary=frame
```

### Step 3: Update .env File

Once you find the working URL, update `.env`:

```bash
# If ESP32 serves at root:
VITE_ROBOT_STREAM_URL=http://172.20.10.3

# If ESP32 serves at /stream:
VITE_ROBOT_STREAM_URL=http://172.20.10.3/stream

# If ESP32 uses port 81:
VITE_ROBOT_STREAM_URL=http://172.20.10.3:81/stream
```

### Step 4: Restart Dev Server

After updating `.env`:

```bash
# Stop current server (Ctrl+C)
# Start again
npm run dev
```

Environment variables are only read at startup!

---

## Common ESP32 Issues & Solutions

### Issue 1: IP Address Changed

**Symptom**: Worked before, now doesn't  
**Solution**:

- Check ESP32 serial monitor for new IP
- Router might have assigned different IP
- Consider setting static IP in ESP32 code or router

### Issue 2: Wrong Stream Path

**Symptom**: 404 error when accessing URL  
**Solution**:

- Check ESP32 code for correct endpoint
- Common paths: `/`, `/stream`, `/cam`, `/mjpeg`
- Try each endpoint manually in browser

### Issue 3: CORS Issues

**Symptom**: Browser console shows CORS error  
**Solution**:

```cpp
// Add to ESP32 server code:
server.sendHeader("Access-Control-Allow-Origin", "*");
server.sendHeader("Access-Control-Allow-Methods", "GET");
```

### Issue 4: Camera Not Initialized

**Symptom**: ESP32 responds but no image  
**Solution**:

- Check ESP32 serial monitor for camera init errors
- Power cycle ESP32
- Check camera module connection (ribbon cable)

### Issue 5: Network Firewall

**Symptom**: Can ping but can't access HTTP  
**Solution**:

- Temporarily disable Mac firewall (System Settings > Network > Firewall)
- Check if antivirus is blocking local connections
- Try from different device on same network

---

## ESP32-CAM Code Examples

### Basic MJPEG Server (Arduino)

```cpp
#include <WiFi.h>
#include <WebServer.h>
#include <esp_camera.h>

const char* ssid = "your-wifi-name";
const char* password = "your-wifi-password";

WebServer server(80);

void handleStream() {
  WiFiClient client = server.client();

  camera_fb_t * fb = NULL;

  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: multipart/x-mixed-replace; boundary=frame");
  client.println();

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      break;
    }

    client.print("--frame\r\n");
    client.print("Content-Type: image/jpeg\r\n\r\n");
    client.write(fb->buf, fb->len);
    client.print("\r\n");

    esp_camera_fb_return(fb);

    if (!client.connected()) break;
  }
}

void setup() {
  Serial.begin(115200);

  // Initialize WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());  // <-- This is your stream IP

  // Initialize camera
  camera_config_t config;
  // ... camera config ...
  esp_camera_init(&config);

  // Setup server routes
  server.on("/stream", handleStream);
  server.begin();

  Serial.println("Camera Ready!");
  Serial.print("Stream at: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/stream");
}

void loop() {
  server.handleClient();
}
```

---

## Testing with Different Tools

### 1. Browser Direct Access

```
http://172.20.10.3
```

If this works, the ESP32 is fine - issue is in React app.

### 2. VLC Media Player

```
File → Open Network Stream → http://172.20.10.3/stream
```

VLC can play MJPEG streams and will show detailed error messages.

### 3. FFmpeg

```bash
ffmpeg -i http://172.20.10.3/stream -frames:v 1 test.jpg
```

Captures single frame to test stream validity.

### 4. Python Test Script

```python
import requests
from PIL import Image
from io import BytesIO

url = "http://172.20.10.3/stream"
response = requests.get(url, stream=True)

# Should see multipart boundary
print(response.headers.get('content-type'))
# Expected: multipart/x-mixed-replace; boundary=frame
```

---

## Updated React Component Features

The CameraFeed component now includes:

✅ **Better Error Messages**: Shows specific connection issues  
✅ **Stream URL Validation**: Tests URL before loading  
✅ **Troubleshooting UI**: In-app troubleshooting steps  
✅ **Test Button**: Opens stream URL in new tab  
✅ **Reload Button**: Quick page refresh  
✅ **Console Logging**: Detailed logs for debugging

---

## What to Check Right Now

1. **Terminal Test**:

```bash
curl -I http://172.20.10.3
```

2. **Browser Test**:

   - Open `http://172.20.10.3` in new tab
   - Does it load?

3. **Check ESP32**:

   - Is it powered?
   - Check serial monitor output
   - Note the actual IP address

4. **Check Browser Console** (F12):

   - Look for detailed error messages
   - Check Network tab for failed request details

5. **Restart Dev Server**:

```bash
npm run dev
```

---

## Next Steps Based on Results

### ✅ If Stream Opens in Browser Tab:

→ Issue is CORS or React-specific
→ Need to add CORS headers to ESP32

### ❌ If Stream Doesn't Open Anywhere:

→ ESP32 not responding
→ Check power, WiFi, and IP address

### ⚠️ If Curl Works But Browser Fails:

→ Possible HTTPS/HTTP mixed content issue
→ Try accessing React app via HTTP (not HTTPS)

---

## Quick Fix Commands

```bash
# 1. Check ESP32 is reachable
ping 172.20.10.3

# 2. Test stream endpoint
curl http://172.20.10.3/stream

# 3. If IP changed, update .env
echo "VITE_ROBOT_STREAM_URL=http://NEW_IP_HERE" >> .env

# 4. Restart dev server
npm run dev

# 5. Clear browser cache
# Chrome: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

---

## Still Not Working?

### Alternative: Use Test MJPEG Stream

For testing the app without ESP32:

```bash
# In .env file:
VITE_ROBOT_STREAM_URL=http://webcam.location.domain/mjpg/video.mjpg

# Or use a public test stream (search for "public mjpeg stream")
```

### Contact Checklist for Help:

When asking for help, provide:

1. ESP32 serial monitor output (especially IP address)
2. Result of `curl -I http://172.20.10.3`
3. Browser console error messages (F12)
4. Network tab screenshot showing failed request
5. ESP32 code (camera initialization and server setup)

---

## Success Criteria

When working correctly, you should see:

1. ✅ Browser console: `✅ MJPEG stream loaded successfully`
2. ✅ Live camera feed in app
3. ✅ Stream status: Green "Live" indicator
4. ✅ No errors in browser console
5. ✅ Vision Assistant can capture frames

---

**Current Status**: Waiting for ESP32 connection test results 🔍
