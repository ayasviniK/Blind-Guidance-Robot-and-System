# Deployment Guide

## Frontend Deployment (Vercel)

### Prerequisites

- Vercel account (https://vercel.com)
- Vercel CLI: `npm install -g vercel`

### Steps

1. **Install Vercel CLI** (if not already installed):

   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:

   ```bash
   vercel login
   ```

3. **Deploy**:

   ```bash
   vercel
   ```

   - Follow the prompts
   - Select your project settings
   - Vercel will build and deploy automatically

4. **Set Environment Variables in Vercel**:
   Go to your Vercel project dashboard → Settings → Environment Variables

   Add these variables:

   ```
   VITE_BACKEND_URL=<your-cloudflare-tunnel-url>
   VITE_FIREBASE_API_KEY=<your-key>
   VITE_FIREBASE_AUTH_DOMAIN=<your-domain>
   VITE_FIREBASE_DATABASE_URL=<your-url>
   VITE_FIREBASE_PROJECT_ID=<your-id>
   VITE_FIREBASE_STORAGE_BUCKET=<your-bucket>
   VITE_FIREBASE_MESSAGING_SENDER_ID=<your-id>
   VITE_FIREBASE_APP_ID=<your-id>
   VITE_GOOGLE_MAPS_API_KEY=<your-key>
   ```

5. **Redeploy after setting environment variables**:
   ```bash
   vercel --prod
   ```

---

## Backend Deployment (Cloudflare Tunnel)

### Prerequisites

- Cloudflare account (https://cloudflare.com)
- cloudflared CLI

### Steps

1. **Install cloudflared**:

   ```bash
   # macOS (Homebrew)
   brew install cloudflare/cloudflare/cloudflared

   # Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation
   ```

2. **Login to Cloudflare**:

   ```bash
   cloudflared tunnel login
   ```

   This will open a browser for authentication.

3. **Create a tunnel**:

   ```bash
   cloudflared tunnel create guiding-robot-backend
   ```

   Save the tunnel ID shown in the output.

4. **Create tunnel configuration**:
   Create a file: `~/.cloudflared/config.yml`

   ```yaml
   tunnel: <your-tunnel-id>
   credentials-file: /Users/<your-username>/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: <your-subdomain>.yourdomain.com
       service: http://localhost:8000
     - service: http_status:404
   ```

5. **Route your tunnel**:

   ```bash
   cloudflared tunnel route dns guiding-robot-backend <your-subdomain>.yourdomain.com
   ```

6. **Or use Quick Tunnel (No domain required - Perfect for testing!)**:

   ```bash
   cd backend
   # Start your backend first
   python3 main.py &

   # Then start quick tunnel
   cloudflared tunnel --url http://localhost:8000
   ```

   This will give you a temporary public URL like:

   ```
   https://random-words.trycloudflare.com
   ```

   **Update your Vercel environment variable** `VITE_BACKEND_URL` with this URL!

7. **For permanent deployment, run the tunnel**:

   ```bash
   cloudflared tunnel run guiding-robot-backend
   ```

8. **Run tunnel as a service (optional)**:
   ```bash
   cloudflared service install
   ```

---

## Production Deployment Checklist

### Frontend (Vercel)

- [ ] All environment variables set in Vercel dashboard
- [ ] VITE_BACKEND_URL points to Cloudflare Tunnel URL
- [ ] Deploy successful
- [ ] Test the deployed site

### Backend (Cloudflare)

- [ ] Python backend running on your server
- [ ] Cloudflare tunnel active
- [ ] Backend accessible via tunnel URL
- [ ] CORS configured for Vercel domain
- [ ] Test API endpoints

### Post-Deployment

- [ ] Update Firebase security rules if needed
- [ ] Test GPS tracking
- [ ] Test vision assistant
- [ ] Test navigation guidance
- [ ] Verify audio system works

---

## Quick Deployment Commands

### Deploy Frontend to Vercel

```bash
# One-time setup
npm install -g vercel
vercel login

# Deploy
vercel

# Production deployment
vercel --prod
```

### Expose Backend with Cloudflare Quick Tunnel

```bash
cd backend
python3 main.py &
cloudflared tunnel --url http://localhost:8000
```

Copy the generated URL and add it to Vercel environment variables as `VITE_BACKEND_URL`.

---

## Local Development

```bash
# Frontend
npm run dev

# Backend
cd backend
python3 main.py
```

---

## Troubleshooting

### Frontend not connecting to backend

- Check VITE_BACKEND_URL in Vercel environment variables
- Verify Cloudflare tunnel is running
- Check CORS settings in backend

### Backend tunnel issues

- Verify cloudflared is installed: `cloudflared --version`
- Check tunnel status: `cloudflared tunnel list`
- Restart tunnel if needed

### Audio not working

- Check browser permissions for audio
- Verify backend audio system is initialized
- Check browser console for errors
