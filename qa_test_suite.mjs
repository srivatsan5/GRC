import assert from 'assert';

console.log('================================================================');
console.log('   PERICOPE ERM — COMPREHENSIVE QA & UNIT TEST SUITE (v3.0)');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// ============================================================================
// 1. RISK QUANTIFICATION & SCORING MODEL UNIT TESTS
// ============================================================================
console.log('--- 1. Testing Risk Quantification & Scoring Models ---');

function computeCompositeScore(likelihood, impact) {
  const l = Math.max(1, Math.min(5, Number(likelihood) || 1));
  const i = Math.max(1, Math.min(5, Number(impact) || 1));
  return l * i;
}

function getRiskBand(score) {
  if (score >= 16) return 'Critical';
  if (score >= 12) return 'High';
  if (score >= 8) return 'Medium';
  return 'Low';
}

function computeSingleLossExpectancy(likelihood, impact, baseMultiplier = 10000) {
  const score = computeCompositeScore(likelihood, impact);
  return score * baseMultiplier;
}

function calculateResidualRisk(inherentLikelihood, inherentImpact, designEffectiveness = 3, operatingEffectiveness = 3) {
  const lInh = Math.max(1, Math.min(5, Number(inherentLikelihood) || 1));
  const iInh = Math.max(1, Math.min(5, Number(inherentImpact) || 1));
  const dEff = Math.max(1, Math.min(5, Number(designEffectiveness) || 1));
  const oEff = Math.max(1, Math.min(5, Number(operatingEffectiveness) || 1));
  const eta = (dEff * oEff) / 25.0;
  const lRes = Math.max(1, Math.round(lInh * (1.0 - 0.7 * eta)));
  const iRes = Math.max(1, Math.round(iInh * (1.0 - 0.5 * eta)));
  const inherentScore = lInh * iInh;
  const residualScore = lRes * iRes;
  return {
    inherentScore,
    inherentSLE: inherentScore * 10000,
    residualLikelihood: lRes,
    residualImpact: iRes,
    residualScore,
    residualBand: getRiskBand(residualScore),
    residualSLE: residualScore * 10000,
    riskReductionPct: Math.round(((inherentScore - residualScore) / inherentScore) * 100),
  };
}

function runMonteCarloSimulation(likelihood, impact, iterations = 1000) {
  const l = Math.max(1, Math.min(5, Number(likelihood) || 1));
  const i = Math.max(1, Math.min(5, Number(impact) || 1));
  const baseSLE = l * i * 10000;
  const lambda = (l / 5) * 2.5;
  const annualLosses = [];

  for (let iter = 0; iter < iterations; iter++) {
    let L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    const eventCount = k - 1;

    let iterationLoss = 0;
    for (let e = 0; e < eventCount; e++) {
      const u1 = Math.max(1e-6, Math.random());
      const u2 = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const magnitude = baseSLE * Math.exp(0.4 * z - 0.08);
      iterationLoss += magnitude;
    }
    annualLosses.push(iterationLoss);
  }

  annualLosses.sort((a, b) => a - b);
  const meanLoss = Math.round(annualLosses.reduce((acc, v) => acc + v, 0) / iterations);
  const var95 = Math.round(annualLosses[Math.floor(iterations * 0.95)]);
  return { meanLoss, var95 };
}

test('Composite Score bounds: S = L x I for 5x5 matrix (1 to 25)', () => {
  assert.strictEqual(computeCompositeScore(1, 1), 1);
  assert.strictEqual(computeCompositeScore(5, 5), 25);
  assert.strictEqual(computeCompositeScore(3, 4), 12);
  assert.strictEqual(computeCompositeScore(6, 10), 25, 'Should clamp out-of-range values');
  assert.strictEqual(computeCompositeScore(0, -2), 1, 'Should clamp negative values');
});

test('Qualitative Band mapping: Low (1-7), Medium (8-11), High (12-15), Critical (16-25)', () => {
  assert.strictEqual(getRiskBand(1), 'Low');
  assert.strictEqual(getRiskBand(6), 'Low');
  assert.strictEqual(getRiskBand(8), 'Medium');
  assert.strictEqual(getRiskBand(10), 'Medium');
  assert.strictEqual(getRiskBand(12), 'High');
  assert.strictEqual(getRiskBand(15), 'High');
  assert.strictEqual(getRiskBand(16), 'Critical');
  assert.strictEqual(getRiskBand(25), 'Critical');
});

