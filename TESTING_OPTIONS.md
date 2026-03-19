# Testing the API - All Your Options

## ✅ YES - You Can Test with Postman WITHOUT Docker

The API can be tested in **4 different ways**. Here's what you need to know:

---

## Option 1: Local Node.js + Postman ⭐ (FASTEST)

### What you need:
- Node.js installed (v20+)
- Postman desktop app
- 2 minutes setup

### Steps:
```bash
# 1. Navigate to project directory
cd /path/to/risk-api

# 2. Start the backend
# Windows: Double-click start-api.bat
# Mac/Linux: ./start-api.sh
node server.js

# Output should show:
# ✨ Server is ready to handle requests!
# 🔗 Access Points:
#    • Health: GET /api/health
```

### 3. Open Postman and test:
```
GET http://localhost:5000/api/health
GET http://localhost:5000/api/status
GET http://localhost:5000/api/metrics
```

**Pros:**
- ✅ Fastest to setup (~2 min)
- ✅ No Docker needed
- ✅ Easy to debug
- ✅ See real-time console logs
- ✅ Can modify code and restart quickly

**Cons:**
- ❌ Oracle database must be accessible from your machine
- ❌ No NGINX reverse proxy (but not needed for testing)
- ❌ Only runs on your machine (can't share with team)

---

## Option 2: Docker Compose (FULL PRODUCTION SETUP)

### What you need:
- Docker Desktop installed
- 5-10 minutes setup

### Steps:
```bash
# 1. Start all services
docker-compose up -d

# 2. Verify containers are running
docker-compose ps

# 3. Test
curl http://localhost:5000/api/health
```

**Pros:**
- ✅ Full production-like environment
- ✅ NGINX reverse proxy included
- ✅ Prometheus metrics
- ✅ Grafana dashboards
- ✅ Exactly what production will look like

**Cons:**
- ❌ Slower to start
- ❌ Uses more resources
- ❌ Overkill if just testing endpoints

---

## Option 3: Command Line (curl) - NO POSTMAN NEEDED

### No app installation needed, just curl:

```bash
# Health check
curl http://localhost:5000/api/health

# Status
curl http://localhost:5000/api/status

# Metrics
curl http://localhost:5000/api/metrics

# Get all risks
curl http://localhost:5000/api/per_trn_identify_risk

# Create new assessment (with data)
curl -X POST http://localhost:5000/api/risk-assessments \
  -H "Content-Type: application/json" \
  -d '{
    "risk_id": "RISK-001",
    "assessment_type": "Inherent",
    "likelihood": "High",
    "impact": "Critical"
  }'
```

**Pros:**
- ✅ No apps to install
- ✅ Fast and simple
- ✅ Works on any machine

**Cons:**
- ❌ Less visual
- ❌ Harder to manage complex requests

---

## Option 4: npm Test Script

### Use built-in test commands:

```bash
# Run comprehensive API tests
npm run test

# Run performance tests
npx ts-node performance-test.ts

# Run load tests
npx ts-node load-test.ts
```

**Pros:**
- ✅ Tests all endpoints automatically
- ✅ Shows detailed metrics
- ✅ Great for CI/CD

**Cons:**
- ❌ Less interactive than Postman

---

## RECOMMENDATION: Start with Option 1

Here's the fastest path to test:

### Step 1: Start Backend (2 minutes)
```bash
# Windows
start-api.bat

# Mac/Linux
./start-api.sh

# Or manually
node server.js
```

### Step 2: Download Postman (if you don't have it)
https://www.postman.com/downloads/

### Step 3: Open Postman and create these requests:

**Request 1: Health Check**
```
GET http://localhost:5000/api/health
```
Click "Send" → Should get 200 OK with `"status": "healthy"`

**Request 2: Get All Risks**
```
GET http://localhost:5000/api/per_trn_identify_risk
```
Click "Send" → Should get 200 OK with list of risks

**Request 3: Create New Risk**
```
POST http://localhost:5000/api/risk-assessments
```
Set Headers:
```
Key: Content-Type
Value: application/json
```

Set Body (raw JSON):
```json
{
  "risk_id": "RISK-TEST-001",
  "assessment_type": "Inherent",
  "likelihood": "High",
  "impact": "Critical"
}
```
Click "Send" → Should get 201 Created

---

## Testing Checklist

After each setup option, verify:

- [ ] Server is running (check console logs)
- [ ] GET /api/health returns 200 OK
- [ ] GET /api/status returns details
- [ ] GET /api/metrics shows request stats
- [ ] GET /api/dashboard/summary returns data
- [ ] GET /api/per_trn_identify_risk returns list
- [ ] POST /api/risk-assessments creates record
- [ ] Response times are under 200ms

---

## Troubleshooting

### "Connection refused" Error
```
Problem: curl: (7) Failed to connect to localhost port 5000
Fix: Make sure server is running with: node server.js
```

### "Port 5000 already in use"
```
Problem: Error: listen EADDRINUSE: address already in use :::5000
Fix: Kill existing process:
  Windows: netstat -ano | findstr :5000, then taskkill /pid <PID> /f
  Mac/Linux: lsof -ti :5000 | xargs kill -9
```

### "CORS Error in Postman"
```
Problem: Access to XMLHttpRequest has been blocked by CORS policy
Fix: This is normal if frontend is on different port
     For backend testing, ignore CORS (it's just for browser)
```

### "Empty array returned"
```
Problem: GET /api/risk-assessments returns []
Possible causes:
  1. No data in database yet
  2. Oracle ORDS is unreachable
  3. Query filters excluded all rows

Check: curl http://localhost:5000/api/status
```

### "401 Unauthorized"
```
Problem: "error": "Invalid OAuth2 credentials"
Fix: Update .env with correct:
  - ORDS_TOKEN_URL
  - CLIENT_ID
  - CLIENT_SECRET

Then restart: node server.js
```

---

## Expected Results

If working correctly, you should see:

✅ **Health Check Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-19T12:00:00.000Z",
  "uptime": "5m 30s"
}
```

✅ **Status Response:**
```json
{
  "status": "operational",
  "environment": "development",
  "metrics": {
    "requestsPerMinute": 45,
    "averageResponseTime": "35ms",
    "successRate": "99.8%"
  }
}
```

✅ **Metrics Response:**
```json
{
  "totalRequests": 1234,
  "successfulRequests": 1231,
  "failedRequests": 3,
  "averageResponseTime": "35ms"
}
```

---

## Next Steps

1. ✅ Pick Option 1 (Node.js + Postman)
2. ✅ Start the server
3. ✅ Open Postman
4. ✅ Test 3 endpoints
5. ✅ Verify response times
6. ✅ Check error handling
7. ✅ Run load test: `npx ts-node load-test.ts`
8. ✅ Deploy to production!

---

## Still Unsure?

**Absolute simplest way to test:**

```bash
# Terminal 1: Start server
node server.js

# Terminal 2: Test (just copy/paste)
curl http://localhost:5000/api/health
curl http://localhost:5000/api/status  
curl http://localhost:5000/api/metrics
```

That's it. All 3 endpoints tested in 30 seconds.
