/**
 * Create a user from the command line (useful for the first administrator).
 *   npm run user:create -- --email admin@example.com --name "Jane Admin" --role Administrator
 * The password is read from the PASSWORD environment variable, or prompted for.
 */
import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { UserStore } from '../src/users/store.js'
import { AuditLog } from '../src/audit/log.js'
import { hashPassword, passwordProblem } from '../src/auth/passwords.js'
import { ROLES, type Role } from '../src/auth/permissions.js'

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'Administrator' },
    department: { type: 'string', default: '' },
  },
})

async function main() {
  if (!values.email || !values.name) throw new Error('--email and --name are required')
  if (!ROLES.includes(values.role as Role)) throw new Error(`--role must be one of: ${ROLES.join(', ')}`)
  let password = process.env.PASSWORD
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    password = await rl.question('Password (12+ chars, letters and numbers): ')
    rl.close()
  }
  const problem = passwordProblem(password)
  if (problem) throw new Error(problem)

  const dataDir = process.env.DATA_DIR ?? './data'
  const users = new UserStore(dataDir)
  await users.load()
  if (users.findByEmail(values.email)) throw new Error('A user with that email already exists')
  const user = await users.create({ email: values.email, name: values.name, role: values.role as Role, department: values.department ?? '', passwordHash: await hashPassword(password) })
  const audit = new AuditLog(dataDir)
  await audit.load()
  await audit.record({ actor: { id: 'CLI', name: 'Command line', email: '', role: 'System' }, action: 'USER_CREATE', entity: 'User', entityId: user.id, description: `Created ${user.email} as ${user.role} from the command line`, result: 'SUCCESS', source: 'api' })
  console.log(`Created ${user.role} ${user.email} (${user.id}) in ${dataDir}/users.json`)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
