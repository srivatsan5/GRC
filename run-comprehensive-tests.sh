#!/bin/bash

echo "=========================================="
echo "RISK MANAGEMENT API - COMPREHENSIVE TEST"
echo "=========================================="
echo ""

BASE_URL="http://localhost:5000"

# Function to test endpoint
test_endpoint() {
    local name=$1
    local endpoint=$2
    
    echo "Testing: $name"
    echo "  URL: GET $BASE_URL$endpoint"
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" 2>&1)
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        # Parse JSON response and get record count
        record_count=$(echo "$body" | grep -o '"data"' | wc -l)
        echo "  Status: ✅ 200 OK"
        echo "  Response: $(echo "$body" | wc -c) bytes"
        echo ""
    else
        echo "  Status: ❌ $http_code"
        echo "  Response: $body"
        echo ""
    fi
}

# Test key endpoints
test_endpoint "Health Check" "/api/health"
test_endpoint "Risk Categories (CRUD)" "/api/per_mst_risk_category"
test_endpoint "Identified Risks (CRUD)" "/api/per_trn_identify_risk"
test_endpoint "Dashboard Summary" "/api/dashboard/summary"
test_endpoint "Risk Trend" "/api/dashboard/risk-trend"
test_endpoint "Risk Distribution" "/api/dashboard/risk-distribution"
test_endpoint "API Metrics" "/api/metrics"
test_endpoint "API Status" "/api/status"

echo "=========================================="
echo "TEST COMPLETE"
echo "=========================================="
