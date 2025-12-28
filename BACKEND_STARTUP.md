# 🚀 Backend Server Startup Guide

## ❌ **Current Issue:**

```
POST http://localhost:8000/navigation/start 404 (Not Found)
```

**Cause:** FastAPI backend server is not running on port 8000

---

## ✅ **Quick Fix - Start Backend Server:**

### **Method 1: Terminal Commands**

```bash
# Navigate to backend directory
cd backend

# Activate virtual environment
source venv/bin/activate

# Start the FastAPI server
python main.py
```

### **Method 2: Alternative Startup**

```bash
# If main.py doesn't work, try uvicorn directly
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🔍 **Verify Server Started:**

**Look for this output:**

```
✅ Gemini gemini-1.5-flash loaded!
📡 ESP32 Stream URL: http://172.20.10.3:81/stream
🌐 API will be available at: http://localhost:8000
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**Test in browser:**

- Open: http://localhost:8000
- Should show: `{"status":"online","message":"Guiding Robot Backend API"}`

---

## 🛠️ **Troubleshooting:**

### **If `python main.py` fails:**

1. **Check Python environment:**

```bash
cd backend
source venv/bin/activate
which python  # Should show: backend/venv/bin/python
```

2. **Install missing dependencies:**

```bash
pip install fastapi uvicorn python-dotenv opencv-python numpy requests google-generativeai pillow
```

3. **Check .env file:**

```bash
ls -la backend/.env  # Should exist
cat backend/.env     # Should contain GEMINI_API_KEY
```

### **If port 8000 is busy:**

```bash
# Find what's using port 8000
lsof -i :8000

# Kill the process (replace PID with actual number)
kill -9 <PID>

# Or use different port
uvicorn main:app --port 8001
# Then update React app to use localhost:8001
```

### **If ESP32 connection fails:**

- **Expected warning:** `ESP32 connection timeout` (this is normal if ESP32 is off)
- **Server still starts:** Navigation endpoints work without ESP32
- **Camera needs ESP32:** Only camera streaming requires ESP32 to be on

---

## 📋 **Complete Startup Checklist:**

### **✅ Backend Server:**

- [ ] **Terminal 1:** `cd backend && source venv/bin/activate && python main.py`
- [ ] **Verify:** Server shows "Uvicorn running on http://0.0.0.0:8000"
- [ ] **Test:** http://localhost:8000 returns API status

### **✅ Frontend Server:**

- [ ] **Terminal 2:** `npm run dev`
- [ ] **Verify:** React app runs on http://localhost:5173
- [ ] **Test:** App loads without 404 navigation errors

### **✅ ESP32 Hardware (Optional):**

- [ ] **Power on:** ESP32-CAM at 172.20.10.3
- [ ] **Test:** http://172.20.10.3 shows camera interface
- [ ] **Stream:** Backend can proxy camera feed

---

## 🎯 **Expected Working State:**

**With Backend Running:**

- ✅ **Navigation endpoints** work (no 404 errors)
- ✅ **Voice guidance** starts with trip
- ✅ **Camera streaming** works (if ESP32 on)
- ✅ **Gemini analysis** works for vision assistant

**Backend Console Output:**

```
📹 Starting stream proxy from http://172.20.10.3:81/stream
✅ Voice navigation started: {'status': 'started', 'message': 'Navigation active'}
🧠 Analyzing scene with Gemini Vision...
```

**React Console Output:**

```
✅ Voice navigation started: {status: "started", message: "Navigation active"}
✅ MJPEG stream loaded successfully from backend
```

---

## 🚨 **Common Startup Errors:**

### **`ModuleNotFoundError: No module named 'fastapi'`**

**Fix:**

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### **`FileNotFoundError: [Errno 2] No such file or directory: '.env'`**

**Fix:**

```bash
cd backend
cp ../.env .env  # Copy from main directory
# Or create new .env with GEMINI_API_KEY
```

### **`Address already in use: port 8000`**

**Fix:**

```bash
lsof -i :8000
kill -9 <PID>
# Or use different port and update React app
```

---

## 🔄 **Quick Restart Commands:**

**If you need to restart everything:**

```bash
# Stop all servers (Ctrl+C in each terminal)

# Restart backend
cd backend && source venv/bin/activate && python main.py

# Restart frontend
npm run dev
```

**The main issue is simply that the backend server needs to be started!** 🎯
