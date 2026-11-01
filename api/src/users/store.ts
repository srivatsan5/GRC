import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { readJson, writeJsonAtomic } from '../lib/jsonFile.js'
import type { Role } from '../auth/permissions.js'

export interface StoredUser {
  id: string
  email: string
  name: string
  role: Role
  department: string
  active: boolean
  passwordHash: string
  /** Bumped on logout-everywhere, password change, role change or deactivation: invalidates old sessions. */
  tokenVersion: number
  failedLogins: number
  lockedUntil: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export type PublicUser = Omit<StoredUser, 'passwordHash' | 'tokenVersion' | 'failedLogins' | 'lockedUntil'>

export function toPublic(u: StoredUser): PublicUser {
  const { passwordHash: _p, tokenVersion: _t, failedLogins: _f, lockedUntil: _l, ...rest } = u
  return rest
}

/**
 * Users persisted to DATA_DIR/users.json (written atomically, mode 600).
 * Writes are serialised so concurrent requests can't lose updates.
 */
export class UserStore {
  private users: StoredUser[] = []
  private writeChain: Promise<void> = Promise.resolve()
  private readonly file: string

  constructor(dataDir: string) {
    this.file = join(dataDir, 'users.json')
  }

  async load(): Promise<void> {
    const data = await readJson<{ users: StoredUser[] }>(this.file, { users: [] })
    this.users = data.users
  }

  private persist(): Promise<void> {
    const snapshot = { users: this.users }
    this.writeChain = this.writeChain.then(() => writeJsonAtomic(this.file, snapshot))
    return this.writeChain
  }

  count(): number {
    return this.users.length
  }

  list(): StoredUser[] {
    return [...this.users].sort((a, b) => a.name.localeCompare(b.name))
  }

  findById(id: string): StoredUser | undefined {
    return this.users.find(u => u.id === id)
  }

  findByEmail(email: string): StoredUser | undefined {
    const e = email.trim().toLowerCase()
    return this.users.find(u => u.email === e)
  }

  activeAdminCount(): number {
    return this.users.filter(u => u.active && u.role === 'Administrator').length
  }

  async create(input: { email: string; name: string; role: Role; department: string; passwordHash: string }): Promise<StoredUser> {
    // Re-checked here (synchronously, just before insert) so two concurrent requests can't both create it.
    if (this.findByEmail(input.email)) throw new DuplicateEmailError()
    const now = new Date().toISOString()
    const user: StoredUser = {
      id: `U-${randomUUID().slice(0, 8).toUpperCase()}`,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      role: input.role,
      department: input.department.trim(),
      active: true,
      passwordHash: input.passwordHash,
      tokenVersion: 1,
      failedLogins: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    }
    this.users.push(user)
    await this.persist()
    return user
  }

  /**
   * Count a failed sign-in atomically (the in-memory increment happens synchronously, so
   * parallel guesses can't all read the same old counter). Locks the account at `max`.
   */
  async registerFailedLogin(id: string, max: number, lockMs: number): Promise<{ locked: boolean }> {
    const user = this.findById(id)
    if (!user) return { locked: false }
    const failed = user.failedLogins + 1
    const locked = failed >= max
    const next: StoredUser = {
      ...user,
      failedLogins: locked ? 0 : failed,
      lockedUntil: locked ? new Date(Date.now() + lockMs).toISOString() : user.lockedUntil,
      updatedAt: new Date().toISOString(),
    }
    this.users[this.users.indexOf(user)] = next
    await this.persist()
    return { locked }
  }

  async update(id: string, patch: Partial<Omit<StoredUser, 'id' | 'createdAt'>>): Promise<StoredUser> {
    const idx = this.users.findIndex(u => u.id === id)
    if (idx === -1) throw new Error(`user ${id} not found`)
    const next = { ...this.users[idx]!, ...patch, updatedAt: new Date().toISOString() }
    this.users[idx] = next
    await this.persist()
    return next
  }
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('A user with this email already exists')
  }
}
