# Testing with Postman - Complete Guide

## Step 1: Start the Backend (No Docker needed)

### Option A: Direct Node.js
```bash
# In your project directory
node server.js
```

You should see output like:
```
[INFO] 2026-03-19T12:00:00.000Z: Registering CRUD routes for tables...
[INFO] 2026-03-19T12:00:00.500Z: 
╔════════════════════════════════════════════════════════════════╗
║        🚀 Risk Management API Server Started Successfully!     ║
╚════════════════════════════════════════════════════════════════╝

📍 Configuration:
   • Port: 5000
   • Environment: development
   
✨ Server is ready to handle requests!
```

### Option B: Using npm script (if available)
```bash
npm start
# or
npm run dev
```

**Server is now running on: `http://localhost:5000`**

---

## Step 2: Import Postman Collection

### Method 1: Create Collection Manually

Open Postman and create these requests:

#### 1. **Health Check** (Test if API is running)
```
GET http://localhost:5000/api/health

Expected Response: 200 OK
{
  "status": "healthy",
  "timestamp": "2026-03-19T12:00:00.000Z",
  "uptime": "5m 30s"
}
```

#### 2. **API Status**
```
GET http://localhost:5000/api/status

Expected Response: 200 OK
{
  "status": "operational",
  "environment": "development",
  "timestamp": "2026-03-19T12:00:00.000Z",
  "uptime": "5m 30s",
  "metrics": {
    "requestsPerMinute": 45,
    "averageResponseTime": "35ms",
    "successRate": "99.8%"
  }
}
```

#### 3. **API Metrics**
```
GET http://localhost:5000/api/metrics

Expected Response: 200 OK
{
  "timestamp": "2026-03-19T12:00:00.000Z",
  "metrics": {
    "totalRequests": 1234,
    "successfulRequests": 1231,
    "failedRequests": 3,
    "averageResponseTime": "35ms",
    "requestsPerMinute": 45,
    "successRate": "99.76%"
  }
}
```

---

## Step 3: Test Dashboard Endpoints

#### Get Dashboard Summary
```
GET http://localhost:5000/api/dashboard/summary
```

#### Get Risk Trend
```
GET http://localhost:5000/api/dashboard/risk-trend
```

#### Get Risk Distribution
```
GET http://localhost:5000/api/dashboard/risk-distribution
```

#### Get Risk by Category
```
GET http://localhost:5000/api/dashboard/risk-by-category
```

---

## Step 4: Test Data Endpoints

### GET Requests (No Body Needed)

#### Get All Identify Risks
```
GET http://localhost:5000/api/per_trn_identify_risk

With pagination:
GET http://localhost:5000/api/per_trn_identify_risk?limit=10&offset=0
```

#### Get All Risk Assessments
```
GET http://localhost:5000/api/risk-assessments
```

#### Get All Mitigation Plans
```
GET http://localhost:5000/api/mitigation-plans
```

#### Get Master Data (Reference Tables)
```
GET http://localhost:5000/api/per_mst_risk_category
GET http://localhost:5000/api/per_mst_control_type
GET http://localhost:5000/api/per_mst_business_process
GET http://localhost:5000/api/impact
GET http://localhost:5000/api/likelihood
GET http://localhost:5000/api/control-frequency
```

---

## Step 5: Test CRUD Operations

### CREATE (POST)

#### Create New Risk Assessment
```
POST http://localhost:5000/api/risk-assessments

Headers:
Content-Type: application/json

Body (JSON):
{
  "risk_id": "RISK-001",
  "assessment_type": "Inherent",
  "likelihood": "High",
  "impact": "Critical",
  "created_date": "2026-03-19"
}

Expected Response: 201 Created
```

#### Create New Mitigation Plan
```
POST http://localhost:5000/api/mitigation-plans

Headers:
Content-Type: application/json

Body (JSON):
{
  "plan_id": "MIT-001",
  "risk_id": "RISK-001",
  "mitigation_strategy": "Implement additional controls",
  "target_date": "2026-06-19",
  "status": "In Progress"
}

Expected Response: 201 Created
```

### UPDATE (PUT)

#### Update Risk Assessment
```
PUT http://localhost:5000/api/risk-assessments/1

Headers:
Content-Type: application/json

Body (JSON):
{
  "likelihood": "Medium",
  "impact": "High",
  "status": "Updated"
}

Expected Response: 200 OK
```

### DELETE

#### Delete Mitigation Plan
```
DELETE http://localhost:5000/api/mitigation-plans/1

Expected Response: 204 No Content
(or 200 OK depending on Oracle implementation)
```

---

## Step 6: Test Error Scenarios

### Test Rate Limiting (Send many requests quickly)
```
# Send 50 requests rapidly in a loop
for i in {1..50}; do
  curl http://localhost:5000/api/health
done

# After exceeding limit (1000 req/15min), you'll get:
429 Too Many Requests
{
  "error": "Rate limit exceeded",
  "retryAfter": 300
}
```

