# 🗺️ Google Maps API Setup Guide

## ❌ **Current Issue:**

- **Directions API**: REQUEST_DENIED
- **Maps API**: 404 and access errors
- **Root Cause**: API key lacks required permissions and APIs not enabled

---

## ✅ **Step-by-Step Fix:**

### **1. Go to Google Cloud Console**

```
🌐 https://console.cloud.google.com/
```

- **Sign in** with your Google account
- **Select** existing project or **Create New Project**

### **2. Enable Required APIs**

**Navigation:** `APIs & Services` → `Library`

**Search and Enable These APIs:**

1. **✅ Maps JavaScript API** - For map display
2. **✅ Directions API** - ⚠️ **THIS IS THE MAIN MISSING ONE**
3. **✅ Geocoding API** - For address search
4. **✅ Places API** - For location autocomplete (optional)

**For each API:**

- Click on the API name
- Click **"ENABLE"** button
- Wait for confirmation ✅

### **3. Configure API Key**

**Navigation:** `APIs & Services` → `Credentials`

**Find your key:** `AIzaSyBotokFOtODouLDbapraJJfH3qxNY0p0g8`

**Click Edit (pencil icon):**

#### **Application Restrictions:**

- Select: **"HTTP referrers (web sites)"**
- **Add referrer:** `http://localhost:*/*`
- **Add referrer:** `http://127.0.0.1:*/*`
- **Add referrer:** `https://yourdomain.com/*` (if deploying)

#### **API Restrictions:**

- Select: **"Restrict key"**
- ✅ Check: **Maps JavaScript API**
- ✅ Check: **Directions API**
- ✅ Check: **Geocoding API**
- ✅ Check: **Places API** (if using)

### **4. Enable Billing Account** ⚠️ **REQUIRED**

**Navigation:** `Billing` → `Link a billing account`

**Why needed:**

- Google Maps APIs require billing even for free usage
- **Free tier:** $200/month credit (covers most development needs)
- **Development usage:** Usually stays within free limits

**Setup:**

1. Click **"Link a billing account"**
2. **Add payment method** (credit card required)
3. **Confirm** billing account linked to project

### **5. Wait for Changes** ⏱️

- **Propagation time:** 5-10 minutes
- **Refresh** your application after waiting
- **Clear browser cache** if needed

---

## 🧪 **Test the Fix:**

### **After Setup - Test Commands:**

```bash
# 1. Test Geocoding API
curl "https://maps.googleapis.com/maps/api/geocode/json?address=Sydney+Opera+House&key=AIzaSyBotokFOtODouLDbapraJJfH3qxNY0p0g8"

# Expected: 200 OK with location data
```

```bash
# 2. Test Directions API
curl "https://maps.googleapis.com/maps/api/directions/json?origin=Sydney&destination=Melbourne&key=AIzaSyBotokFOtODouLDbapraJJfH3qxNY0p0g8"

# Expected: 200 OK with route data
```

### **In Your App:**

1. **Refresh** localhost:5173
2. **Enter destination** (address or coordinates)
3. **Click Navigate** → Should work without "REQUEST_DENIED"
4. **Start Trip** → Should get turn-by-turn directions

---

## 📋 **Verification Checklist:**

### **✅ In Google Cloud Console:**

- [ ] **Billing enabled** and linked to project
- [ ] **Maps JavaScript API** enabled
- [ ] **Directions API** enabled ⭐ **MOST IMPORTANT**
- [ ] **Geocoding API** enabled
- [ ] **API key restrictions** properly configured
- [ ] **HTTP referrers** include localhost

### **✅ In Your App Console:**

- [ ] No more "REQUEST_DENIED" errors
- [ ] Google Maps loads successfully
- [ ] Route calculation works
- [ ] Turn-by-turn directions appear
- [ ] Distance and duration show properly

---

## 🛠️ **Current App Fallback:**

**Good news:** I've added fallback navigation that works even without Google Directions API:

- **Fallback Mode:** Creates basic waypoint to destination
- **Still Works:** GPS navigation, trip management, voice guidance
- **User Message:** Explains when using fallback vs full directions

**Console Messages:**

- ✅ `"Using fallback navigation without Google Directions"`
- ⚠️ `"Google Maps access limited. Using basic navigation to destination coordinates."`

---

## 🚨 **Common Issues:**

### **"Still getting errors after setup?"**

1. **Wait longer:** Changes can take up to 30 minutes
2. **Clear cache:** Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
3. **Check quotas:** APIs & Services → Quotas
4. **Verify billing:** Make sure no payment issues

### **"Billing concerns?"**

- **Free tier:** $200/month covers ~28,000 map loads or ~40,000 directions requests
- **Development:** Usually well within free limits
- **Monitor usage:** Set up budget alerts in billing section

### **"API key security?"**

- **Development:** HTTP referrer restrictions are sufficient
- **Production:** Use server-side proxy for sensitive operations
- **Never expose:** Don't commit API keys to public repositories

---

## 🎯 **Expected Final Result:**

After completing the setup, your app will have:

- **✅ Full Google Maps integration** with turn-by-turn directions
- **✅ Address geocoding** working properly
- **✅ Route calculation** with distance/duration
- **✅ Voice navigation** with detailed instructions
- **✅ Fallback support** for any future API issues

**Total setup time:** ~15-20 minutes (including wait time)

The most critical step is **enabling the Directions API** - that's what's causing the REQUEST_DENIED error! 🎯
