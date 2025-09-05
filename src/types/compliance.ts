// Types for compliance workflow (Circular -> Obligations -> Tasks)

export enum Regulator {
  RBI = 'RBI',
  SEBI = 'SEBI',
}

export enum EntityClass {
  SCB = 'Scheduled Commercial Bank',
  SFB = 'Small Finance Bank',
  PB = 'Payments Bank',
  UCB_TIER_III = 'UCB Tier III',
  UCB_TIER_IV = 'UCB Tier IV',
  NBFC_UL = 'NBFC Upper Layer',
  NBFC_ML = 'NBFC Middle Layer',
  HFC = 'Housing Finance Company',
  CIC = 'Credit Information Company',
  AIFI = 'AIFI', // EXIM, NABARD, NaBFID, NHB, SIDBI
}

export enum Priority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

export enum TaskStatus {
  Pending = 'Pending',
  InProgress = 'In Progress',
  Completed = 'Completed',
}

export interface CircularMeta {
  id: string; // route id
  refId?: string; // e.g. RBI/2023-24/117
  issueDate?: string; // ISO date
  deadline?: string; // ISO date
  regulator?: Regulator;
  applicability?: EntityClass[];
  sourceUrl?: string;
}

export interface SLA {
  days?: number; // e.g. 30
  deadline?: string; // ISO date overrides days
}

export interface Obligation {
  id: string;
  circularId: string;
  title: string;
  description?: string;
  applicability?: EntityClass[];
  ownerRole?: string; // e.g., Compliance Officer
  priority?: Priority;
  dueDate?: string; // ISO
  evidenceRequired?: boolean;
  createdAt: string; // ISO
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string; // ISO
  createdAt: string; // ISO
  assigneeId?: string;
  createdBy?: string;
  type?: 'Maker' | 'Checker';
  circularId: string;
  obligationId?: string;
  sla?: SLA;
  traceId?: string; // for auditability
}
