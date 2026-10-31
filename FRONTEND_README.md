# GRC Frontend - Hostinger Deployment

## Quick Start

### Option 1: Static Export (Shared Hosting)

1. Run: `npm run build`
2. Upload `.next/static` folder contents to `public_html`
3. Upload `.next/build-manifest.json` to `public_html`
4. Configure .htaccess for client-side routing

### Option 2: Node.js Deployment (VPS/Cloud)

1. Upload all files to your Hostinger server (datapulsefusion.com)
2. Run: `npm install --production`
3. Create `.env` file: `NEXT_PUBLIC_API_URL=https://api.datapulsefusion.com`
4. Run: `npm run build`
5. Run: `npm start`

## Environment Variables

Create `.env` file:

```
NEXT_PUBLIC_API_URL=https://api.datapulsefusion.com
```

**Frontend URL:** https://datapulsefusion.com
**Backend API URL:** https://api.datapulsefusion.com

## Production Setup (Recommended for Node.js)

Install and use PM2 for process management:

```bash
npm install -g pm2
pm2 start npm --name grc-frontend -- start
pm2 startup
pm2 save
```

## Application Pages

- / - Dashboard
- /rcsa/provisioning - Risk Assessments
- /rcsa/provisioning/[id] - Assessment Details
- /rcsa/provisioning/[id]/controls/[riskId] - Applied Controls
- /rcsa/identification - Risk Identification
- /rcsa/mitigation - Risk Mitigation
- /rcsa/monitoring - Risk Monitoring

For full documentation, see HOSTINGER_DEPLOYMENT_GUIDE.md