test('Single Loss Expectancy (SLE) monetary calculation: SLE = S * $10,000', () => {
  assert.strictEqual(computeSingleLossExpectancy(1, 1), 10000);
  assert.strictEqual(computeSingleLossExpectancy(3, 3), 90000);
  assert.strictEqual(computeSingleLossExpectancy(5, 5), 250000);
});

test('Multi-factor Residual Risk calculation (Design 5/5 x Operating 5/5 = 100% factor)', () => {
  const result = calculateResidualRisk(5, 5, 5, 5); // Inherent 25 with optimal controls
  assert.ok(result.residualScore < 25, 'Residual score must be lower than inherent score');
  assert.strictEqual(result.residualLikelihood, 2);
  assert.strictEqual(result.residualImpact, 3);
  assert.strictEqual(result.residualScore, 6);
  assert.strictEqual(result.residualBand, 'Low');
  assert.strictEqual(result.riskReductionPct, 76);
});

test('FAIR Monte Carlo simulation produces positive Mean Loss and VaR-95', () => {
  const sim = runMonteCarloSimulation(4, 4, 1000);
  assert.ok(sim.meanLoss > 0, 'Mean loss must be positive');
  assert.ok(sim.var95 >= sim.meanLoss, 'VaR 95% must be >= Mean Loss');
});

// ============================================================================
// 2. INPUT SANITIZATION & ANTI-JUNK FILTER UNIT TESTS
// ============================================================================
console.log('\n--- 2. Testing Input Sanitization & Anti-Junk Heuristics ---');

const CONSONANT_RUN = /[bcdfghjklmnpqrstvwxyz]{7,}/i;

function isJunkString(v) {
  if (typeof v !== 'string') return false;
  const trimmed = v.trim();
  if (trimmed.length < 3) return true;
  if (/^[A-Z0-9_-]{3,35}$/.test(trimmed)) return false;
  if (CONSONANT_RUN.test(trimmed)) return true;
  const hasNoSpace = !/\s/.test(trimmed);
  const letters = trimmed.replace(/[^a-z]/gi, '');
  if (hasNoSpace && letters.length >= 8) {
    const vowels = (letters.match(/[aeiou]/gi) || []).length;
    if (vowels / letters.length < 0.2) return true;
  }
  return false;
}

function sanitizePayload(body) {
  if (!body || typeof body !== 'object') return { sanitized: body, rejected: [] };
  const rejected = [];
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string') {
      const isUserFacing = /name|title|description|statement|justification|reason|comment|notes/i.test(k);
      if (isUserFacing && isJunkString(v)) {
        rejected.push({ field: k, value: v, reason: 'looks like keyboard-mash junk' });
        continue;
      }
      out[k] = v.trim();
    } else {
      out[k] = v;
    }
  }
  return { sanitized: out, rejected };
}

test('Anti-junk detector flags keyboard mash (e.g. "vnxbjhvbdsfjvndsjo")', () => {
  assert.strictEqual(isJunkString('vnxbjhvbdsfjvndsjo'), true);
  assert.strictEqual(isJunkString('asdfghjkl'), true);
  assert.strictEqual(isJunkString('zzxxccvvbb'), true);
  assert.strictEqual(isJunkString('ab'), true, 'Under 3 characters should be flagged');
});

test('Anti-junk detector permits legitimate acronyms and system identifiers', () => {
  assert.strictEqual(isJunkString('GDPR_SOC2_2026'), false);
  assert.strictEqual(isJunkString('RCSA-IT-001'), false);
  assert.strictEqual(isJunkString('MFA_AUTH_BYPASS'), false);
  assert.strictEqual(isJunkString('Database server outage during monthly payroll processing'), false);
});

test('Sanitize payload preserves numbers, booleans, and valid text while rejecting junk fields', () => {
  const payload = {
    risk_statement: 'Critical liquidity risk in foreign currency settlement',
    justification: 'lkjhgfdsaqwerty',
    inherent_sle: 50000,
    status: 'Y',
  };
  const { sanitized, rejected } = sanitizePayload(payload);
  assert.strictEqual(sanitized.risk_statement, 'Critical liquidity risk in foreign currency settlement');
  assert.strictEqual(sanitized.inherent_sle, 50000);
  assert.strictEqual(sanitized.status, 'Y');
  assert.strictEqual(sanitized.justification, undefined);
  assert.strictEqual(rejected.length, 1);
  assert.strictEqual(rejected[0].field, 'justification');
});

// ============================================================================
// 3. DATA NORMALIZATION (ORDS & API RESPONSE WRAPPER) UNIT TESTS
// ============================================================================
console.log('\n--- 3. Testing ORDS Response Normalization ---');

