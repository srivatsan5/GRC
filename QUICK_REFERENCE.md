# Quick Reference: Running the Production-Ready Risk API

## Start the System

### Option 1: Docker (Recommended for Production)
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Option 2: Local Development
```bash
# Install dependencies
npm install

# Start backend
node server.js

# In another terminal, start frontend
npm run dev
```

## Health Checks

```bash
# Basic health
curl http://localhost:5000/api/health

# Detailed status
curl http://localhost:5000/api/status

# Performance metrics
curl http://localhost:5000/api/metrics

# Example response:
{
  "status": "healthy",
  "timestamp": "2026-03-19T12:00:00.000Z",
  "uptime": "2h 15m 30s",
  "metrics": {
    "requestsPerMinute": 245,
    "averageResponseTime": "35ms",
    "successRate": "99.8%",
    "cacheHitRate": "75%"
  }
}
```

## Configuration

### Environment Variables
```bash
NODE_ENV=production
PORT=5000
LOG_LEVEL=info
ORDS_BASE_URL=https://your-oracle-cloud.com/ords/pericope_ai
ORDS_TOKEN_URL=https://your-oracle-cloud.com/oauth2/token
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
JWT_SECRET=$(openssl rand -base64 32)
ENABLE_METRICS=true
RATE_LIMIT=1000
```

## API Endpoints

### Dashboard APIs
```bash
GET /api/dashboard/summary
GET /api/dashboard/risk-trend
GET /api/dashboard/risk-distribution
GET /api/dashboard/risk-by-category
GET /api/dashboard/risk-by-process
GET /api/dashboard/control-effectiveness
GET /api/dashboard/monitoring-status
```

### Data APIs
```bash
# Identify Risks
GET /api/per_trn_identify_risk
POST /api/per_trn_identify_risk
PUT /api/per_trn_identify_risk/:id
DELETE /api/per_trn_identify_risk/:id

# Risk Assessments
GET /api/risk-assessments
POST /api/risk-assessments
PUT /api/risk-assessments/:id
DELETE /api/risk-assessments/:id

# Mitigation Plans
GET /api/mitigation-plans
POST /api/mitigation-plans
PUT /api/mitigation-plans/:id
DELETE /api/mitigation-plans/:id

# Master Data (Read-Only)
GET /api/per_mst_risk_category
GET /api/per_mst_control_type
GET /api/per_mst_business_process
GET /api/impact
GET /api/likelihood
```

## Performance Testing

### Run Performance Tests
```bash
# Node.js 20+ required
npx ts-node performance-test.ts

# Expected output:
# ✅ Results for GET dashboard/summary:
#    • Total Requests: 5000
#    • Avg Response: 42ms
#    • P95 Response: 85ms
#    • Throughput: 167 req/s
```

### Run Load Tests
```bash
npx ts-node load-test.ts

# Tests three scenarios:
# 1. Dashboard View (Light Load)
# 2. Risk Management (Medium Load)
# 3. Master Data (Heavy Cache)
```

## Troubleshooting

### Backend won't start
```bash
# Check ports
lsof -i :5000

# Check logs
docker-compose logs api

# Verify environment
cat .env | grep ORDS
```

### Slow responses
```bash
# Check metrics
curl http://localhost:5000/api/metrics | jq '.metrics'

# Monitor logs
tail -f logs/error.log
docker-compose logs -f api

# Check cache status
curl http://localhost:5000/api/metrics | jq '.cache'
```

### High error rate
```bash
# Get error details
curl http://localhost:5000/api/status | jq '.errors'

# Check database connectivity
curl -I http://localhost:5000/api/health

# Verify Oracle ORDS
curl $ORDS_BASE_URL/health
```

## Deployment Commands

### Deploy to Production (Ubuntu Server)
```bash
# SSH into server
ssh user@your-api-server.com

# Clone repository
cd /opt/applications
git clone <repo-url> risk-api
cd risk-api

# Setup environment
cp .env.example .env
# Edit .env with production values
nano .env

# Install and start
npm ci --production
pm2 start ecosystem.config.js --env production

# Verify
curl https://your-api-domain.com/api/health
```

### Docker Deployment
```bash
# Build image
docker build -t risk-api:latest .

# Tag for registry
docker tag risk-api:latest your-registry.com/risk-api:latest

# Push to registry
docker push your-registry.com/risk-api:latest

# Pull and run on server
docker pull your-registry.com/risk-api:latest
docker-compose up -d
```

## Monitoring

### Check Real-Time Metrics
```bash
# Terminal 1: Watch API metrics
watch -n 5 'curl -s http://localhost:5000/api/metrics | jq ".metrics"'

# Terminal 2: Watch server status
docker stats

# Terminal 3: Stream logs
docker-compose logs -f api
```

### View Prometheus Metrics (if enabled)
```bash
# Access Prometheus
curl http://localhost:9090/api/v1/query?query=request_duration_ms

# Or open browser
open http://localhost:9090
```

### View Grafana Dashboards (if enabled)
```bash
# Access Grafana
# Open browser: http://localhost:3001
# Default: admin / admin
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| 429 Too Many Requests | Rate limit exceeded | Wait or increase RATE_LIMIT |
| 503 Service Unavailable | API overloaded | Scale horizontally or check database |
| Empty arrays in response | Cache issue | Clear cache: `curl http://localhost:5000/api/cache-clear` |
| CORS errors | Origin not whitelisted | Add to CORS_ORIGINS in .env |
| Database connection failed | ORDS unreachable | Verify ORDS_BASE_URL and network |
| High memory usage | Memory leak | Restart: `docker-compose restart api` |

## Performance Targets

✅ Response Time: < 100ms (avg), < 200ms (p99)
✅ Success Rate: > 99%
✅ Cache Hit Rate: > 70%
✅ Throughput: > 500 req/s
✅ Error Rate: < 1%
✅ Uptime: > 99.9%

## Support Resources

- 📖 Full Guide: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- 📊 Summary: `PRODUCTION_OPTIMIZATION_SUMMARY.md`
- 📝 API Docs: `API_ARCHITECTURE_DIAGRAM.txt`
- 🧪 Tests: `test-all-apis.js`, `integration-test.mjs`
- 📚 Architecture: `README_API_SETUP.md`

## Contact

For issues or questions:
1. Check logs: `docker-compose logs api`
2. Review status: `curl http://localhost:5000/api/status`
3. Run health check: `curl http://localhost:5000/api/health`
4. Contact: ops-team@company.com
