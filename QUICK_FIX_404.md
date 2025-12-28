# 🎯 **Quick Solution: Start Backend Server**

## The 404 error is because the FastAPI backend isn't running.

### **Start Backend Server (Terminal 1):**

```bash
cd backend
source venv/bin/activate
python main.py
```

### **Expected Output:**

```
✅ Gemini gemini-1.5-flash loaded!
🌐 API will be available at: http://localhost:8000
INFO: Uvicorn running on http://0.0.0.0:8000
```

### **Keep Frontend Running (Terminal 2):**

```bash
npm run dev
# Keep this running on localhost:5173
```

---

## ✅ **After Starting Backend:**

**The React app will show:**

- ✅ No more 404 navigation errors
- ✅ `"✅ Voice navigation started"` in console
- ✅ Camera stream working (if ESP32 on)
- ✅ Gemini vision analysis working

**Trip functionality will work:**

1. **Set destination** → Works
2. **Start trip** → ✅ **Voice guidance starts**
3. **GPS updates** → ✅ **Live navigation announcements**
4. **End trip** → ✅ **Voice guidance stops**

---

## 🔧 **If Backend Won't Start:**

### **Install dependencies:**

```bash
cd backend
source venv/bin/activate
pip install fastapi uvicorn python-dotenv opencv-python numpy requests google-generativeai pillow
```

### **Check .env file:**

```bash
# Make sure backend/.env exists with GEMINI_API_KEY
cp .env backend/.env
```

---

**The app works without the backend too - it just won't have voice navigation. But for the full experience with AI guidance, start the backend server!** 🚀
