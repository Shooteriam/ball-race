#!/bin/bash

echo "🚀 Ball Race - Quick Setup & Test"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "config.json" ]; then
    echo "❌ config.json not found. Please run from project root."
    exit 1
fi

echo "📋 Current configuration:"
echo "========================"

# Read basic config info
if command -v jq >/dev/null 2>&1; then
    echo "App: $(jq -r '.app.name' config.json) v$(jq -r '.app.version' config.json)"
    echo "Port: $(jq -r '.server.port' config.json)"
    echo "Environment: $(jq -r '.server.environment' config.json)"
    echo "Ball price: $(jq -r '.game.settings.ballPrice' config.json) stars"
    echo "Max balls per player: $(jq -r '.game.settings.maxBallsPerPlayer' config.json)"
    echo "Max players: $(jq -r '.game.settings.maxPlayers' config.json)"
else
    echo "Config file exists ✅"
fi

echo ""
echo "🔧 Testing server setup..."

cd server

if [ ! -f "package.json" ]; then
    echo "❌ server/package.json not found"
    exit 1
fi

echo "Testing config loading..."
if node test-config.js; then
    echo "✅ Server configuration test passed!"
else
    echo "❌ Server configuration test failed!"
    exit 1
fi

echo ""
echo "🎮 Starting server..."
echo "Press Ctrl+C to stop"
echo ""

npm start
