import { useEffect, useMemo, useState } from 'react';
import { FileText, Download, Search, Filter } from 'lucide-react';
import { Task } from '../types';
import { useNotifications } from '../context/NotificationsContext';

function exportCSV(rows: any[], filename = 'report.csv') {
  const headers = Object.keys(rows[0] || { id: '', title: '', status: '', priority: '', assigned_to: '', due_date: '' });
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => escape(r[h])).join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportPage() {
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'assignee'>('none');

  const kpis = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pending = tasks.filter(t => t.status !== 'Completed').length;
    const high = tasks.filter(t => t.priority === 'High' || t.priority === 'Critical').length;
    return { total, completed, pending, high };
  }, [tasks]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return tasks.filter(t => {
      if (qq) {
        const hay = `${t.title} ${t.description} ${t.status} ${t.priority}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      if (status && t.status !== status) return false;
      if (priority && t.priority !== priority) return false;
      // Date range filter by due_date
      if (from) {
        const due = new Date(t.due_date).getTime();
        const fromTs = new Date(from).getTime();
        if (isFinite(due) && isFinite(fromTs) && due < fromTs) return false;
      }
      if (to) {
        const due = new Date(t.due_date).getTime();
        // Include the end date full day by adding 1 day minus 1 ms
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        const toTs = toEnd.getTime();
        if (isFinite(due) && isFinite(toTs) && due > toTs) return false;
      }
      return true;
    });
  }, [tasks, q, status, priority, from, to]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return null;
    const map = new Map<string, Task[]>();
    const keyFor = (t: Task) => groupBy === 'status' ? (t.status || 'Unknown') : (t.assigned_to || 'Unassigned');
    for (const t of filtered) {
      const k = keyFor(t);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load');
      setTasks(data.tasks || []);
    } catch (err: any) {
      addNotification({ title: 'Load failed', message: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-emerald-600 rounded-md flex items-center justify-center">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Generate compliance and task reports</p>
          {loading && <div className="text-xs text-gray-400">Loading...</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Total Tasks</div>
          <div className="text-2xl font-bold">{kpis.total}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Completed</div>
          <div className="text-2xl font-bold text-emerald-600">{kpis.completed}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{kpis.pending}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs text-gray-500">High/Critical</div>
          <div className="text-2xl font-bold text-red-600">{kpis.high}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <div className="relative w-72 max-w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks"
              className="w-full pl-9 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Filter className="w-4 h-4 text-gray-500" />
            <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 border rounded-md bg-white">
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="px-3 py-2 border rounded-md bg-white">
              <option value="">All Priority</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 border rounded-md bg-white" />
            <span className="text-gray-400">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 border rounded-md bg-white" />
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} className="px-3 py-2 border rounded-md bg-white">
              <option value="none">Group: None</option>
              <option value="status">Group: Status</option>
              <option value="assignee">Group: Assignee</option>
            </select>
            <button
              onClick={() => exportCSV(filtered, 'tasks_report.csv')}
              className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50 inline-flex items-center disabled:opacity-50"
              disabled={loading}
            >
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {groupBy === 'none' && (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Title</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">Priority</th>
                  <th className="text-left font-semibold px-4 py-3">Assignee</th>
                  <th className="text-left font-semibold px-4 py-3">Due</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{t.title}</div>
                      <div className="text-xs text-gray-500 truncate max-w-md">{t.description}</div>
                    </td>
                    <td className="px-4 py-3">{t.status}</td>
                    <td className="px-4 py-3">{t.priority}</td>
                    <td className="px-4 py-3">{t.assigned_to}</td>
                    <td className="px-4 py-3">{new Date(t.due_date).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No rows</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {groupBy !== 'none' && grouped && grouped.map(([group, rows]) => (
            <div key={group} className="border-t first:border-t-0">
              <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">{group}</div>
              <table className="min-w-full text-sm">
                <thead className="bg-white text-gray-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Title</th>
                    <th className="text-left font-semibold px-4 py-3">Status</th>
                    <th className="text-left font-semibold px-4 py-3">Priority</th>
                    <th className="text-left font-semibold px-4 py-3">Assignee</th>
                    <th className="text-left font-semibold px-4 py-3">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(t => (
                    <tr key={t.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{t.title}</div>
                        <div className="text-xs text-gray-500 truncate max-w-md">{t.description}</div>
                      </td>
                      <td className="px-4 py-3">{t.status}</td>
                      <td className="px-4 py-3">{t.priority}</td>
                      <td className="px-4 py-3">{t.assigned_to}</td>
                      <td className="px-4 py-3">{new Date(t.due_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ReportPage;
