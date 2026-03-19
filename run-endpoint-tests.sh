#!/bin/bash

echo "=========================================="
echo "RISK MANAGEMENT API - ENDPOINT TESTS"
echo "=========================================="
echo ""

BASE_URL="http://localhost:5000"
RESULTS_FILE="endpoint_test_results.txt"

# Clear results file
> "$RESULTS_FILE"

# Function to test an endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local expected_code=$4
    
    echo "Testing: $name"
    echo "  URL: $method $BASE_URL$endpoint"
    
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json")
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    echo "  Status: $http_code"
    
    if [ "$http_code" -eq "$expected_code" ]; then
        echo "  Result: ✅ PASS"
        echo "$name: ✅ PASS ($http_code)" >> "$RESULTS_FILE"
    else
        echo "  Result: ❌ FAIL (expected $expected_code)"
        echo "$name: ❌ FAIL (got $http_code, expected $expected_code)" >> "$RESULTS_FILE"
    fi
    
    # Show response preview
    if [ ! -z "$body" ] && [ ${#body} -lt 200 ]; then
        echo "  Response: $body" | head -c 150
        echo ""
    fi
    echo ""
}

# Test endpoints
test_endpoint "Health Check" "GET" "/api/health" "200"
test_endpoint "Risk Categories" "GET" "/api/risk-categories" "200"
test_endpoint "Identified Risks" "GET" "/api/identified-risks" "200"
test_endpoint "Risk Categories Count" "GET" "/api/risk-categories-count" "200"
test_endpoint "Risks by Category" "GET" "/api/risks-by-category" "200"
test_endpoint "API Metrics" "GET" "/api/metrics" "200"
test_endpoint "Server Status" "GET" "/api/status" "200"

echo "=========================================="
echo "ENDPOINT TESTS COMPLETE"
echo "=========================================="
echo ""
echo "Results saved to: $RESULTS_FILE"
cat "$RESULTS_FILE"
