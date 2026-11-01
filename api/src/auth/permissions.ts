export const ROLES = ['Administrator', 'Risk Manager', 'Assessor', 'Auditor', 'Viewer'] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = ['read', 'create', 'update', 'delete', 'approve', 'audit:read', 'users:manage', 'reference:read-restricted'] as const
export type Permission = (typeof PERMISSIONS)[number]

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  Administrator: new Set(PERMISSIONS),
  'Risk Manager': new Set<Permission>(['read', 'create', 'update', 'delete', 'approve', 'audit:read']),
  Assessor: new Set<Permission>(['read', 'create', 'update']),
  Auditor: new Set<Permission>(['read', 'audit:read']),
  Viewer: new Set<Permission>(['read']),
}

/** Deny by default: unknown roles get nothing. */
export function can(role: string | undefined, permission: Permission): boolean {
  if (!role || !(role in MATRIX)) return false
  return MATRIX[role as Role].has(permission)
}

export function permissionsFor(role: Role): Permission[] {
  return [...MATRIX[role]]
}
