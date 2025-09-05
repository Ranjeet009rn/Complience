export interface Bank {
  id: string | number;
  name: string;
  type?: string; // Add type property to match usage in CircularDetail.tsx
  // Add other bank properties as needed
}

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate?: string;
  completed?: boolean;
  // Add other task properties as needed
}

export interface AnalysisResult {
  summary?: string;
  tasks?: Task[];
  // Add other analysis result properties as needed
}
