
export enum Role {
  PARENT = 'Parent',
  CHILD = 'Child'
}

export enum Status {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done'
}

export enum Frequency {
  ONE_TIME = 'One-time',
  WEEKLY = 'Weekly'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  familyId: string;
  avatar?: string;
}

export interface Family {
  id: string;
  name: string;
  inviteCode: string;
}

export interface Student {
  id: string;
  familyId: string;
  name: string;
  grade: string;
  notes?: string;
}

export interface Assignment {
  id: string;
  studentId: string;
  subject: string;
  title: string;
  dueDate: string;
  estimatedMinutes: number;
  status: Status;
  source: 'Manual' | 'Import';
  teacher?: string;
  link?: string;
}

export interface Chore {
  id: string;
  assigneeId: string;
  title: string;
  frequency: Frequency;
  dueDate: string;
  status: Status;
}

export interface CalendarEvent {
  id: string;
  familyId: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  provider?: 'internal' | 'google';
  externalId?: string;
}

export interface OnboardingState {
  addedChild: boolean;
  addedAssignments: number;
  addedChores: number;
  addedEvents: number;
}

// New Finance Types
export interface Transaction {
  id: string;
  familyId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
}

export interface BudgetCategory {
  id: string;
  name: string;
  limit: number;
  spent: number;
  color: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  dueDate?: string;
}
