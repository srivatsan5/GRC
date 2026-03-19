#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Risk Management API - Quick Start Script              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}✗ Node.js not found${NC}"
    echo "Install from: https://nodejs.org/"
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env file not found!${NC}"
    echo "Creating .env file..."
    cat > .env << 'ENVEOF'
NODE_ENV=development
PORT=5000
LOG_LEVEL=info
ORDS_BASE_URL=https://your-oracle-instance.com/ords/pericope_ai
ORDS_TOKEN_URL=https://your-oracle-instance.com/oauth2/token
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
JWT_SECRET=$(openssl rand -base64 32)
ENABLE_METRICS=true
RATE_LIMIT=1000
ENVEOF
    echo -e "${YELLOW}✓ .env created - please update with your settings${NC}"
fi

# Check if port 5000 is already in use
if lsof -i :5000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Port 5000 is already in use${NC}"
    echo "Kill the process? (y/n)"
    read -r response
    if [ "$response" = "y" ]; then
        lsof -ti :5000 | xargs kill -9
        echo -e "${GREEN}✓ Process killed${NC}"
    else
        echo "Cannot start server. Exiting."
        exit 1
    fi
fi

# Start the server
echo -e "${GREEN}"
echo "Starting API server on port 5000..."
echo -e "${NC}"
echo ""
echo "Once started, test with:"
echo "  curl http://localhost:5000/api/health"
echo ""
echo "Or open Postman and use:"
echo "  GET http://localhost:5000/api/health"
echo "  GET http://localhost:5000/api/status"
echo "  GET http://localhost:5000/api/metrics"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

node server.js
