// Full API Audit Script — Tests every registered endpoint
import axios from 'axios';

const BASE = 'http://localhost:5000';

const tables = [
  // PER Master tables
  "per_mst_business_process",
  "per_mst_business_sub_process",
  "per_mst_risk_statement",
  "per_mst_roles",
  "per_mst_control_category",
  "per_mst_control_clasification",
  "per_mst_control_design_effectiveness",
  "per_mst_control_frequency",
  "per_mst_control_register",
  "per_mst_control_type",
  "per_mst_currency_type",
  "per_mst_designation",
  "per_mst_impact",
  "per_mst_impact_category",
  "per_mst_impact_parties",
  "per_mst_impact_sub_category",
  "per_mst_likelihood",
  "per_mst_org_hierarchy",
  "per_mst_org_level",
  "per_mst_risk_category",
  "per_mst_risk_causal_factor",
  "per_mst_risk_compuation_logic",
  "per_mst_risk_cycle",
  "per_mst_risk_data_source",
  "per_mst_risk_root_cause",
  "per_mst_risk_sub_category",
  "per_mst_risk_type",
  "per_mst_user_details",
  "per_mst_user_roles_mapping",
  "per_mst_computation_output",
  "per_mst_control_classification",
  // PER Transaction tables
  "per_trn_control_implementation",
  "per_trn_identify_risk",
  "per_trn_impact_category",
  "per_trn_inherent_risk_assessment",
  "per_trn_mitigation_plans",
  "per_trn_mitigation_type",
  "per_trn_risk_monitoring",
  // ERM Master tables
  "erm_mst_kpi_definition",
  "erm_mst_kri_definition",
  // ERM Transaction tables
  "erm_trn_assessment_cycle",
  "erm_trn_audit_log",
  "erm_trn_kpi_actuals",
  "erm_trn_kri_readings",
  // ERM core tables
  "erm_risks",
  "erm_actions",
  "erm_controls",
  "erm_incidents",
];

const results = { pass: [], fail: [], empty: [] };

async function testTable(table) {
  try {
    const res = await axios.get(`${BASE}/api/${table}`, { timeout: 15000 });
    const status = res.status;
    const items = res.data?.items || [];
    const count = items.length;
    
    if (status === 200) {
      if (count === 0) {
        results.empty.push({ table, status, count });
      } else {
        results.pass.push({ table, status, count });
      }
    } else {
      results.fail.push({ table, status, error: `HTTP ${status}` });
    }
  } catch (err) {
    const status = err.response?.status || 'TIMEOUT';
    const msg = err.response?.data?.title || err.response?.data?.detail || err.message;
    results.fail.push({ table, status, error: msg?.substring(0, 80) });
  }
}

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  PERICOPE ERM — FULL API AUDIT`);
  console.log(`  Testing ${tables.length} endpoints against ${BASE}`);
  console.log(`${'='.repeat(70)}\n`);

  // Test health first
  try {
    const h = await axios.get(`${BASE}/health`);
    console.log(`  [HEALTH] ${JSON.stringify(h.data)}\n`);
  } catch (e) {
    console.log(`  [HEALTH] FAILED — server may be down!\n`);
    process.exit(1);
  }

  // Test all tables
  for (const table of tables) {
    await testTable(table);
    // Small delay to avoid hammering
    await new Promise(r => setTimeout(r, 100));
  }

  // Report
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ✅ PASS (${results.pass.length} tables with data):`);
  console.log(`${'─'.repeat(70)}`);
  results.pass.forEach(r => {
    console.log(`    ${r.table.padEnd(45)} ${String(r.count).padStart(5)} records`);
  });

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ⚠️  EMPTY (${results.empty.length} tables — 200 OK but 0 records):`);
  console.log(`${'─'.repeat(70)}`);
  results.empty.forEach(r => {
    console.log(`    ${r.table}`);
  });

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ❌ FAIL (${results.fail.length} tables with errors):`);
  console.log(`${'─'.repeat(70)}`);
  results.fail.forEach(r => {
    console.log(`    ${r.table.padEnd(45)} ${String(r.status).padStart(4)} | ${r.error}`);
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  SUMMARY: ${results.pass.length} pass | ${results.empty.length} empty | ${results.fail.length} fail`);
  console.log(`${'='.repeat(70)}\n`);
}

main();
