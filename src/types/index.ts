export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Maker' | 'Checker' | 'Manager' | 'Auditor';
  avatar?: string;
}

export interface Circular {
  id: string;
  title: string;
  description: string;
  applicable: boolean;
  status: 'Active' | 'Archived' | 'Draft';
  created_at: string;
  category: string;
  has_penalty?: boolean;
  has_task?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  assigned_by: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Rejected';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  due_date: string;
  circular_id?: string;
  type: 'Maker' | 'Checker';
  created_at: string;
  completed: boolean; // Mark if the task is completed
  // Optional fields used by CircularDetail / compliance enrichment
  trace_id?: string; // audit trace id
  obligation_id?: string; // link to obligation
  sla?: { deadline?: string; days?: number };
  source?: 'ai_analysis' | 'manual' | string;
}

export interface Penalty {
  id: string;
  circular_id: string;
  amount: number;
  remarks: string;
  status: 'Pending' | 'Paid' | 'Waived';
  due_date: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  details: string;
}

export interface DashboardStats {
  totalCirculars: number;
  applicableCirculars: number;
  recurringTasks: number;
  users: number;
  penaltyAmount: number;
  penaltyCount: number;
  circularCountPenalty: number;
  circularWithoutTask: number;
  makerTasks: number;
  checkerTasks: number;
  pendingAtMaker: number;
  pendingAtChecker: number;
}