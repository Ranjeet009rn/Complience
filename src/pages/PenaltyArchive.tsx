import { useEffect, useMemo, useState } from 'react';
import { Download, Filter } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';

type Penalty = {
  id: string;
  date: string;
  regulator: string;
  entity: string;
  description: string;
  section?: string;
  amount: number;
  currency: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  status?: string;
  reference?: string;
};

function exportCSV(rows: Penalty[], filename: string) {
  const header = [
    'id','date','regulator','entity','description','section','amount','currency','severity','status','reference'
  ];
  const csv = [header.join(',')].concat(
    rows.map(r => header.map(h => {
      const v = (r as any)[h];
      const cell = v == null ? '' : String(v);
      return '"' + cell.replace(/"/g, '""') + '"';
    }).join(','))
  ).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PenaltyArchive() {
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [penalties, setPenalties] = useState<Penalty[]>([]);

  // filters
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState('');
  const [regulator, setRegulator] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function load() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (severity) params.set('severity', severity);
      if (regulator) params.set('regulator', regulator);
      if (entity) params.set('entity', entity);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/penalties?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load penalties');
      setPenalties(data.penalties || []);
    } catch (err: any) {
      addNotification({ title: 'Load failed', message: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return penalties.filter(p => {
      if (qq) {
        const hay = `${p.regulator} ${p.entity} ${p.description} ${p.section} ${p.reference}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [penalties, q]);

  // derive distinct values for dropdowns
  const regulators = useMemo(() => Array.from(new Set(penalties.map(p => p.regulator).filter(Boolean))), [penalties]);
  const entities = useMemo(() => Array.from(new Set(penalties.map(p => p.entity).filter(Boolean))), [penalties]);

  const totalAmount = useMemo(() => filtered.reduce((s, p) => s + (Number(p.amount) || 0), 0), [filtered]);

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Penalty Archive</h1>
            <p className="text-gray-500">Search, filter and export all regulatory penalties</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Amount</div>
            <div className="text-xl font-semibold text-gray-900">₹{totalAmount.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex flex-wrap gap-3 items-center">
            <div className="relative w-72 max-w-full">
              <input
                className="w-full pl-3 pr-3 py-2 border rounded-md bg-white"
                placeholder="Search description, section, reference"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select value={regulator} onChange={e => setRegulator(e.target.value)} className="px-3 py-2 border rounded-md bg-white">
                <option value="">All Regulators</option>
                {regulators.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={entity} onChange={e => setEntity(e.target.value)} className="px-3 py-2 border rounded-md bg-white">
                <option value="">All Entities</option>
                {entities.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={severity} onChange={e => setSeverity(e.target.value)} className="px-3 py-2 border rounded-md bg-white">
                <option value="">All Severity</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 border rounded-md bg-white" />
              <span className="text-gray-400">to</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 border rounded-md bg-white" />
              <button
                onClick={() => exportCSV(filtered, 'penalties.csv')}
                className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50 inline-flex items-center disabled:opacity-50"
                disabled={loading}
              >
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </button>
              <button
                onClick={load}
                className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50 inline-flex items-center disabled:opacity-50"
                disabled={loading}
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Date</th>
                  <th className="text-left font-semibold px-4 py-3">Regulator</th>
                  <th className="text-left font-semibold px-4 py-3">Entity</th>
                  <th className="text-left font-semibold px-4 py-3">Severity</th>
                  <th className="text-left font-semibold px-4 py-3">Amount</th>
                  <th className="text-left font-semibold px-4 py-3">Description</th>
                  <th className="text-left font-semibold px-4 py-3">Section</th>
                  <th className="text-left font-semibold px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">{new Date(p.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">{p.regulator}</td>
                    <td className="px-4 py-3">{p.entity}</td>
                    <td className="px-4 py-3">{p.severity}</td>
                    <td className="px-4 py-3">₹{(Number(p.amount) || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 max-w-lg">
                      <div className="text-gray-900">{p.description}</div>
                    </td>
                    <td className="px-4 py-3">{p.section || '-'}</td>
                    <td className="px-4 py-3">{p.reference || '-'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-500">No penalties</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
