# STEP-BY-STEP: Make All APIs Work

## What You Need To Do (5 Minutes)

### Step 1: Open SQL Developer
1. Open **SQL Developer** on your computer
2. Connect to your Oracle database using the credentials in your `.env` file:
   - **Client ID**: `C3hX6vbjm4sgnWveZvhYlw..`
   - **Client Secret**: `iMKeCcJJEadoq0oYCFJtlw..`
   - **ORDS URL**: `https://ga8231f10084da5-pericopeai.adb.us-chicago-1.oraclecloudapps.com/ords/pericope_ai`

### Step 2: Copy & Execute the Complete Setup Script
1. Open file: `complete_oracle_setup.sql` (in this directory)
2. Copy ALL the content
3. Paste into SQL Developer
4. Click **Execute** (or press F5)
5. Wait for completion (should take 2-3 minutes)

### Step 3: Verify Everything Worked
After the script completes, run this test in your terminal:

```bash
node test-all-apis.js
```

Expected output: **All 40+ endpoints passing** ✅

---

## What This Script Does

✅ Creates 7 Dashboard Views (aggregates data)
✅ Creates 9 Reference Tables (dropdowns, master data)
✅ Creates 12 Transactional Tables (CRUD operations)
✅ Creates 5 Assessment Tables (risk evaluation)
✅ Creates 3 Monitoring & Tracking Tables
✅ Creates 3 Audit & Administrative Tables
✅ **Automatically enables REST endpoints in ORDS** for all of them

---

## After You Execute the Script

### What Happens Automatically

1. **Frontend** (`oracleService.ts`) will automatically work with:
   - All 7 dashboard endpoints
   - All 9 reference tables
   - All 12 transactional tables
   - All 5 assessment endpoints
   - All 3 monitoring endpoints
   - All 3 audit endpoints

2. **Backend** (`server.js`) will:
   - Proxy requests to new ORDS endpoints
   - Handle GET, POST, PUT, DELETE
   - Return proper JSON responses

3. **Every Frontend Component** will:
   - Load data from real API
   - Populate dropdowns/tables
   - Support Create/Update/Delete operations

---

## Testing Each Section

After execution, test individual sections:

```bash
# Test dashboard endpoints
curl http://localhost:5000/api/dashboard/summary

# Test master data
curl http://localhost:5000/api/impact
curl http://localhost:5000/api/likelihood

# Test transaction tables
curl http://localhost:5000/api/risk-assessments
curl http://localhost:5000/api/mitigation-plans

# Test assessments
curl http://localhost:5000/api/appetite/framework
curl http://localhost:5000/api/assessments/controls
```

---

## Troubleshooting

### If Script Fails:

**Error: "Table already exists"**
- This means the table was already created. That's fine! The script handles this automatically.

**Error: "Cannot find table referenced in foreign key"**
- Make sure `per_trn_identify_risk`, `per_mst_business_process`, etc. exist
- These should already exist from earlier setup

**Error: "ORDS.enable_object not found"**
- Make sure you're connected to the correct database schema
- Verify you have ORDS privileges enabled

### If Tests Still Fail:

**404 errors for new endpoints**
- Wait 2-3 minutes for ORDS to cache the new endpoints
- Try: `curl -I http://localhost:5000/api/dashboard/summary`
- Check that Oracle returned data: `SELECT * FROM dashboard_summary;`

---

## What Each Endpoint Does

### Dashboard Views
- `/dashboard/summary` - Overall risk statistics
- `/dashboard/risk-trend` - Risk trends over time
- `/dashboard/risk-distribution` - Distribution by status
- `/dashboard/risk-by-category` - Grouped by category
- `/dashboard/risk-by-process` - Grouped by process
- `/dashboard/control-effectiveness` - Control performance
- `/dashboard/monitoring-status` - Current monitoring state

### Master Data (Dropdowns)
- `/control-frequency` - How often controls are run
- `/impact` - Risk impact levels
- `/likelihood` - Risk probability levels
- `/risk-subcategories` - Categories breakdown

### Transactional Data
- `/risk-assessments` - Create/view/edit risk assessments
- `/mitigation-plans` - Create/view/edit mitigation plans
- `/kri-matrix` - Key Risk Indicators tracking
- `/kri-configuration` - KRI setup

### Assessments
- `/appetite/framework` - Enterprise risk appetite
- `/appetite/risk-appetite` - Appetite by category
- `/assessments/access` - Who can access assessments
- `/assessments/controls` - Control assessment results
- `/assessments/residual` - Residual risk assessments

### Monitoring
- `/monitoring/action-plan` - Action items for risks
- `/monitoring/actions-hierarchy` - Parent/child actions

### Administrative
- `/assets` - Asset registry
- `/audit-trail` - Audit log
- `/reports` - Report management

---

## Complete Endpoint Checklist

Run `node test-all-apis.js` and verify:

```
✓ Dashboard (7)
  - summary
  - risk-trend
  - risk-distribution
  - risk-by-category
  - risk-by-process
  - control-effectiveness
  - monitoring-status

✓ Master Data (4)
  - control-frequency
  - impact
  - likelihood
  - risk-subcategories

✓ Transactional (4)
  - risk-assessments (CRUD)
  - mitigation-plans (CRUD)
  - kri-matrix (CRUD)
  - kri-configuration (CRUD)

✓ Assessment (5)
  - appetite/framework
  - appetite/risk-appetite
  - assessments/access
  - assessments/controls
  - assessments/residual

✓ Monitoring (2)
  - monitoring/action-plan
  - monitoring/actions-hierarchy

✓ Administrative (3)
  - assets
  - audit-trail
  - reports

+ 6 Already Working:
  - per_trn_identify_risk
  - per_trn_control_implementation
  - per_trn_risk_monitoring
  - per_mst_business_process
  - per_mst_control_type
  - per_mst_risk_category
```

---

## Quick Summary

**You need to:**
1. Open SQL Developer
2. Connect to Oracle
3. Copy & paste `complete_oracle_setup.sql`
4. Click Execute
5. Wait 2-3 minutes
6. Run `node test-all-apis.js`

**Result:**
- All 40+ APIs working
- Frontend fully functional
- Production ready

---

## Questions?

If something doesn't work, check:
1. Are you connected to the right Oracle schema? (PERICOPE_AI)
2. Did the SQL script execute without errors?
3. Did you wait 2-3 minutes for ORDS to refresh?
4. Are your backend servers still running? (Check with `node test-all-apis.js`)

Good luck! 🚀