const normalizeItems = (data) => {
  if (!data) return [];
  let items = [];
  if (data?.items && Array.isArray(data.items)) {
    items = data.items;
  } else if (data?.data && Array.isArray(data.data)) {
    items = data.data;
  } else if (data?.success === true && Array.isArray(data?.data)) {
    items = data.data;
  } else if (Array.isArray(data)) {
    items = data;
  } else if (data?.item) {
    items = [data.item];
  } else if (typeof data === 'object' && data !== null && !data.items && !data.data) {
    items = [data];
  }
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const normalized = {};
    Object.keys(item).forEach(key => {
      normalized[key.toLowerCase()] = item[key];
    });
    return normalized;
  });
};

test('Normalize uppercase Oracle ORDS response keys to lowercase', () => {
  const ordsResponse = {
    items: [
      { UUID: 101, RISK_STATEMENT: 'Payment failure', INHERENT_SLE: 25000, APPROVAL_STATUS: 'APPROVED' }
    ]
  };
  const normalized = normalizeItems(ordsResponse);
  assert.strictEqual(normalized.length, 1);
  assert.strictEqual(normalized[0].uuid, 101);
  assert.strictEqual(normalized[0].risk_statement, 'Payment failure');
  assert.strictEqual(normalized[0].approval_status, 'APPROVED');
});

test('Normalize null, undefined, or empty responses safely', () => {
  assert.deepStrictEqual(normalizeItems(null), []);
  assert.deepStrictEqual(normalizeItems(undefined), []);
  assert.deepStrictEqual(normalizeItems({ items: [] }), []);
});

// ============================================================================
// 4. AUDIT TRAIL LOGGING & ATTRIBUTION UNIT TESTS
// ============================================================================
console.log('\n--- 4. Testing Audit Trail & Attribution ---');

function createAuditEntry(actor, action, entity, entityId, description, result = 'SUCCESS') {
  return {
    id: `AUD-TEST-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor_id: actor.id || 'SYSTEM',
    actor_name: actor.name || 'System',
    actor_role: actor.role || 'System',
    action,
    entity,
    entity_id: entityId,
    description,
    result,
    source: 'api'
  };
}

test('Audit entry captures user attribution (X-User-Id, Role, Name)', () => {
  const actor = { id: 'U-002', name: 'Priya Sharma', role: 'Risk Manager' };
  const entry = createAuditEntry(actor, 'UPDATE', 'per_trn_identify_risk', '1001', 'Updated likelihood to 4');
  assert.strictEqual(entry.actor_id, 'U-002');
  assert.strictEqual(entry.actor_name, 'Priya Sharma');
  assert.strictEqual(entry.actor_role, 'Risk Manager');
  assert.strictEqual(entry.action, 'UPDATE');
  assert.strictEqual(entry.entity, 'per_trn_identify_risk');
  assert.strictEqual(entry.result, 'SUCCESS');
  assert.ok(entry.timestamp);
});

// ============================================================================
// 5. LOCALSTORE STATE REPOSITORY UNIT TESTS
// ============================================================================
console.log('\n--- 5. Testing In-Memory LocalStore CRUD Operations ---');

class MockStore {
  constructor(seed = []) {
    this.items = [...seed];
  }
  list() { return [...this.items]; }
  get(id) { return this.items.find(x => x.id === id); }
  add(item) { this.items.push(item); return item; }
  update(id, patch) {
    const idx = this.items.findIndex(x => x.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }
  remove(id) {
    const idx = this.items.findIndex(x => x.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    return true;
  }
}

test('MockStore performs full CRUD lifecycle', () => {
  const store = new MockStore([{ id: 'CTL-001', name: 'MFA Enforcement', type: 'Preventive' }]);
  assert.strictEqual(store.list().length, 1);

  // CREATE
  const added = store.add({ id: 'CTL-002', name: 'Daily Bank Recon', type: 'Detective' });
  assert.strictEqual(store.list().length, 2);
  assert.strictEqual(added.id, 'CTL-002');

  // READ
  const item = store.get('CTL-002');
  assert.strictEqual(item.name, 'Daily Bank Recon');

  // UPDATE
  const updated = store.update('CTL-002', { name: 'Automated Daily Bank Recon' });
  assert.strictEqual(updated.name, 'Automated Daily Bank Recon');

  // DELETE
  const deleted = store.remove('CTL-001');
  assert.strictEqual(deleted, true);
  assert.strictEqual(store.list().length, 1);
});

// ============================================================================
// 6. SUMMARY REPORT
// ============================================================================
console.log('\n================================================================');
console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL ${totalTests})`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
