# GRC Application - Hostinger Deployment Guide

## Overview

This guide will help you deploy the GRC (Governance, Risk, and Compliance) application to Hostinger. The application consists of:
- **Backend**: Node.js/Express API server
- **Frontend**: Next.js React application

## Prerequisites

- Hostinger account with Node.js hosting
- Access to Oracle APEX ORDS endpoint
- FTP/SFTP access or File Manager access to Hostinger

---

## Part 1: Backend Deployment

### Files Included in `hostinger-backend-deployment.zip`

- `server.js` - Express server with API endpoints
- `package.json` - Backend dependencies
- `.env` - Environment variables (update with your values)

### Deployment Steps

1. **Upload Files**
   - Extract `hostinger-backend-deployment.zip`
   - Upload all files to your Hostinger server (e.g., in a `backend` folder)

2. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Configure Environment Variables**
   - Edit `.env` file with your Oracle APEX credentials:
   ```env
   CLIENT_ID=your_client_id
   CLIENT_SECRET=your_client_secret
   ORDS_BASE_URL=https://your-ords-url/ords/your_schema
   ORDS_TOKEN_URL=https://your-ords-url/ords/your_schema/oauth/token
   BASE_URL=https://your-ords-url/ords/your_schema
   PORT=5000
   ```
   - The backend will be hosted at: **https://api.datapulsefusion.com**

4. **Start the Server**
   ```bash
   npm start
   ```
   The server will run on port 5000

5. **Setup PM2 (Recommended for Production)**
   ```bash
   npm install -g pm2
   pm2 start server.js --name grc-backend
   pm2 startup
   pm2 save
   ```

### Backend API Endpoints

The backend provides generic CRUD endpoints for all tables:

- `GET /api/{table_name}` - Fetch all records
- `POST /api/{table_name}` - Create new record
- `PUT /api/{table_name}/{id}` - Update record
- `DELETE /api/{table_name}/{id}` - Delete record

### Supported Tables

**Master Tables:**
- per_mst_business_process
- per_mst_business_sub_process
- per_mst_risk_statement
- per_mst_roles
- per_mst_control_category
- per_mst_control_clasification
- per_mst_control_design_effectiveness
- per_mst_control_frequency
- per_mst_control_register
- per_mst_control_type
- per_mst_currency_type
- per_mst_designation
- per_mst_impact
- per_mst_impact_category
- per_mst_impact_parties
- per_mst_impact_sub_category
- per_mst_likelihood
- per_mst_org_hierarchy
- per_mst_org_level
- per_mst_risk_category
- per_mst_risk_causal_factor
- per_mst_risk_compuation_logic
- per_mst_risk_cycle
- per_mst_risk_data_source
- per_mst_risk_root_cause
- per_mst_risk_sub_category
- per_mst_risk_type
- per_mst_user_details
- per_mst_user_roles_mapping

**Transaction Tables:**
- per_trn_control_implementation
- per_trn_identify_risk
- per_trn_impact_category
- per_trn_inherent_risk_assessment
- per_trn_mitigation_plans
- per_trn_mitigation_type
- per_trn_risk_monitoring

---

## Part 2: Frontend Deployment

### Option A: Static Export (Recommended for Shared Hosting)

1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Upload Built Files**
   - Upload the contents of `.next/static` folder to your `public_html` directory
   - Upload the `.next/build-manifest.json` file

3. **Configure .htaccess**
   Create or update `.htaccess` in `public_html`:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

### Option B: Node.js Deployment (VPS/Cloud Hosting)

1. **Upload Source Files**
   - Upload the entire project folder to your Hostinger server

2. **Install Dependencies**
   ```bash
   npm install --production
   ```

3. **Configure Environment Variables**
   Create `.env` file:
   ```env
   NEXT_PUBLIC_API_URL=https://api.datapulsefusion.com
   ```
   - The frontend will be hosted at: **https://datapulsefusion.com**

4. **Build the Application**
   ```bash
   npm run build
   ```

5. **Start the Application**
   ```bash
   npm start
   ```

6. **Setup PM2**
   ```bash
   pm2 start npm --name grc-frontend -- start
   pm2 startup
   pm2 save
   ```

---

## Application Structure

### Frontend Pages

- `/` - Home/Dashboard
- `/rcsa/provisioning` - Risk Assessments (3.1 Provisioning)
- `/rcsa/provisioning/[id]` - Assessment Details (3.1.1.1)
- `/rcsa/provisioning/[id]/controls/[riskId]` - Applied Controls (3.1.1.3)
- `/rcsa/identification` - Risk Identification (3.2)
- `/rcsa/mitigation` - Risk Mitigation (3.3)
- `/rcsa/mitigation/[id]` - Mitigation Details
- `/rcsa/monitoring` - Risk Monitoring (4.4)

### Features

- ✅ Full CRUD operations for risk assessments
- ✅ Risk identification and control tagging
- ✅ Heat map calculation (Max Impact × Max Likelihood)
- ✅ Real-time data fetching with React Query
- ✅ Smooth animations with Framer Motion
- ✅ Responsive design with Tailwind CSS
- ✅ Form validation with Zod
- ✅ Toast notifications for user feedback
- ✅ All button clicks mapped to API functions
- ✅ Loading states and error handling

---

## Troubleshooting

### Backend Issues

**Server won't start:**
- Check if port 5000 is available
- Verify environment variables are set correctly
- Check Oracle APEX credentials are valid

**API returns 404:**
- Verify table names match Oracle schema exactly
- Check ORDS endpoint URL is correct

### Frontend Issues

**Build fails:**
- Ensure all dependencies are installed
- Check Node.js version (requires >=18.0.0)

**API calls fail:**
- Verify NEXT_PUBLIC_API_URL is set correctly
- Check backend is running and accessible
- Check CORS configuration on backend

---

## Security Notes

1. **Never commit .env files to version control**
2. **Use strong passwords for Oracle APEX credentials**
3. **Enable HTTPS on your Hostinger domain**
4. **Keep dependencies updated**
5. **Use PM2 for process management in production**

---

## Support

For issues or questions:
- Check the application logs
- Verify Oracle APEX ORDS endpoint is accessible
- Test API endpoints using tools like Postman or curl
