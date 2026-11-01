#!/usr/bin/env node
/**
 * Checks whether your Oracle ORDS REST endpoints answer WITHOUT a token.
 * If they do, the database is readable (and possibly writable) by anyone on
 * the internet, regardless of how secure this API is.
 *
 *   ORDS_BASE_URL=https://<host>/ords/<schema> node scripts/check-ords-anonymous.mjs
 *
 * Read-only: it only sends GET requests.
 */
import 'dotenv/config'

const base = (process.env.ORDS_BASE_URL || '').replace(/\/$/, '')
if (!base) {
  console.error('Set ORDS_BASE_URL first (e.g. in api/.env).')
  process.exit(2)
}

const tables = ['per_trn_identify_risk', 'per_trn_control_implementation', 'per_mst_user_details', 'per_mst_roles', 'erm_trn_audit_log']
let exposed = 0
for (const t of tables) {
  try {
    const res = await fetch(`${base}/${t}/?limit=1`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    const open = res.status === 200
    if (open) exposed++
    console.log(`${open ? 'EXPOSED ' : 'protected'}  ${res.status}  ${t}`)
  } catch (e) {
    console.log(`error      ---  ${t}  (${e.message})`)
  }
}

if (exposed) {
  console.log(`
${exposed} table(s) answer without authentication. Fix it in Oracle (as the schema owner):

  1. Turn on authentication for each AutoREST-enabled object, e.g.
       BEGIN
         ORDS.ENABLE_OBJECT(p_enabled => TRUE, p_schema => '<SCHEMA>',
                            p_object => 'PER_TRN_IDENTIFY_RISK', p_object_type => 'TABLE',
                            p_auto_rest_auth => TRUE);
         COMMIT;
       END;
     (repeat for every PER_* / ERM_* object, or use a privilege that protects /per_* and /erm_*)
  2. Make sure the OAuth client used by this API holds the role that the privilege requires
     (OAUTH.GRANT_CLIENT_ROLE), as described in Oracle's "Developing Oracle REST Data Services
     Applications > Configuring Secure Access to RESTful Services" guide.
  3. Rotate the client secret if it was ever committed to git.

Then re-run this script; every line should say "protected  401".`)
  process.exit(1)
}
console.log('\nAll checked endpoints require authentication.')
