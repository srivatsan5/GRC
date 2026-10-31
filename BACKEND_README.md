# GRC Backend - Hostinger Deployment

## Quick Start

1. Upload all files to your Hostinger server (api.datapulsefusion.com)
2. Run: `npm install`
3. Rename `.env.example` to `.env` and configure your Oracle APEX credentials
4. Run: `npm start`

## Environment Variables

Edit `.env` file with your values:

```
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
ORDS_BASE_URL=https://your-ords-url/ords/your_schema
ORDS_TOKEN_URL=https://your-ords-url/ords/your_schema/oauth/token
BASE_URL=https://your-ords-url/ords/your_schema
PORT=5000
```

**Backend URL:** https://api.datapulsefusion.com

## Production Setup (Recommended)

Install and use PM2 for process management:

```bash
npm install -g pm2
pm2 start server.js --name grc-backend
pm2 startup
pm2 save
```

## API Endpoints

- GET /api/{table_name}
- POST /api/{table_name}
- PUT /api/{table_name}/{id}
- DELETE /api/{table_name}/{id}

For full documentation, see HOSTINGER_DEPLOYMENT_GUIDE.md