### Test Invalid Input
```
POST http://localhost:5000/api/risk-assessments

Body:
{
  "invalid_field": "test"
}

Expected: 400 Bad Request
```

### Test Non-existent Resource
```
GET http://localhost:5000/api/risk-assessments/99999

Expected: 404 Not Found
```

### Test Server Error (simulate with invalid ORDS URL temporarily)
```
GET http://localhost:5000/api/dashboard/summary

If ORDS is unreachable:
503 Service Unavailable
{
  "error": "Oracle ORDS unreachable",
  "message": "Could not connect to database"
}
```

---

## Postman Collection JSON (Import This)

Create a new file called `Risk-API-Collection.postman_collection.json`:

```json
{
  "info": {
    "name": "Risk Management API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "http://localhost:5000/api/health"
      }
    },
    {
      "name": "Status",
      "request": {
        "method": "GET",
        "url": "http://localhost:5000/api/status"
      }
    },
    {
      "name": "Metrics",
      "request": {
        "method": "GET",
        "url": "http://localhost:5000/api/metrics"
      }
    },
    {
      "name": "Dashboard Summary",
      "request": {
        "method": "GET",
        "url": "http://localhost:5000/api/dashboard/summary"
      }
    },
    {
      "name": "Get All Risks",
      "request": {
        "method": "GET",
        "url": "http://localhost:5000/api/per_trn_identify_risk"
      }
    },
    {
      "name": "Get All Assessments",
      "request": {
        "method": "GET",
        "url": "http://localhost:5000/api/risk-assessments"
      }
    },
    {
      "name": "Create Assessment",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "url": "http://localhost:5000/api/risk-assessments",
        "body": {
          "mode": "raw",
          "raw": "{\"risk_id\": \"RISK-001\", \"assessment_type\": \"Inherent\", \"likelihood\": \"High\"}"
        }
      }
    },
    {
      "name": "Update Assessment",
      "request": {
        "method": "PUT",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "url": "http://localhost:5000/api/risk-assessments/1",
        "body": {
          "mode": "raw",
          "raw": "{\"likelihood\": \"Medium\", \"impact\": \"High\"}"
        }
      }
    },
    {
      "name": "Delete Assessment",
      "request": {
        "method": "DELETE",
        "url": "http://localhost:5000/api/risk-assessments/1"
      }
    }
  ]
}
```

**To import**: 
1. Open Postman
2. Click "Import" (top left)
3. Choose "Raw text" and paste the JSON
4. Click "Import"

---

## Troubleshooting

### API won't connect
```bash
# Check if server is running
curl http://localhost:5000/api/health

# If no response, start the server:
node server.js

# Check what's using port 5000
lsof -i :5000

# If port is in use, kill it:
kill -9 <PID>
```

### Getting authentication errors
```
401 Unauthorized
"error": "Invalid OAuth2 credentials"

Fix: Check your .env file
- ORDS_TOKEN_URL
- CLIENT_ID
- CLIENT_SECRET
```

### Getting database connection errors
```
503 Service Unavailable
"error": "Oracle ORDS unreachable"

Fix:
1. Verify ORDS_BASE_URL in .env
2. Check network connectivity: ping your-oracle-cloud.com
3. Verify firewall allows outbound HTTPS
```

### Response shows empty arrays
```bash
# This is normal - could mean:
# 1. No data in database yet
# 2. Cache is returning empty result
# 3. Query filter excluded all rows

# To verify, check server logs:
tail -f logs/error.log
```

---

## Performance Testing in Postman

### Test with Postman's Collection Runner

1. **Create a collection** with your requests
2. **Click "Runner"** (bottom left)
3. **Select your collection**
4. **Set iterations**: 10
5. **Set delay**: 100ms
6. **Click "Run"**

This will run all requests 10 times with 100ms between requests.

---

## Expected Response Times

After seeing these, you'll know it's working well:

| Endpoint | Response Time | Status |
|----------|---------------|--------|
| /health | < 5ms | ✅ Excellent |
| /status | < 10ms | ✅ Excellent |
| /dashboard/summary | 20-50ms | ✅ Good |
| /risk-assessments (GET) | 30-100ms | ✅ Good |
| /risk-assessments (POST) | 100-500ms | ✅ Good |
| All endpoints | < 200ms (p99) | ✅ Acceptable |

---

## Next Steps After Testing

1. ✅ Test all endpoints work
2. ✅ Verify response times are acceptable
3. ✅ Check error handling (400, 401, 404, 500)
4. ✅ Monitor logs for any warnings
5. ✅ Run load test: `npx ts-node load-test.ts`
6. ✅ Then deploy to production with confidence

---

## Still Have Issues?

1. **Check logs**: `tail -f logs/*.log`
2. **Verify .env**: `cat .env`
3. **Test health**: `curl http://localhost:5000/api/health`
4. **Check port**: `netstat -an | grep 5000`
5. **Restart server**: Stop and run `node server.js` again
