import { useEffect, useState } from 'react'
import { authenticatedFetch } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import './AdminPage.css'

type User = { id: number; name: string; email: string; systemRole: 'user' | 'admin' | 'owner' }

export default function AdminPage() {
  const { profile, refreshProfile } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState<number | null>(null)

  async function loadUsers() {
    const response = await authenticatedFetch('/api/admin/users')
    if (!response.ok) throw new Error('Could not load users.')
    setUsers(await response.json() as User[])
  }

  useEffect(() => {
    // Loading the server-owned user list is the synchronization this effect performs.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadUsers().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load users.')).finally(() => setLoading(false))
  }, [])

  async function changeRole(user: User, systemRole: User['systemRole']) {
    setUpdating(user.id); setError('')
    try {
      const response = await authenticatedFetch(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemRole }),
      })
      if (!response.ok) {
        const body = await response.json() as { error?: string }
        if (body.error === 'last_owner_required') throw new Error('The last Owner cannot be removed.')
        throw new Error('You do not have permission to make that role change.')
      }
      await loadUsers()
      if (profile?.id === user.id) await refreshProfile()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update the role.') }
    finally { setUpdating(null) }
  }

  return (
    <main className="admin-page">
      <div className="admin-heading"><div><p className="eyebrow">Administration</p><h1>User access</h1></div><p>Owners manage Owners and Admins. Admins can add or remove Admin access.</p></div>
      {loading && <p role="status">Loading users…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && <div className="user-table-wrap"><table>
        <thead><tr><th scope="col">User</th><th scope="col">Email</th><th scope="col">Access</th></tr></thead>
        <tbody>{users.map((user) => {
          const ownerProtected = profile?.systemRole === 'admin' && user.systemRole === 'owner'
          return <tr key={user.id}>
            <td>{user.name}{profile?.id === user.id && <span className="you">You</span>}</td><td>{user.email}</td>
            <td><select aria-label={`Access level for ${user.name}`} value={user.systemRole} disabled={updating === user.id || ownerProtected} onChange={(event) => void changeRole(user, event.target.value as User['systemRole'])}>
              <option value="user">User</option><option value="admin">Admin</option>{profile?.systemRole === 'owner' && <option value="owner">Owner</option>}
            </select></td>
          </tr>
        })}</tbody>
      </table></div>}
    </main>
  )
}
