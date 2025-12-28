#!/bin/bash

echo "🚀 Guiding Robot Quick Deployment Script"
echo "=========================================="
echo ""

# Check if vercel is installed
if ! command -v vercel &> /dev/null
then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null
then
    echo "❌ cloudflared not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install cloudflare/cloudflare/cloudflared
    else
        echo "Please install cloudflared manually from:"
        echo "https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation"
        exit 1
    fi
fi

echo ""
echo "✅ All tools installed!"
echo ""

# Menu
echo "Choose deployment option:"
echo "1. Deploy frontend to Vercel"
echo "2. Start backend with Cloudflare Quick Tunnel"
echo "3. Deploy both (frontend + backend)"
echo "4. Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "📦 Deploying frontend to Vercel..."
        vercel
        echo ""
        echo "✅ Frontend deployed!"
        echo "Remember to set environment variables in Vercel dashboard"
        ;;
    2)
        echo ""
        echo "🌐 Starting backend with Cloudflare Quick Tunnel..."
        echo ""
        cd backend
        
        # Start backend in background
        echo "Starting Python backend..."
        python3 main.py &
        BACKEND_PID=$!
        
        # Wait for backend to start
        sleep 3
        
        echo ""
        echo "Starting Cloudflare Quick Tunnel..."
        echo "⚠️  IMPORTANT: Copy the generated URL and add it to Vercel as VITE_BACKEND_URL"
        echo ""
        
        # Start cloudflare tunnel (this will block)
        cloudflared tunnel --url http://localhost:8000
        
        # Cleanup on exit
        kill $BACKEND_PID
        ;;
    3)
        echo ""
        echo "🚀 Deploying both frontend and backend..."
        echo ""
        
        # Deploy frontend first
        echo "📦 Step 1: Deploying frontend to Vercel..."
        vercel
        
        echo ""
        echo "✅ Frontend deployed!"
        echo ""
        echo "🌐 Step 2: Starting backend with Cloudflare Quick Tunnel..."
        echo ""
        
        cd backend
        
        # Start backend
        echo "Starting Python backend..."
        python3 main.py &
        BACKEND_PID=$!
        
        sleep 3
        
        echo ""
        echo "Starting Cloudflare Quick Tunnel..."
        echo ""
        echo "⚠️  IMPORTANT: "
        echo "1. Copy the generated URL below"
        echo "2. Go to Vercel dashboard → Your Project → Settings → Environment Variables"
        echo "3. Add VITE_BACKEND_URL with the copied URL"
        echo "4. Redeploy: vercel --prod"
        echo ""
        
        # Start tunnel
        cloudflared tunnel --url http://localhost:8000
        
        # Cleanup
        kill $BACKEND_PID
        ;;
    4)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
