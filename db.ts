
import { User, Role, Family, Student, Assignment, Chore, CalendarEvent, Status, Frequency, Transaction, BudgetCategory, SavingsGoal } from './types';

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const dayAfter = new Date(Date.now() + 172800000).toISOString().split('T')[0];

export const MOCK_FAMILY: Family = {
  id: 'fam-1',
  name: 'The Miller Family',
  inviteCode: 'MILLER2024'
};

export const MOCK_USERS: User[] = [
  { id: 'u-1', name: 'Sarah Miller', email: 'sarah@example.com', role: Role.PARENT, familyId: 'fam-1', avatar: 'https://picsum.photos/seed/sarah/100' },
  { id: 'u-2', name: 'Leo Miller', email: 'leo@example.com', role: Role.CHILD, familyId: 'fam-1', avatar: 'https://picsum.photos/seed/leo/100' },
  { id: 'u-3', name: 'Maya Miller', email: 'maya@example.com', role: Role.CHILD, familyId: 'fam-1', avatar: 'https://picsum.photos/seed/maya/100' }
];

export const SEED_STUDENTS: Student[] = [
  { id: 's-1', familyId: 'fam-1', name: 'Leo Miller', grade: '5th Grade', notes: 'Enjoys math, needs help with focus.' },
  { id: 's-2', familyId: 'fam-1', name: 'Maya Miller', grade: '2nd Grade', notes: 'Reading champion!' }
];

export const SEED_ASSIGNMENTS: Assignment[] = [
  { id: 'a-1', studentId: 's-1', subject: 'Math', title: 'Fraction Multiplication', dueDate: today, estimatedMinutes: 30, status: Status.IN_PROGRESS, source: 'Manual' },
  { id: 'a-2', studentId: 's-1', subject: 'Science', title: 'Solar System Project', dueDate: dayAfter, estimatedMinutes: 120, status: Status.NOT_STARTED, source: 'Manual' },
  { id: 'a-3', studentId: 's-2', subject: 'Reading', title: 'Weekly Log', dueDate: tomorrow, estimatedMinutes: 15, status: Status.DONE, source: 'Import' }
];

export const SEED_CHORES: Chore[] = [
  { id: 'c-1', assigneeId: 'u-2', title: 'Empty Dishwasher', frequency: Frequency.WEEKLY, dueDate: today, status: Status.NOT_STARTED },
  { id: 'c-2', assigneeId: 'u-3', title: 'Feed the Dog', frequency: Frequency.WEEKLY, dueDate: today, status: Status.DONE },
  { id: 'c-3', assigneeId: 'u-1', title: 'Grocery Run', frequency: Frequency.ONE_TIME, dueDate: tomorrow, status: Status.NOT_STARTED }
];

export const SEED_EVENTS: CalendarEvent[] = [
  { id: 'e-1', familyId: 'fam-1', title: 'Soccer Practice', start: `${today}T16:00`, end: `${today}T17:30`, location: 'West Park' },
  { id: 'e-2', familyId: 'fam-1', title: 'Family Pizza Night', start: `${tomorrow}T18:30`, end: `${tomorrow}T20:00` },
  { id: 'e-3', familyId: 'fam-1', title: 'Dentist Appointment', start: `${dayAfter}T09:00`, end: `${dayAfter}T10:00`, location: 'Dr. Smile Office' }
];

// Finance Seed Data
export const SEED_TRANSACTIONS: Transaction[] = [
  { id: 't-1', familyId: 'fam-1', date: today, description: 'Whole Foods Market', amount: 84.50, category: 'Groceries', type: 'expense' },
  { id: 't-2', familyId: 'fam-1', date: yesterday, description: 'Shell Gas Station', amount: 45.00, category: 'Transport', type: 'expense' },
  { id: 't-3', familyId: 'fam-1', date: yesterday, description: 'Netflix Subscription', amount: 15.99, category: 'Entertainment', type: 'expense' },
  { id: 't-4', familyId: 'fam-1', date: today, description: 'Monthly Salary', amount: 4200.00, category: 'Income', type: 'income' },
];

export const SEED_BUDGETS: BudgetCategory[] = [
  { id: 'b-1', name: 'Groceries', limit: 800, spent: 420, color: '#6366f1' },
  { id: 'b-2', name: 'Dining Out', limit: 300, spent: 285, color: '#f59e0b' },
  { id: 'b-3', name: 'Utilities', limit: 400, spent: 310, color: '#10b981' },
  { id: 'b-4', name: 'Entertainment', limit: 200, spent: 45, color: '#ec4899' },
];

export const SEED_SAVINGS: SavingsGoal[] = [
  { id: 'sg-1', name: 'Summer Vacation', targetAmount: 5000, currentAmount: 3200, dueDate: '2024-07-01' },
  { id: 'sg-2', name: 'Emergency Fund', targetAmount: 10000, currentAmount: 8500 },
];
