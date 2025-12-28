# Quick Deployment Guide

## Step 1: Install Node.js

Download from: https://nodejs.org/
OR
Install via Homebrew: `brew install node`

## Step 2: Deploy Frontend to Vercel

```bash
# Navigate to project
cd /Users/sadukaathukorala/Desktop/IOT_PROJECT/guiding-robot-webapp

# Login to Vercel (opens browser)
npx vercel login

# Deploy
npx vercel

# Follow prompts:
# - Setup and deploy? YES
# - Which scope? (select your account)
# - Link to existing project? NO
# - Project name? guiding-robot-webapp
# - In which directory? ./
# - Override settings? NO

# Production deployment
npx vercel --prod
```

## Step 3: Install Cloudflare Tunnel

```bash![1759912557220](image/DEPLOY/1759912557220.png)![1759912560327](image/DEPLOY/1759912560327.png)![1759912562327](image/DEPLOY/1759912562327.png)![1759912575268](image/DEPLOY/1759912575268.png)![1759912576761](image/DEPLOY/1759912576761.png)![1759912577134](image/DEPLOY/1759912577134.png)![1759912577426](image/DEPLOY/1759912577426.png)![1759912577282](image/DEPLOY/1759912577282.png)![1759912577666](image/DEPLOY/1759912577666.png)![1759912577567](image/DEPLOY/1759912577567.png)
brew install cloudflare/cloudflare/cloudflared
```

## Step 4: Expose Backend

```bash
# Start backend
cd backend
python3 main.py &

# In new terminal, start cloudflare tunnel
cloudflared tunnel --url http://localhost:8000
```

You'll get a URL like: `https://xyz-abc-123.trycloudflare.com`

## Step 5: Update Frontend Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add:

```
VITE_BACKEND_URL=https://your-cloudflare-url.trycloudflare.com
```

Then redeploy:

```bash
npx vercel --prod
```

## Done!

Your frontend will be at: `https://your-project.vercel.app`
Backend accessible via Cloudflare tunnel

## Alternative: Use ngrok instead of Cloudflare

```bash
# Install ngrok
brew install ngrok

# Or download from: https://ngrok.com/download

# Start backend
cd backend
python3 main.py &

# Expose via ngrok
ngrok http 8000
```

You'll get a URL like: `https://abc123.ngrok.io`
