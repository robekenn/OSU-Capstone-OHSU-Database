import { describe, expect, it } from 'vitest'
import { canAssignRole } from './authorization.js'

describe('canAssignRole', () => {
  it('allows owners to manage every system role', () => {
    expect(canAssignRole('owner', 'owner', 'user')).toBe(true)
    expect(canAssignRole('owner', 'user', 'owner')).toBe(true)
  })

  it('allows admins to add and remove admins', () => {
    expect(canAssignRole('admin', 'user', 'admin')).toBe(true)
    expect(canAssignRole('admin', 'admin', 'user')).toBe(true)
  })

  it('does not allow admins to manage owners', () => {
    expect(canAssignRole('admin', 'owner', 'admin')).toBe(false)
    expect(canAssignRole('admin', 'user', 'owner')).toBe(false)
  })

  it('does not allow ordinary users to assign roles', () => {
    expect(canAssignRole('user', 'user', 'admin')).toBe(false)
  })
})
