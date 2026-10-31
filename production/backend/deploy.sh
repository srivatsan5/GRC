#!/bin/bash
# ============================================
# Pericope API Proxy — Deployment Script
# Run this on your Hostinger VPS after uploading files
# ============================================

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║   Pericope API Proxy — Deployment Script     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Step 1: Install dependencies
echo "▸ [1/5] Installing dependencies..."
npm install --production
echo "  ✓ Dependencies installed"
echo ""

# Step 2: Verify .env exists
echo "▸ [2/5] Checking .env file..."
if [ ! -f .env ]; then
  echo "  ⚠ .env file missing! Creating from example..."
  cp .env.example .env
  echo "  ✓ .env created from .env.example"
else
  echo "  ✓ .env file exists"
fi
echo ""

# Step 3: Quick connectivity test to ORDS
echo "▸ [3/5] Testing ORDS connectivity..."
ORDS_URL=$(grep ORDS_BASE_URL .env | cut -d'=' -f2-)
if curl -s -o /dev/null -w "%{http_code}" "${ORDS_URL}/per_trn_identify_risk/" | grep -q "200"; then
  echo "  ✓ ORDS database is reachable"
else
  echo "  ⚠ ORDS database may be unreachable — check .env ORDS_BASE_URL"
fi
echo ""

# Step 4: Stop old PM2 process if running
echo "▸ [4/5] Managing PM2 process..."
if pm2 list 2>/dev/null | grep -q "pericope-api"; then
  echo "  Stopping existing pericope-api process..."
  pm2 delete pericope-api 2>/dev/null || true
fi
echo "  Starting fresh with ecosystem.config.cjs..."
pm2 start ecosystem.config.cjs
pm2 save
echo "  ✓ PM2 process started and saved"
echo ""

# Step 5: Verify the API is responding
echo "▸ [5/5] Verifying API endpoints..."
sleep 2

# Health check
echo -n "  Health: "
curl -s http://localhost:5000/ | head -c 100
echo ""

# API route check
echo -n "  API:    "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/per_trn_identify_risk)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ /api/per_trn_identify_risk → 200 OK"
else
  echo "✗ /api/per_trn_identify_risk → $HTTP_CODE (check pm2 logs)"
fi
echo ""

echo "══════════════════════════════════════════════"
echo "  Deployment complete!"
echo "  Run 'pm2 logs pericope-api' to monitor"
echo "══════════════════════════════════════════════"
