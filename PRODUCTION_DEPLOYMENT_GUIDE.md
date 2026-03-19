# Production Deployment Guide - Risk Management API

## Overview

This guide provides step-by-step instructions for deploying the Risk Management API system to a production environment with enterprise-grade reliability and scalability.

## Pre-Deployment Checklist

- [ ] All tests passing (unit, integration, performance)
- [ ] Environment variables configured securely
- [ ] Database backups created
- [ ] SSL/TLS certificates obtained
- [ ] Monitoring and alerting configured
- [ ] Team trained on deployment procedures
- [ ] Rollback plan documented and tested

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│         Load Balancer (NGINX)           │
│      (SSL/TLS Termination)              │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐┌────────┐┌────────┐
│API Pod1│ │API Pod2│ │API Pod3│
└────────┘└────────┘└────────┘
    │          │          │
    └──────────┬──────────┘
               ▼
    ┌──────────────────────┐
    │  Reverse Proxy       │
    │   (Express)          │
    └──────────────────────┘
               ▼
    ┌──────────────────────┐
    │  Oracle Cloud ORDS   │
    │   (with OAuth2)      │
    └──────────────────────┘
```

## 1. Server Configuration

### 1.1 System Requirements

**Minimum Requirements:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 10Mbps dedicated bandwidth

**Recommended for Production:**
- CPU: 8+ cores
- RAM: 16GB+
- Storage: 100GB+ SSD (RAID 1)
- Network: 100Mbps+ dedicated bandwidth
- CDN for static assets

### 1.2 OS Setup (Linux - Ubuntu 22.04 LTS)

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install NGINX for reverse proxy
sudo apt-get install -y nginx

# Install SSL support
sudo apt-get install -y certbot python3-certbot-nginx

# Create application user (non-root)
sudo useradd -m -s /bin/bash apiuser
```

### 1.3 Firewall Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow monitoring ports (internal only)
sudo ufw allow from 10.0.0.0/8 to any port 9090
```

## 2. Application Deployment

### 2.1 Clone and Setup

```bash
# Clone repository
cd /opt/applications
git clone <repository-url> risk-api
cd risk-api

# Install dependencies
npm ci --production

# Set ownership
sudo chown -R apiuser:apiuser /opt/applications/risk-api
```

### 2.2 Environment Configuration

```bash
# Create secure .env file
sudo nano /opt/applications/risk-api/.env

# Required variables:
NODE_ENV=production
PORT=5000
LOG_LEVEL=info
ORDS_BASE_URL=https://your-oracle-cloud-instance.com/ords/pericope_ai
ORDS_TOKEN_URL=https://your-oracle-cloud-instance.com/oauth2/token
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
JWT_SECRET=$(openssl rand -base64 32)
ENABLE_METRICS=true
RATE_LIMIT=1000

# Set restrictive permissions
sudo chmod 600 .env
```

### 2.3 Process Management with PM2

```bash
# Create PM2 ecosystem config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'risk-api',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      watch: false,
      max_memory_restart: '500M',
      node_args: '--max-old-space-size=2048',
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    }
  ],
  deploy: {
    production: {
      user: 'apiuser',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: '<repository-url>',
      path: '/opt/applications/risk-api',
      'post-deploy': 'npm ci --production && pm2 reload ecosystem.config.js --env production'
    }
  }
}
EOF

# Start application
pm2 start ecosystem.config.js --env production

# Monitor
pm2 monit

# Enable auto-restart on server reboot
pm2 startup systemd -u apiuser --hp /home/apiuser
pm2 save
```

## 3. NGINX Configuration

### 3.1 Reverse Proxy Setup

```bash
# Create NGINX config
sudo nano /etc/nginx/sites-available/risk-api

