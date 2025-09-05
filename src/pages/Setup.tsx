import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { bankTypes, banks as seedBanks } from '../data/banks';
import { indiaStates } from '../data/indiaStates';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const colors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#14B8A6', '#F97316'];

function toCounts<T extends string>(arr: T[]): Record<T, number> {
  return arr.reduce((acc, k) => {
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

const Setup: React.FC = () => {
  // Local state for saved banks persisted to localStorage
  const [banks, setBanks] = useState<{ id: string; name: string; type: string; state: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultBankId, setDefaultBankId] = useState<string | null>(null);

  // inline edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<string>('');
  const [editState, setEditState] = useState<string>('');

  const [name, setName] = useState('');
  const [type, setType] = useState<string>('');
  const [state, setState] = useState<string>('');

  const resetForm = () => {
    setName('');
    setType('');
    setState('');
  };

  // LocalStorage helpers
  const LS_BANKS_KEY = 'bank_setup_banks';
  const LS_DEFAULT_KEY = 'bank_setup_default_bank_id';

  const loadFromLocalStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(LS_BANKS_KEY);
      let list = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(list) || list.length === 0) {
        list = seedBanks;
      }
      setBanks(list);
    } catch {
      setBanks(seedBanks);
    }
    try {
      const d = localStorage.getItem(LS_DEFAULT_KEY);
      setDefaultBankId(d ? String(d) : null);
    } catch {
      setDefaultBankId(null);
    }
  }, []);

  const saveBanksToLocalStorage = useCallback((list: { id: string; name: string; type: string; state: string }[]) => {
    try { localStorage.setItem(LS_BANKS_KEY, JSON.stringify(list)); } catch {}
  }, []);

  const saveDefaultToLocalStorage = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(LS_DEFAULT_KEY, id);
      else localStorage.removeItem(LS_DEFAULT_KEY);
    } catch {}
  }, []);

  // Load once on mount
  useEffect(() => { loadFromLocalStorage(); }, [loadFromLocalStorage]);

  // (Branches feature removed)

  const addBank = useCallback(async () => {
    setError(null);
    if (!name.trim()) {
      setError('Bank name is required');
      return;
    }
    if (!type) {
      setError('Please select a bank type');
      return;
    }
    if (!state) {
      setError('Please select a state');
      return;
    }
    try {
      setSaving(true);
      const newBank = { id: `b-${Date.now().toString(36)}`, name: name.trim(), type, state };
      setBanks((prev) => {
        const next = [newBank, ...prev];
        saveBanksToLocalStorage(next);
        return next;
      });
      resetForm();
      setShowForm(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save bank');
    } finally {
      setSaving(false);
    }
  }, [name, type, state]);

  const beginEdit = useCallback((id: string) => {
    const b = banks.find((x) => x.id === id);
    if (!b) return;
    setEditingId(id);
    setEditName(b.name);
    setEditType(b.type);
    setEditState(b.state);
  }, [banks]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setEditType('');
    setEditState('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    if (!editName.trim()) { setError('Bank name is required'); return; }
    if (!editType) { setError('Please select a bank type'); return; }
    if (!editState) { setError('Please select a state'); return; }
    const updated = { id: editingId, name: editName.trim(), type: editType, state: editState };
    setBanks((prev) => {
      const next = prev.map((b) => b.id === editingId ? updated : b);
      saveBanksToLocalStorage(next);
      return next;
    });
    setError(null);
    cancelEdit();
  }, [editingId, editName, editType, editState, cancelEdit]);

  const deleteBank = useCallback(async (id: string) => {
    setBanks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      saveBanksToLocalStorage(next);
      return next;
    });
    setDefaultBankId((curr) => {
      const next = curr === id ? null : curr;
      saveDefaultToLocalStorage(next);
      return next;
    });
    if (editingId === id) cancelEdit();
  }, [editingId, cancelEdit]);

  const setAsDefault = useCallback(async (id: string) => {
    setDefaultBankId(id);
    saveDefaultToLocalStorage(id);
  }, []);

  const byType = useMemo(() => {
    const counts = toCounts(banks.map((b) => b.type));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [banks]);

  const byState = useMemo(() => {
    const counts = toCounts(banks.map((b) => b.state));
    const arr = Object.entries(counts).map(([name, value]) => ({ name, value: Number(value) }));
    // Show top 8 states for readability
    return arr.sort((a, b) => b.value - a.value).slice(0, 8);
  }, [banks]);

  const byBankName = useMemo(() => {
    // Each bank appears once; still render for visual completeness
    return banks.map((b) => ({ name: b.name, value: 1, type: b.type, state: b.state }));
  }, [banks]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Bank Setup</h1>
        <p className="text-sm text-gray-500">Bank distributions by name, type and state</p>
      </div>

      {/* Saved Banks List and Add Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Saved Banks</h3>
            <p className="text-sm text-gray-500">Recently added banks appear first</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            {showForm ? 'Close' : 'Add Bank'}
          </button>
        </div>
        {showForm && (
          <div className="px-6 pt-4 pb-6 border-b border-gray-200">
            {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter bank name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Type</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="">Select type</option>
                  {bankTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="">Select state</option>
                  {indiaStates.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={addBank}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
        <div className="p-6">
          {banks.length === 0 ? (
            <p className="text-sm text-gray-500">No banks saved yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 text-xs">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">State</th>
                    <th className="py-2 pr-4 w-56">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {banks.map((b) => {
                    const isEditing = editingId === b.id;
                    return (
                      <tr key={b.id} className="border-t border-gray-100 align-top">
                        <td className="py-2 pr-4 text-gray-900 font-medium">
                          <div className="flex items-center gap-2">
                            {defaultBankId === b.id && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                Default
                              </span>
                            )}
                            <span className={defaultBankId === b.id ? 'ml-2' : ''}>
                              {isEditing ? (
                                <input
                                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                />
                              ) : (
                                <span>{b.name}</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          {isEditing ? (
                            <select
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm bg-white"
                              value={editType}
                              onChange={(e) => setEditType(e.target.value)}
                            >
                              {bankTypes.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          ) : (
                            b.type
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {isEditing ? (
                            <select
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm bg-white"
                              value={editState}
                              onChange={(e) => setEditState(e.target.value)}
                            >
                              {indiaStates.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            b.state
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {isEditing ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={saveEdit}
                                className="px-3 py-1 rounded-md text-xs bg-green-600 text-white hover:bg-green-700"
                              >Save</button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 rounded-md text-xs border border-gray-300 hover:bg-gray-50"
                              >Cancel</button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => beginEdit(b.id)}
                                className="px-3 py-1 rounded-md text-xs border border-gray-300 hover:bg-gray-50"
                              >Edit</button>
                              <button
                                onClick={() => deleteBank(b.id)}
                                className="px-3 py-1 rounded-md text-xs bg-red-600 text-white hover:bg-red-700"
                              >Delete</button>
                              <button
                                onClick={() => setAsDefault(b.id)}
                                disabled={defaultBankId === b.id}
                                className={`px-3 py-1 rounded-md text-xs ${defaultBankId === b.id ? 'border border-gray-200 text-gray-400 cursor-not-allowed' : 'border border-amber-300 text-amber-800 hover:bg-amber-50'}`}
                              >Set as Default</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Branches panel removed as requested */}
            </div>
          )}
        </div>
      </div>

      {/* Bank Type Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Banks by Type</h3>
            <p className="text-sm text-gray-500">Distribution of bank categories</p>
          </div>
          <div className="p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}>
                    {byType.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* State Bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Banks by State (Top 8)</h3>
            <p className="text-sm text-gray-500">Count of banks by registered state</p>
          </div>
          <div className="p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byState} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Name Horizontal Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Banks by Name</h3>
          <p className="text-sm text-gray-500">Each bar represents a bank (value = 1)</p>
        </div>
        <div className="p-6">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBankName} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={200} />
                <Tooltip />
                <Bar dataKey="value" fill="#10B981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Setup;
