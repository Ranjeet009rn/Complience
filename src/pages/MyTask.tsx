/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckSquare, Clock, Calendar, Filter, Plus, Pencil, Trash2, Save } from 'lucide-react';
// Using backend /api/tasks
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';

const MyTask: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialFilter = useMemo(() => {
    const tab = (searchParams.get('tab') || '').toLowerCase();
    if (tab === 'pending') return 'pending' as const;
    if (tab === 'in-progress') return 'in-progress' as const;
    if (tab === 'completed') return 'completed' as const;
    return 'all' as const;
  }, [searchParams]);
  const { addNotification } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>(initialFilter);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{title: string; description: string; due_date: string; priority: 'Low'|'Medium'|'High'|'Critical'}>({ title: '', description: '', due_date: '', priority: 'Medium' });
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '', // yyyy-mm-dd
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical',
  });
  const [tasks, setTasks] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  // Search options
  const [showSearchOpts, setShowSearchOpts] = useState(false);
  const [searchIn, setSearchIn] = useState<{ title: boolean; description: boolean }>({ title: true, description: true });
  const [priorityFilter, setPriorityFilter] = useState<Array<'Low'|'Medium'|'High'|'Critical'>>([]);
  const [dueFrom, setDueFrom] = useState<string>('');
  const [dueTo, setDueTo] = useState<string>('');

  // Keep filter in sync if query param changes
  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  // Load tasks from backend filtered by current user
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const assigned = user?.id || 'guest';
        const qs = new URLSearchParams({ assigned_to: assigned });
        const res = await fetch(`/api/tasks?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to load tasks');
        if (mounted) setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } catch (err: any) {
        try { addNotification({ title: 'Load failed', message: err.message || String(err) }); } catch {}
      }
    }
    load();
    return () => { mounted = false; };
  }, [user?.id, addNotification]);

  // No longer persisting to localStorage; server is source of truth

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'pending') return task.status === 'Pending';
    if (filter === 'in-progress') return task.status === 'In Progress';
    if (filter === 'completed') return task.status === 'Completed';
    return true;
  }).filter(task => {
    // Priority filter
    if (priorityFilter.length > 0 && !priorityFilter.includes(task.priority)) return false;
    // Due date range filter (inclusive)
    if (dueFrom) {
      const d = new Date(task.due_date);
      if (d < new Date(dueFrom)) return false;
    }
    if (dueTo) {
      const d = new Date(task.due_date);
      if (d > new Date(dueTo)) return false;
    }
    // Text query
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const parts: string[] = [];
    if (searchIn.title) parts.push(task.title);
    if (searchIn.description) parts.push(task.description);
    return parts.join(' ').toLowerCase().includes(q);
  });

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'Pending').length,
    'in-progress': tasks.filter(t => t.status === 'In Progress').length,
    completed: tasks.filter(t => t.status === 'Completed').length,
  } as const;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isOverdue = (dueIso?: string) => {
    if (!dueIso) return false;
    const d = new Date(dueIso).getTime();
    const now = Date.now();
    return d < now;
  };

  const isSoonDue = (dueIso?: string, days = 3) => {
    if (!dueIso) return false;
    const d = new Date(dueIso).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((d - now) / (24*60*60*1000));
    return diffDays > 0 && diffDays <= days;
  };

  const startEdit = (task: any) => {
    setEditingId(task.id);
    setEditDraft({
      title: task.title || '',
      description: task.description || '',
      due_date: task.due_date ? task.due_date.slice(0,10) : '',
      priority: task.priority || 'Medium',
    });
  };

  const saveEdit = async (taskId: string) => {
    const patch = {
      title: editDraft.title,
      description: editDraft.description,
      priority: editDraft.priority,
      due_date: editDraft.due_date ? new Date(editDraft.due_date).toISOString() : undefined,
    } as any;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to update');
      setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
      setEditingId(null);
      try { addNotification({ title: 'Task Updated', message: 'Task details saved' }); } catch {}
    } catch (err: any) {
      try { addNotification({ title: 'Update failed', message: err.message || String(err) }); } catch {}
    }
  };

  const deleteTask = async (taskId: string) => {
    // Mark as Rejected instead of removing (no DELETE endpoint)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Rejected' }) });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to update');
      setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
      try { addNotification({ title: 'Task Rejected', message: 'Task marked as rejected' }); } catch {}
    } catch (err: any) {
      try { addNotification({ title: 'Action failed', message: err.message || String(err) }); } catch {}
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'border-l-4 border-l-red-500';
      case 'High': return 'border-l-4 border-l-orange-500';
      case 'Medium': return 'border-l-4 border-l-yellow-500';
      case 'Low': return 'border-l-4 border-l-green-500';
      default: return 'border-l-4 border-l-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-500 mt-1">Track and complete your assigned work efficiently.</p>
        </div>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <div className="flex space-x-2">
              {(['all', 'pending', 'in-progress', 'completed'] as const).map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    filter === filterType
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {filterType.charAt(0).toUpperCase() + filterType.slice(1).replace('-', ' ')}
                  <span className="ml-1 text-xs text-gray-500">({counts[filterType]})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-56 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
          <div className="relative">
            <button
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              onClick={() => setShowSearchOpts(v => !v)}
            >
              Options
            </button>
            {showSearchOpts && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-20">
                <div className="text-sm font-medium text-gray-700 mb-2">Search in</div>
                <div className="flex items-center space-x-4 mb-3 text-sm">
                  <label className="inline-flex items-center space-x-2">
                    <input type="checkbox" checked={searchIn.title} onChange={(e)=>setSearchIn(s=>({...s,title:e.target.checked}))} />
                    <span>Title</span>
                  </label>
                  <label className="inline-flex items-center space-x-2">
                    <input type="checkbox" checked={searchIn.description} onChange={(e)=>setSearchIn(s=>({...s,description:e.target.checked}))} />
                    <span>Description</span>
                  </label>
                </div>
                <div className="text-sm font-medium text-gray-700 mb-2">Priority</div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {(['Low','Medium','High','Critical'] as const).map(p => {
                    const active = priorityFilter.includes(p);
                    return (
                      <button
                        key={p}
                        className={`px-2 py-1 rounded border text-xs ${active ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                        onClick={() => setPriorityFilter(prev => active ? prev.filter(x=>x!==p) : [...prev, p])}
                      >{p}</button>
                    );
                  })}
                </div>
                <div className="text-sm font-medium text-gray-700 mb-2">Due date range</div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={dueFrom} onChange={(e)=>setDueFrom(e.target.value)} className="px-2 py-1 border border-gray-300 rounded" />
                  <input type="date" value={dueTo} onChange={(e)=>setDueTo(e.target.value)} className="px-2 py-1 border border-gray-300 rounded" />
                </div>
                <div className="mt-3 flex justify-end space-x-2">
                  <button className="text-sm px-3 py-1.5 rounded border border-gray-300" onClick={()=>{setPriorityFilter([]); setDueFrom(''); setDueTo(''); setSearchIn({title:true, description:true});}}>Reset</button>
                  <button className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white" onClick={()=>setShowSearchOpts(false)}>Done</button>
                </div>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500">Showing {filteredTasks.length} of {tasks.length} tasks</div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Use filters or search to focus on specific tasks.</p>
      </div>

      {/* Your Tasks */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900">Your Tasks</h2>
          <p className="text-sm text-gray-500">{filteredTasks.length} tasks</p>
        </div>
        <div className="space-y-4">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 ${getPriorityColor(task.priority)}`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {editingId === task.id ? (
                      <input
                        className="text-lg font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 w-full max-w-lg"
                        value={editDraft.title}
                        onChange={(e)=>setEditDraft(d=>({...d,title:e.target.value}))}
                      />
                    ) : (
                      <h3 className="text-lg font-semibold text-gray-900">
                        {task.title}
                      </h3>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    {isOverdue(task.due_date) && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-800 border-red-200">Overdue</span>
                    )}
                    {!isOverdue(task.due_date) && isSoonDue(task.due_date) && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-amber-100 text-amber-800 border-amber-200">Due soon</span>
                    )}
                  </div>
                  {editingId === task.id ? (
                    <textarea
                      className="text-gray-600 mb-4 w-full border border-gray-300 rounded px-2 py-2"
                      value={editDraft.description}
                      onChange={(e)=>setEditDraft(d=>({...d,description:e.target.value}))}
                    />
                  ) : (
                    <p className="text-gray-600 mb-4">{task.description}</p>
                  )}
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      {editingId === task.id ? (
                        <input
                          type="date"
                          className="px-2 py-1 border border-gray-300 rounded"
                          value={editDraft.due_date}
                          onChange={(e)=>setEditDraft(d=>({...d,due_date:e.target.value}))}
                        />
                      ) : (
                        <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span>Priority:</span>
                      {editingId === task.id ? (
                        <select
                          className="px-2 py-1 border border-gray-300 rounded bg-white"
                          value={editDraft.priority}
                          onChange={(e)=>setEditDraft(d=>({...d,priority:e.target.value as any}))}
                        >
                          {(['Low','Medium','High','Critical'] as const).map(p => (<option key={p} value={p}>{p}</option>))}
                        </select>
                      ) : (
                        <span className="font-medium">{task.priority}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <select
                    aria-label="Change status"
                    className="text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white hover:border-gray-400"
                    value={task.status}
                    onChange={async (e) => {
                      const next = e.target.value as 'Pending' | 'In Progress' | 'Completed' | 'Rejected';
                      const prevState = tasks;
                      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t));
                      try {
                        const res = await fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
                        const data = await res.json();
                        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to update status');
                        setTasks(prev => prev.map(t => t.id === task.id ? data.task : t));
                        try { addNotification({ title: 'Status Updated', message: `${task.title} → ${next}` }); } catch {}
                      } catch (err: any) {
                        setTasks(prevState);
                        try { addNotification({ title: 'Update failed', message: err.message || String(err) }); } catch {}
                      }
                    }}
                  >
                    {['Pending','In Progress','Completed','Rejected'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {task.status !== 'Completed' && (
                    <button
                      className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                      onClick={async () => {
                        const prevState = tasks;
                        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'Completed' } : t));
                        try {
                          const res = await fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }) });
                          const data = await res.json();
                          if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to complete task');
                          setTasks(prev => prev.map(t => t.id === task.id ? data.task : t));
                          try { addNotification({ title: 'Task Completed', message: `${task.title} marked as completed` }); } catch {}
                        } catch (err: any) {
                          setTasks(prevState);
                          try { addNotification({ title: 'Action failed', message: err.message || String(err) }); } catch {}
                        }
                      }}
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                  )}
                  {editingId === task.id ? (
                    <button
                      className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg flex items-center"
                      onClick={() => saveEdit(task.id)}
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      className="text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                      onClick={() => startEdit(task)}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    className="text-red-600 hover:text-red-800 px-3 py-2 border border-red-300 rounded-lg hover:bg-red-50 transition-colors flex items-center"
                    onClick={() => deleteTask(task.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
                  >
                    {expandedId === task.id ? 'Hide Details' : 'View Details'}
                  </button>
                </div>
              </div>
              {expandedId === task.id && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900">Task Details</h4>
                  <p className="text-sm text-gray-600 mt-1">Subject: {task.title}</p>
                  <p className="text-sm text-gray-600">Assigned To: You</p>
                  <p className="text-sm text-gray-600">Created On: {new Date(task.created_at).toLocaleString()}</p>
                  {task.trace_id && (
                    <p className="text-xs text-gray-400 mt-1">Trace: {task.trace_id}</p>
                  )}
                  {task.obligation_id && (
                    <p className="text-xs text-gray-400">Obligation: {task.obligation_id}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        </div>
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
          <p className="text-gray-500">
            {filter === 'all' 
              ? "You don't have any tasks assigned yet." 
              : `You don't have any ${filter.replace('-', ' ')} tasks.`
            }
          </p>
        </div>
      )}

      {/* Add Task Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowAdd(false)} />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Add New Task</h3>
            <p className="text-sm text-gray-500 mb-4">Create a task with subtitle and due date.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  value={newTask.title}
                  onChange={(e) => setNewTask(t => ({ ...t, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle / Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(t => ({ ...t, description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 h-24 resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  placeholder="Brief description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask(t => ({ ...t, due_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask(t => ({ ...t, priority: e.target.value as any }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  >
                    {['Low','Medium','High','Critical'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                onClick={async () => {
                  const title = newTask.title.trim();
                  if (!title) return;
                  const due = newTask.due_date ? new Date(newTask.due_date).toISOString() : new Date().toISOString();
                  const body: any = {
                    title,
                    description: newTask.description.trim(),
                    status: 'Pending',
                    priority: newTask.priority,
                    due_date: due,
                    assigned_to: user?.id ?? 'guest',
                    assigned_by: user?.id ?? 'system',
                    type: (user?.role === 'Checker' ? 'Checker' : 'Maker') as 'Maker' | 'Checker',
                  };
                  try {
                    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                    const data = await res.json();
                    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to create task');
                    setTasks(prev => [data.task, ...prev]);
                    try { addNotification({ title: 'Task Created', message: `${title} added` }); } catch {}
                    setShowAdd(false);
                    setNewTask({ title: '', description: '', due_date: '', priority: 'Medium' });
                  } catch (err: any) {
                    try { addNotification({ title: 'Create failed', message: err.message || String(err) }); } catch {}
                  }
                }}
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTask;