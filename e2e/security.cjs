const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const consoleErrors = [];
  p.on('pageerror', e => consoleErrors.push(e.message));

  // 1. Login page: no prefilled creds, no persona shortcuts
  await p.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await p.screenshot({ path: './e2e/screenshots/01-login.png' });
  check('login page shown when signed out', await p.locator('#login-email').isVisible());
  check('no prefilled email/password', (await p.inputValue('#login-email')) === '' && (await p.inputValue('#login-password')) === '');
  check('no "sign in as" persona buttons', (await p.locator('text=Or sign in as').count()) === 0);

  // 2. Wrong password
  await p.fill('#login-email', 'admin@pericope.local');
  await p.fill('#login-password', 'wrong-password-123');
  await p.click('button[type=submit]');
  const loginAlert = p.locator('form').locator('xpath=..').locator('div[role=alert]')
  await loginAlert.waitFor({ timeout: 10000 });
  check('wrong password rejected with message', /incorrect/i.test(await loginAlert.innerText()), await loginAlert.innerText());

  // 3. Correct login
  await p.fill('#login-password', 'Local-dev-admin-2026');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Dashboard', { timeout: 15000 });
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(800);
  await p.screenshot({ path: './e2e/screenshots/02-dashboard.png' });
  const cookies = await ctx.cookies();
  const sess = cookies.find(c => c.name === 'pericope_session');
  check('session cookie is httpOnly', !!sess && sess.httpOnly, sess ? `sameSite=${sess.sameSite}` : 'missing');
  check('session token not readable from JS', !(await p.evaluate(() => document.cookie)).includes('pericope_session'));
  const activeRisks = await p.locator('a:has-text("Active risks")').first().innerText();
  check('dashboard shows risks loaded through API from DB', /\b2[0-9]\b|\b[1-9][0-9]\b/.test(activeRisks), activeRisks.replace(/\n/g, ' | '));

  // 4. Create a user through the UI
  await p.goto(BASE + '/users', { waitUntil: 'networkidle' });
  await p.click('text=Add user');
  await p.fill('#nu-name', 'Anthony Muller');
  await p.fill('#nu-email', 'anthony@pericope.local');
  await p.selectOption('#nu-role', 'Assessor');
  await p.fill('#nu-dept', 'Operations');
  await p.fill('#nu-password', 'short');
  await p.click('button:has-text("Create user")');
  await p.waitForTimeout(800);
  const stillOpen = await p.locator('#nu-password').isVisible();
  const weakResp = await p.evaluate(async () => (await fetch('http://localhost:5000/api/users', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ email: 'w@x.io', name: 'Weak', role: 'Viewer', password: 'short' }) })).json());
  check('weak password blocked (form + server)', stillOpen && /12 characters/.test(weakResp.error?.message || ''), weakResp.error?.message);
  await p.fill('#nu-password', 'Assessor-pass-2026');
  await p.click('button:has-text("Create user")');
  await p.waitForSelector('td:has-text("anthony@pericope.local")', { timeout: 10000 });
  await p.screenshot({ path: './e2e/screenshots/03-users.png' });
  check('user created via API and listed', true);

  // 5. Approve a risk as admin through the API (same client the pages use)
  const approve = await p.evaluate(async () => {
    const list = await fetch('http://localhost:5000/api/per_trn_identify_risk?limit=1', { credentials: 'include' }).then(r => r.json());
    const id = list.items[0].uuid;
    const r = await fetch(`http://localhost:5000/api/per_trn_identify_risk/${id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ approval_status: 'APPROVED' }),
    });
    const after = await fetch(`http://localhost:5000/api/per_trn_identify_risk/${id}`, { credentials: 'include' }).then(r => r.json());
    return { status: r.status, saved: after.approval_status, keptRef: after.assessment_reference_number };
  });
  check('admin approval persisted in DB (no reset to DRAFT)', approve.status === 200 && approve.saved === 'APPROVED', JSON.stringify(approve));

  // 6. Audit trail with chain verification
  await p.goto(BASE + '/audit-trail', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: './e2e/screenshots/04-audit.png' });
  const auditText = await p.locator('main').innerText();
  check('audit trail shows chain verified', /Hash chain verified/.test(auditText));
  check('audit trail has login, failed login, user create, approve', ['LOGIN', 'USER CREATE', 'APPROVE'].every(a => auditText.includes(a)) && /LOGIN.FAILED/.test(auditText));

  // 7. Sign out
  await p.click('button:has-text("Srivatsan B")');
  await p.click('text=Sign out');
  await p.waitForSelector('#login-email');
  check('sign out returns to login', true);

  // 8. Assessor: limited navigation and permissions
  await p.fill('#login-email', 'anthony@pericope.local');
  await p.fill('#login-password', 'Assessor-pass-2026');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Dashboard', { timeout: 15000 });
  await p.goto(BASE + '/users', { waitUntil: 'networkidle' });
  await p.screenshot({ path: './e2e/screenshots/05-assessor-users.png' });
  check('assessor blocked from /users page', (await p.locator("text=You don’t have access").count()) > 0);
  const assessorApi = await p.evaluate(async () => {
    const h = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let spoofBlocked = false;
    try { await fetch('http://localhost:5000/api/per_trn_identify_risk/1', { method: 'DELETE', credentials: 'include', headers: { ...h, 'X-User-Role': 'Administrator' } }) } catch { spoofBlocked = true }
    const users = await fetch('http://localhost:5000/api/users', { credentials: 'include' });
    const create = await fetch('http://localhost:5000/api/per_trn_identify_risk', { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify({ risk_statement: 'Supplier insolvency', process_name: 'Procurement' }) });
    const created = await create.json();
    const approve = await fetch(`http://localhost:5000/api/per_trn_identify_risk/${created.uuid}`, { method: 'PUT', credentials: 'include', headers: h, body: JSON.stringify({ approval_status: 'APPROVED' }) });
    const del = await fetch(`http://localhost:5000/api/per_trn_identify_risk/${created.uuid}`, { method: 'DELETE', credentials: 'include', headers: h });
    return { users: users.status, create: create.status, approve: approve.status, del: del.status, spoofBlocked };
  });
  check('assessor: users API 403, create 201, approve 403, delete 403 (spoofed header ignored)',
    assessorApi.users === 403 && assessorApi.create === 201 && assessorApi.approve === 403 && assessorApi.del === 403 && assessorApi.spoofBlocked, JSON.stringify(assessorApi));
  const nav = await p.evaluate(() => document.body.innerText);
  check('assessor sidebar hides User Management / Audit Trail links', !(await p.locator('a[href="/users"]').count()) && !(await p.locator('a[href="/audit-trail"]').count()));

  // 9. Database outage is shown, not hidden
  require('child_process').execSync("pkill -f '[f]ake-ords.ts' ; true");
  await p.waitForTimeout(500);
  await p.goto(BASE + '/rcsa/identification', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: './e2e/screenshots/06-db-down.png' });
  const toastText = await p.locator('[data-sonner-toast]').allInnerTexts();
  check('DB outage surfaces an error to the user', toastText.some(t => /could not be loaded/i.test(t)), toastText.join(' / ').slice(0, 160));

  check('no uncaught page errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 200));
  console.log(results.join('\n'));
  await b.close();
})().catch(e => { console.log(results.join('\n')); console.error('SCRIPT ERROR', e.message); process.exit(1); });
