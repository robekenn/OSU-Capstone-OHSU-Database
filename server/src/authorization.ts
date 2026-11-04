export type SystemRole = 'user' | 'admin' | 'owner'

export function canAssignRole(
  actorRole: SystemRole,
  targetRole: SystemRole,
  nextRole: SystemRole,
) {
  if (actorRole === 'owner') return true
  if (actorRole !== 'admin' || targetRole === 'owner' || nextRole === 'owner') return false
  return true
}