# Add this configuration:
upstream risk_api {
    # Load balance across PM2 cluster instances
    server 127.0.0.1:5000 max_fails=3 fail_timeout=30s;
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;

server {
    listen 80;
    server_name your-api-domain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-api-domain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-api-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-api-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    
    # Logging
    access_log /var/log/nginx/risk-api-access.log combined buffer=32k flush=5s;
    error_log /var/log/nginx/risk-api-error.log warn;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript;
    
    # Rate limiting
    limit_req zone=api_limit burst=200 nodelay;
    
    # Proxy to backend
    location /api/ {
        proxy_pass http://risk_api;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "upgrade";
        proxy_set_header Upgrade $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://risk_api/api/health;
        access_log off;
    }
}
EOF

# Enable configuration
sudo ln -s /etc/nginx/sites-available/risk-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3.2 SSL Certificate Setup

```bash
# Obtain Let's Encrypt certificate
sudo certbot certonly --nginx -d your-api-domain.com

# Auto-renewal (runs daily via cron)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Check renewal
sudo certbot renew --dry-run
```

## 4. Monitoring and Logging

### 4.1 Application Logging

```bash
# Create log rotation config
sudo nano /etc/logrotate.d/risk-api

# Add:
/opt/applications/risk-api/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 apiuser apiuser
    sharedscripts
}
```

### 4.2 Monitoring Stack

```bash
# Install Prometheus metrics collector
sudo npm install -g prometheus-node-exporter

# Install health check script
cat > /usr/local/bin/check-risk-api.sh << 'EOF'
#!/bin/bash

HEALTH_URL="https://your-api-domain.com/api/health"
MAX_RETRIES=3

for i in {1..MAX_RETRIES}; do
    if curl -sf $HEALTH_URL > /dev/null; then
        exit 0
    fi
    sleep 2
done

# Alert if health check fails
echo "Risk API health check failed" | mail -s "Alert: Risk API Down" ops@company.com
exit 1
EOF

chmod +x /usr/local/bin/check-risk-api.sh

# Add to crontab for hourly checks
(crontab -l 2>/dev/null; echo "0 * * * * /usr/local/bin/check-risk-api.sh") | crontab -
```

## 5. Database Optimization

```bash
# Ensure indexes are created on Oracle side
-- In Oracle:
CREATE INDEX idx_risk_assessments_status ON risk_assessments(status);
CREATE INDEX idx_identify_risk_created_date ON per_trn_identify_risk(created_date);
CREATE INDEX idx_mitigation_plans_status ON mitigation_plans(status);

-- Enable query result caching
ALTER SYSTEM SET result_cache_mode=FORCE;
ALTER SYSTEM SET result_cache_max_size=500M;
```

## 6. Backup Strategy

```bash
# Daily Oracle database backup
cat > /usr/local/bin/backup-oracle.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/backups/oracle"
DATE=$(date +%Y%m%d_%H%M%S)

# Export ORDS data to JSON
curl -X GET "https://your-oracle-instance/ords/pericope_ai/" \
  -H "Authorization: Bearer $ORDS_TOKEN" \
  -o "$BACKUP_DIR/backup_$DATE.json"

# Keep only last 30 days of backups
find $BACKUP_DIR -name "backup_*.json" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/backup-oracle.sh

# Add to crontab for daily 2 AM backups
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-oracle.sh") | crontab -
```

## 7. Disaster Recovery

### Rollback Procedure

```bash
# If deployment fails, quickly rollback:
pm2 list  # Check current version

# Revert to previous version
cd /opt/applications/risk-api
git checkout <previous-stable-commit>
npm ci --production
pm2 restart all

# Verify health
curl https://your-api-domain.com/api/health
```

### Data Recovery

```bash
# Restore from backup if database is corrupted
curl -X POST "https://your-oracle-instance/ords/admin/backup-restore" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"backup_file": "backup_20240319.json"}'
```

## 8. Performance Tuning

### Node.js Optimization

```bash
# Update PM2 config for better performance:
# - Increase max_memory from 500M to 2G for large datasets
# - Increase node_args --max-old-space-size to 4096
# - Enable clustering across all CPU cores
# - Set appropriate timeouts for long-running queries
```

### NGINX Optimization

```bash
# Increase worker connections
worker_connections 4096;

# Enable keepalive
keepalive_timeout 65;

# Buffer optimization
client_body_buffer_size 128k;
client_max_body_size 10m;
```

## 9. Deployment Steps

1. **Prepare**: Run `npm test` and load tests locally
2. **Stage**: Deploy to staging environment first
3. **Verify**: Run integration tests against staging
4. **Backup**: Create database backup
5. **Deploy**: Run deployment script
6. **Monitor**: Watch logs and metrics for 1 hour
7. **Verify**: Run smoke tests against production

## 10. Post-Deployment

- Monitor application logs for errors
- Check performance metrics dashboard
- Verify all API endpoints responding
- Confirm database connections stable
- Test failover procedures
- Document any issues encountered
- Update runbooks with findings

## Scaling Considerations

For handling higher load:

1. **Horizontal Scaling**: Add more application servers behind load balancer
2. **Database Optimization**: Add database indexes, increase connection pool
3. **Caching**: Implement Redis for distributed caching
4. **CDN**: Use CDN for static asset delivery
5. **API Versioning**: Version APIs for backward compatibility during updates

## Support and Troubleshooting

For issues, check:
- `/opt/applications/risk-api/logs/` for application logs
- `sudo journalctl -u risk-api` for system logs
- `pm2 logs` for PM2 process logs
- `curl https://your-api-domain.com/api/status` for API status
- `curl https://your-api-domain.com/api/metrics` for performance metrics
