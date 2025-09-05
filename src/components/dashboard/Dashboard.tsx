import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  CheckCircle,
  RotateCcw,
  Users,
  DollarSign,
  AlertTriangle,
  FileX,
  ClipboardX,
  UserPlus,
  UserCheck,
  Clock,
  Hourglass,
} from 'lucide-react';
import MetricCard from './MetricCard';
import { dashboardStats } from '../../data/mockData';
import RecentActivity from './RecentActivity';
import TaskOverview from './TaskOverview';
import PenaltyChart from './PenaltyChart';
import type { Task } from '../../types';

const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error(`Failed to load tasks (${res.status})`);
      const data = await res.json();
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const seedSampleTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const samples: Partial<Task>[] = [
        {
          title: 'Review AML Transaction Reports',
          description: 'Analyze suspicious transaction reports for Q1',
          status: 'In Progress',
          priority: 'High',
          due_date: new Date(Date.now() + 3 * 86400000).toISOString(),
          assigned_to: 'user-2',
          assigned_by: 'user-4',
          type: 'Maker',
          circular_id: '1',
          source: 'manual',
        },
        {
          title: 'Verify Customer Documentation',
          description: 'KYC completeness for new clients',
          status: 'Pending',
          priority: 'Medium',
          due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
          assigned_to: 'user-3',
          assigned_by: 'user-4',
          type: 'Checker',
          circular_id: '2',
          source: 'manual',
        },
        {
          title: 'Prepare Quarterly Report',
          description: 'Compile compliance report for submission',
          status: 'Completed',
          priority: 'Critical',
          due_date: new Date(Date.now() - 1 * 86400000).toISOString(),
          assigned_to: 'user-2',
          assigned_by: 'user-1',
          type: 'Maker',
          circular_id: '3',
          source: 'manual',
        },
      ];
      await Promise.all(
        samples.map((s) =>
          fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
          })
        )
      );
      await fetchTasks();
    } catch (e: any) {
      setError(e?.message || 'Failed to seed tasks');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!tasks.length) return dashboardStats;
    const makerTasks = tasks.filter((t) => t.type === 'Maker').length;
    const checkerTasks = tasks.filter((t) => t.type === 'Checker').length;
    const pendingAtMaker = tasks.filter((t) => t.type === 'Maker' && (t.status === 'Pending' || t.status === 'In Progress')).length;
    const pendingAtChecker = tasks.filter((t) => t.type === 'Checker' && (t.status === 'Pending' || t.status === 'In Progress')).length;
    return {
      ...dashboardStats,
      makerTasks,
      checkerTasks,
      pendingAtMaker,
      pendingAtChecker,
      // keep other fields from mock for now
    };
  }, [tasks]);

  const taskOverviewData = useMemo(() => {
    const total = tasks.length;
    if (!total) return null;
    const completed = tasks.filter((t) => t.status === 'Completed').length;
    const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
    const pending = tasks.filter((t) => t.status === 'Pending').length;
    const overdue = tasks.filter((t) => t.status !== 'Completed' && new Date(t.due_date).getTime() < Date.now()).length;
    const pct = (n: number) => Math.round((n / total) * 100);
    return [
      { name: 'Completed', value: pct(completed), color: '#10B981' },
      { name: 'In Progress', value: pct(inProgress), color: '#3B82F6' },
      { name: 'Pending', value: pct(pending), color: '#F59E0B' },
      { name: 'Overdue', value: pct(overdue), color: '#EF4444' },
    ];
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          {loading && <span className="text-sm text-gray-500">Loading…</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
          <button
            onClick={fetchTasks}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50"
            title="Refresh"
          >
            Refresh
          </button>
          <button
            onClick={seedSampleTasks}
            className="text-sm px-3 py-1.5 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            title="Seed sample tasks"
          >
            Add Sample Tasks
          </button>
          <div className="text-sm text-gray-500">
            Last updated: {lastUpdated ? lastUpdated.toLocaleString() : '—'}
          </div>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <MetricCard
          title="Total Circulars"
          value={stats.totalCirculars}
          icon={FileText}
          color="blue"
          change={{ value: 8, type: 'increase' }}
        />
        <MetricCard
          title="Applicable Circulars"
          value={stats.applicableCirculars}
          icon={CheckCircle}
          color="green"
          change={{ value: 12, type: 'increase' }}
        />
        <MetricCard
          title="Recurring Tasks"
          value={stats.recurringTasks}
          icon={RotateCcw}
          color="purple"
          change={{ value: 5, type: 'decrease' }}
        />
        <MetricCard
          title="Active Users"
          value={stats.users}
          icon={Users}
          color="indigo"
          change={{ value: 3, type: 'increase' }}
        />
      </div>

      {/* Penalty Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Penalty Amount"
          value={stats.penaltyAmount}
          icon={DollarSign}
          color="red"
          format="currency"
          change={{ value: 15, type: 'decrease' }}
        />
        <MetricCard
          title="Number of Penalties"
          value={stats.penaltyCount}
          icon={AlertTriangle}
          color="red"
          change={{ value: 2, type: 'decrease' }}
        />
        <MetricCard
          title="Circular Count (Penalty)"
          value={stats.circularCountPenalty}
          icon={FileX}
          color="yellow"
        />
        <MetricCard
          title="Circular w/o Task (Penalty)"
          value={stats.circularWithoutTask}
          icon={ClipboardX}
          color="yellow"
        />
      </div>

      {/* Task Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Maker Tasks"
          value={stats.makerTasks}
          icon={UserPlus}
          color="blue"
          change={{ value: 7, type: 'increase' }}
        />
        <MetricCard
          title="Checker Tasks"
          value={stats.checkerTasks}
          icon={UserCheck}
          color="green"
          change={{ value: 4, type: 'increase' }}
        />
        <MetricCard
          title="Pending @ Maker"
          value={stats.pendingAtMaker}
          icon={Clock}
          color="yellow"
          change={{ value: 10, type: 'decrease' }}
        />
        <MetricCard
          title="Pending @ Checker"
          value={stats.pendingAtChecker}
          icon={Hourglass}
          color="purple"
          change={{ value: 3, type: 'decrease' }}
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PenaltyChart />
        <TaskOverview data={taskOverviewData || undefined} />
      </div>

      <RecentActivity />
    </div>
  );
};

export default Dashboard;