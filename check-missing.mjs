import axios from 'axios';

const REGISTERED_TABLES = [
  "per_mst_business_process",
  "per_mst_business_sub_process",
  "per_mst_risk_statement",
  "per_mst_roles",
  "per_mst_control_category",
  "per_mst_control_classification",
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
  "per_mst_risk_computation_logic",
  "per_mst_risk_compuation_logic",
  "per_mst_risk_cycle",
  "per_mst_risk_data_source",
  "per_mst_risk_root_cause",
  "per_mst_risk_sub_category",
  "per_mst_risk_type",
  "per_mst_user_details",
  "per_mst_user_roles_mapping",
  "per_mst_computation_output",
  "per_trn_control_implementation",
  "per_trn_identify_risk",
  "per_trn_impact_category",
  "per_trn_inherent_risk_assessment",
  "per_trn_mitigation_plans",
  "per_trn_mitigation_type",
  "per_trn_risk_monitoring",
  "erm_mst_kpi_definition",
  "erm_mst_kri_definition",
  "erm_trn_assessment_cycle",
  "erm_trn_audit_log",
  "erm_trn_kpi_actuals",
  "erm_trn_kri_readings",
  "erm_risks",
  "erm_actions",
  "erm_controls",
  "erm_incidents",
];

const BASE_URL = "https://ga8231f10084da5-pericopeai.adb.us-chicago-1.oraclecloudapps.com/ords/grc";

async function checkResources() {
  console.log("Checking ORDS resource availability directly...");
  const missing = [];
  
  for (const table of REGISTERED_TABLES) {
    try {
      await axios.get(`${BASE_URL}/${table}/`, { params: { limit: 1 }, timeout: 5000 });
      // console.log(`[OK] ${table}`);
    } catch (err) {
      if (err.response?.status === 404) {
        missing.push(table);
        console.log(`[MISSING] ${table}`);
      } else {
        console.log(`[ERROR] ${table}: ${err.response?.status || err.message}`);
      }
    }
  }
  
  console.log("\nSummary:");
  console.log(`Total: ${REGISTERED_TABLES.length}`);
  console.log(`Missing: ${missing.length}`);
  console.log("Missing tables:", JSON.stringify(missing, null, 2));
}

checkResources();
