import { useEffect, useMemo, useState } from 'react';
import { UserCheck, Search, RefreshCw } from 'lucide-react';
import { Task, User } from '../types';
import { useNotifications } from '../context/NotificationsContext';

const STATUS_OPTIONS: Task['status'][] = ['Pending', 'In Progress', 'Completed', 'Rejected'];
const PRIORITY_OPTIONS: Task['priority'][] = ['Low', 'Medium', 'High', 'Critical'];

function ManagerPage() {
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const usersById = useMemo(() => {
    const m = new Map<string, User>();
    users.forEach(u => m.set(u.id, u));
    return m;
  }, [users]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return tasks.filter(t => {
      if (qq) {
        const hay = `${t.title} ${t.description} ${t.status} ${t.priority}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && t.assigned_to !== assigneeFilter) return false;
      return true;
    });
  }, [tasks, q, statusFilter, priorityFilter, assigneeFilter]);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load users');
      setUsers(data.users || []);
    } catch (err: any) {
      addNotification({ title: 'Load users failed', message: err.message || String(err) });
    }
  }

  async function fetchTasks() {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load tasks');
      setTasks(data.tasks || []);
    } catch (err: any) {
      addNotification({ title: 'Load tasks failed', message: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateTask(taskId: string, patch: Partial<Task>) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Update failed');
      setTasks(prev => prev.map(t => (t.id === taskId ? data.task : t)));
      return true;
    } catch (err: any) {
      addNotification({ title: 'Update task failed', message: err.message || String(err) });
      return false;
    }
  }

  async function handleAssign(taskId: string, userId: string) {
    const ok = await updateTask(taskId, { assigned_to: userId });
    if (ok) addNotification({ title: 'Task assigned', message: usersById.get(userId)?.name || userId });
  }

  async function handleStatus(taskId: string, status: Task['status']) {
    const ok = await updateTask(taskId, { status });
    if (ok) addNotification({ title: 'Status updated', message: status });
  }

  async function handlePriority(taskId: string, priority: Task['priority']) {
    const ok = await updateTask(taskId, { priority });
    if (ok) addNotification({ title: 'Priority updated', message: priority });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-md flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manager</h1>
            <p className="text-sm text-gray-500">Oversee tasks, assign owners, and track progress</p>
          </div>
        </div>
        <button
          onClick={() => fetchTasks()}
          className="inline-flex items-center px-3 py-2 rounded-md border text-sm hover:bg-gray-50"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
          <div className="relative w-72 max-w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks"
              className="w-full pl-9 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-md bg-white">
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-3 py-2 border rounded-md bg-white">
            <option value="">All Priority</option>
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="px-3 py-2 border rounded-md bg-white">
            <option value="">All Assignees</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <div className="ml-auto text-sm text-gray-500">{filtered.length} task(s)</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Title</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Priority</th>
                <th className="text-left font-semibold px-4 py-3">Assignee</th>
                <th className="text-left font-semibold px-4 py-3">Due</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.title}</div>
                    <div className="text-xs text-gray-500 truncate max-w-md">{t.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={t.status}
                      onChange={e => handleStatus(t.id, e.target.value as Task['status'])}
                      className="px-2 py-1 border rounded-md bg-white"
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={t.priority}
                      onChange={e => handlePriority(t.id, e.target.value as Task['priority'])}
                      className="px-2 py-1 border rounded-md bg-white"
                    >
                      {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={t.assigned_to}
                      onChange={e => handleAssign(t.id, e.target.value)}
                      className="px-2 py-1 border rounded-md bg-white min-w-[12rem]"
                    >
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700">{new Date(t.due_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={t.circular_id ? `/circular/${t.circular_id}` : '#'} className="text-indigo-600 hover:text-indigo-800">View</a>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No tasks found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ManagerPage;
