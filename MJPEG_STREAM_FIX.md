# MJPEG Stream Compatibility Fix

## Problem

The ESP32-CAM at `http://172.20.10.3` streams video in MJPEG (Motion JPEG) format. HTML5 `<video>` elements don't natively support MJPEG streams, which caused these errors:

- `ERR_CONTENT_DECODING_FAILED`
- `NotSupportedError: Failed to load because no supported source was found`

## Solution

Changed from using `<video>` element to `<img>` element for displaying the MJPEG stream.

### Why This Works

- MJPEG streams are essentially a continuous stream of JPEG images
- Browsers can render MJPEG streams directly in `<img>` tags
- The `<img>` element automatically refreshes as new frames arrive

## Changes Made

### 1. CameraFeed Component

**Before:** Used `<video>` element with play/pause controls

```tsx
<video ref={videoRef} src={streamUrl} autoPlay muted playsInline />
```

**After:** Uses `<img>` element

```tsx
<img ref={imgRef} src={streamUrl} alt="Robot Camera Stream" />
```

### 2. VisionAssistant Component

**Before:** Captured frames from `<video>` element using `video.videoWidth/Height`

```tsx
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
context.drawImage(video, 0, 0);
```

**After:** Captures frames from `<img>` element using `img.naturalWidth/Height`

```tsx
canvas.width = img.naturalWidth || img.width;
canvas.height = img.naturalHeight || img.height;
context.drawImage(img, 0, 0);
```

## How Frame Capture Works

1. **Hidden Image Element**: VisionAssistant has a hidden `<img>` that continuously receives the MJPEG stream
2. **Canvas Capture**: When analysis is needed, the current frame is drawn to a hidden canvas
3. **Base64 Conversion**: The canvas content is converted to base64 JPEG
4. **Gemini Analysis**: The base64 image is sent to Gemini Vision API for scene description

## Benefits

✅ **Direct MJPEG Support**: No need for additional video codecs or transcoders
✅ **Real-time Display**: Frames update as they arrive from ESP32
✅ **Frame Capture**: Can still capture individual frames for Gemini analysis
✅ **Fullscreen Support**: Still supports fullscreen viewing
✅ **Lower Overhead**: No video decoding overhead

## ESP32 Stream Format

The ESP32-CAM typically serves MJPEG streams at:

- **URL**: `http://172.20.10.3` (or with `/stream` endpoint)
- **Format**: MJPEG (multipart/x-mixed-replace)
- **Content-Type**: `multipart/x-mixed-replace; boundary=frame`

## Testing

After these changes:

1. Open the app at `http://localhost:5174`
2. The camera feed should display the ESP32 stream without errors
3. Vision Assistant can capture and analyze frames
4. Fullscreen mode should work normally

## Troubleshooting

### Stream Not Loading

- Verify ESP32 is powered on and accessible at `http://172.20.10.3`
- Check network connectivity (same WiFi network)
- Try accessing the stream URL directly in a browser

### Frame Capture Issues

- Ensure the `<img>` element has loaded at least one frame
- Check browser console for CORS errors
- Verify canvas dimensions are properly set

### CORS Issues

If you see CORS errors, add `crossOrigin="anonymous"` to the `<img>` element (already included in VisionAssistant).

## Technical Notes

**MJPEG vs H.264/WebM:**

- MJPEG: Series of JPEG images, higher bandwidth, simpler encoding
- H.264/WebM: Video codec, lower bandwidth, requires decoding

**Why ESP32 Uses MJPEG:**

- Lower computational requirements for ESP32 microcontroller
- Easier to implement on embedded systems
- No need for complex video encoding libraries
- Good enough quality for robotics/IoT applications
