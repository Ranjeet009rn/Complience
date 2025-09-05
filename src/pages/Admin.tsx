import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, UserPlus, Search, Shield } from 'lucide-react';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';

type Role = User['role'];

const ROLE_OPTIONS: Role[] = ['Admin', 'Maker', 'Checker', 'Manager', 'Auditor'];

interface EditableUser extends Omit<User, 'role'> {
  role: Role;
}

const emptyUser: EditableUser = {
  id: '',
  name: '',
  email: '',
  role: 'Maker',
  avatar: '',
};

function AdminPage() {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<EditableUser | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }, [users, query]);

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load users');
      setUsers(data.users || []);
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Load users failed', message: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCreate() {
    setEditing({ ...emptyUser, id: '' });
  }

  function startEdit(u: User) {
    setEditing({ ...u });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function saveUser() {
    if (!editing) return;
    const body = { ...editing } as EditableUser;
    if (!body.name.trim() || !body.email.trim()) {
      addNotification({ type: 'warning', title: 'Validation', message: 'Name and email are required.' });
      return;
    }
    try {
      setLoading(true);
      const isNew = !body.id;
      const res = await fetch(isNew ? '/api/users' : `/api/users/${body.id}` , {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Save failed');
      addNotification({ type: 'success', title: isNew ? 'User created' : 'User updated', message: body.email });
      setEditing(null);
      await fetchUsers();
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Save user failed', message: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(id: string) {
    if (!id) return;
    if (!confirm('Delete this user?')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Delete failed');
      addNotification({ type: 'success', title: 'User deleted', message: id });
      await fetchUsers();
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Delete user failed', message: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-md flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
            <p className="text-sm text-gray-500">User management, roles, and system configuration</p>
          </div>
        </div>
        <button
          onClick={startCreate}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <UserPlus className="w-4 h-4 mr-2" /> Add User
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div className="relative w-80 max-w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, role"
              className="w-full pl-9 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-500">{filtered.length} user(s)</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Name</th>
                <th className="text-left font-semibold px-4 py-3">Email</th>
                <th className="text-left font-semibold px-4 py-3">Role</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(u)}
                      className="inline-flex items-center px-3 py-1.5 text-blue-600 hover:text-blue-800"
                    >
                      <Pencil className="w-4 h-4 mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="inline-flex items-center px-3 py-1.5 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-lg">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">{editing.id ? 'Edit User' : 'Add User'}</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-3">
              <button onClick={cancelEdit} className="px-4 py-2 rounded-md border">Cancel</button>
              <button
                onClick={saveUser}
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                disabled={loading}
              >
                {editing.id ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
