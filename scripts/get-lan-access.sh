#!/bin/bash

# Get LAN IP Address Script
# This script shows how to access the GeekyGoose Compliance webapp from your LAN

echo "🦆 GeekyGoose Compliance - LAN Access Information"
echo "=================================================="
echo ""

# Get the current machine's IP address
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    IP=$(hostname -I | awk '{print $1}')
    if [ -z "$IP" ]; then
        IP=$(ip route get 1 | awk '{print $7; exit}')
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac OS X
    IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash/Cygwin)
    IP=$(ipconfig | grep "IPv4 Address" | head -1 | awk -F: '{print $2}' | sed 's/^ *//')
else
    echo "Unable to detect operating system. Please find your local IP manually."
    echo "Look for your computer's IP address on your local network."
    exit 1
fi

if [ -z "$IP" ]; then
    echo "❌ Could not determine local IP address automatically."
    echo "Please find your computer's IP address manually:"
    echo ""
    echo "On Linux:   ip addr show | grep 'inet '"
    echo "On macOS:   ifconfig | grep 'inet '"
    echo "On Windows: ipconfig"
    echo ""
    echo "Then access: http://YOUR-IP-ADDRESS:3000"
else
    echo "✅ Your GeekyGoose Compliance webapp is accessible at:"
    echo ""
    echo "   🌐 LAN URL: http://$IP:3000"
    echo ""
    echo "📱 Access from any device on your network:"
    echo "   • Open a web browser on any device connected to your LAN"
    echo "   • Navigate to: http://$IP:3000"
    echo ""
    echo "🔐 Security Notes:"
    echo "   • Frontend (Next.js): Accessible from LAN on port 3000"
    echo "   • Backend services: Protected in internal Docker network"
    echo "   • Database, Redis, MinIO: No external access"
    echo ""
    echo "🚀 To start the application:"
    echo "   docker-compose up -d"
    echo ""
fi

# Check if Docker containers are running
echo "📋 Container Status:"
if command -v docker &> /dev/null; then
    if docker-compose ps 2>/dev/null | grep -q "Up"; then
        echo "   ✅ Docker containers are running"
    else
        echo "   ⚠️  Docker containers not detected. Run: docker-compose up -d"
    fi
else
    echo "   ⚠️  Docker not found. Please install Docker and Docker Compose"
fi

echo ""
echo "📖 For more information, see the README.md file"