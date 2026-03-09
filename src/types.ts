
// ─── Enums ────────────────────────────────────────────────────────────────────

export enum Role {
  PARENT = 'Parent',
  CHILD  = 'Child',
}

export enum Status {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  DONE        = 'Done',
}

export enum Frequency {
  DAILY    = 'Daily',
  WEEKLY   = 'Weekly',
  BIWEEKLY = 'Biweekly',
  MONTHLY  = 'Monthly',
  ONE_TIME = 'One-time',
}

// ─── Core Entities ────────────────────────────────────────────────────────────

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

// ─── Audit Mixin ──────────────────────────────────────────────────────────────
// Added to entities that need accountability tracking

export interface AuditFields {
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
  completedAt?: string;    // ISO timestamp — when status became DONE
  completedById?: string;  // userId — who marked it done
  daysOverdue?: number;    // computed at read time, not stored
}

// ─── Schoolwork ───────────────────────────────────────────────────────────────

export interface Assignment extends AuditFields {
  id: string;
  studentId: string;
  subject: string;
  title: string;
  dueDate: string;          // YYYY-MM-DD
  estimatedMinutes: number;
  status: Status;
  source: 'Manual' | 'Import' | 'AI';
  teacher?: string;
  link?: string;
  notes?: string;
}

// ─── Chores ───────────────────────────────────────────────────────────────────

export interface Chore extends AuditFields {
  id: string;
  assigneeId: string;       // userId of the person responsible
  title: string;
  frequency: Frequency;
  dueDate: string;          // YYYY-MM-DD
  status: Status;
  pointValue?: number;      // optional gamification hook
  notes?: string;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  familyId: string;
  title: string;
  start: string;            // ISO datetime
  end: string;              // ISO datetime
  location?: string;
  provider?: 'internal' | 'google';
  externalId?: string;
  attendeeIds?: string[];   // userIds
  createdAt: string;
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  familyId: string;
  date: string;             // YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  createdAt: string;
  source?: 'manual' | 'import' | 'ai_scan';
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

// ─── App State ────────────────────────────────────────────────────────────────

export interface OnboardingState {
  addedChild: boolean;
  addedAssignments: number;
  addedChores: number;
  addedEvents: number;
}

export interface FamilyState {
  currentUser: User | null;
  students: Student[];
  assignments: Assignment[];
  chores: Chore[];
  events: CalendarEvent[];
  transactions: Transaction[];
  budgets: BudgetCategory[];
  savings: SavingsGoal[];
  isGoogleLinked: boolean;
  lastBriefingGeneratedAt?: string; // ISO timestamp — throttle AI briefing
  lastBriefingText?: string;        // Persisted briefing prose — survives remounts
}

// ─── Reducer Actions ──────────────────────────────────────────────────────────

export type FamilyAction =
  // Auth
  | { type: 'LOGIN';  payload: User }
  | { type: 'LOGOUT' }

  // Assignments
  | { type: 'ADD_ASSIGNMENT';      payload: Assignment }
  | { type: 'UPDATE_ASSIGNMENT';   payload: Assignment }
  | { type: 'DELETE_ASSIGNMENT';   payload: string }
  | { type: 'COMPLETE_ASSIGNMENT'; payload: { id: string; completedById: string } }

  // Chores
  | { type: 'ADD_CHORE';        payload: Chore }
  | { type: 'UPDATE_CHORE';     payload: Chore }
  | { type: 'DELETE_CHORE';     payload: string }
  | { type: 'COMPLETE_CHORE';   payload: { id: string; completedById: string } }
  | { type: 'UNCOMPLETE_CHORE'; payload: string }

  // Events
  | { type: 'ADD_EVENT';    payload: CalendarEvent }
  | { type: 'UPDATE_EVENT'; payload: CalendarEvent }
  | { type: 'DELETE_EVENT'; payload: string }

  // Finance
  | { type: 'ADD_TRANSACTION';    payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'UPDATE_BUDGET';      payload: BudgetCategory }
  | { type: 'UPDATE_SAVINGS';     payload: SavingsGoal }

  // Settings
  | { type: 'SET_GOOGLE_LINKED';      payload: boolean }
  | { type: 'SET_BRIEFING_TIMESTAMP'; payload: string }
  | { type: 'SET_BRIEFING'; payload: { timestamp: string; text: string } }

  // Hydration — bulk replace, used by onboarding & ad-hoc mutations
  | { type: 'HYDRATE'; payload: Partial<FamilyState> };

// ─── Meal Planning Types ───────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

export interface Recipe {
  id: string;
  familyId: string;
  name: string;
  description: string;
  prepTime: number; // minutes
  cookTime: number; // minutes
  servings: number;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string;
}

export interface MealPlanEntry {
  id: string;
  familyId: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  recipeId: string | null;
  customMeal: string | null;
}

// ─── Shopping List Types ───────────────────────────────────────────────────────

export type ShoppingCategory =
  | 'Produce'
  | 'Dairy'
  | 'Meat & Seafood'
  | 'Bakery'
  | 'Pantry'
  | 'Frozen'
  | 'Beverages'
  | 'Household'
  | 'Other';

export interface ShoppingItem {
  id: string;
  name: string;
  amount: string;
  category: ShoppingCategory;
  checked: boolean;
  recipeSource?: string;
}

export interface ShoppingList {
  id: string;
  familyId: string;
  name: string;
  createdAt: string;
  items: ShoppingItem[];
}

// ─── Allowance & Rewards Types ────────────────────────────────────────────────

export interface Reward {
  id: string;
  familyId: string;
  name: string;
  description: string;
  pointCost: number;
  emoji: string;
}

export interface RewardTransaction {
  id: string;
  familyId: string;
  userId: string;
  type: 'earned' | 'redeemed';
  points: number;
  description: string;
  date: string;
  choreId?: string;
  rewardId?: string;
}

// ─── Pinboard Types ───────────────────────────────────────────────────────────

export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink';

export interface PinboardNote {
  id: string;
  familyId: string;
  authorId: string;
  content: string;
  color: NoteColor;
  pinned: boolean;
  createdAt: string;
}

// ─── Onboarding Types ─────────────────────────────────────────────────────────

export interface OnboardingChild {
  name: string;
  age: number | null;
  grade: string;
  school: string;
}

export interface OnboardingAdult {
  name: string;
  relationship: string;
}

export interface OnboardingEmailConfig {
  enabled: boolean;
  schoolDomains: string[];
  includeClassDojo: boolean;
  includeGoogleClassroom: boolean;
  knownSenders: string[];
}

export interface OnboardingData {
  status: 'gathering' | 'complete';
  parent: { name: string; email: string };
  additionalAdults: OnboardingAdult[];
  familyName: string;
  children: OnboardingChild[];
  priorities: string[];
  painPoints: string;
  emailConfig?: OnboardingEmailConfig;
  readyToLaunch: boolean;
}

export interface FamilyProfile {
  onboardingData: OnboardingData;
  family: Family;
  users: User[];
}

// ─── Email Intelligence Types ─────────────────────────────────────────────────

export type EmailCategory =
  | 'calendar_event'
  | 'assignment'
  | 'action_required'
  | 'behavior_update'
  | 'announcement'
  | 'irrelevant';

export interface ActionItem {
  id: string;
  source: string;
  title: string;
  description: string;
  childName: string | null;
  deadline: string | null;
  urgency: 'high' | 'medium' | 'low';
  status: 'pending' | 'done';
  emailId: string;
  createdAt: string;
}

export interface BehaviorUpdate {
  id: string;
  childName: string;
  type: 'positive' | 'negative' | 'neutral';
  details: string;
  points: number | null;
  source: string;
  date: string;
}

export interface Announcement {
  id: string;
  title: string;
  summary: string;
  source: string;
  childName: string | null;
  date: string;
  isRead: boolean;
}

export interface EmailScanConfig {
  enabled: boolean;
  schoolDomains: string[];
  knownSenders: string[];
  includeClassDojo: boolean;
  includeGoogleClassroom: boolean;
  lastScanAt: string | null;
  scanIntervalMinutes: number;
}

export interface EmailScanResult {
  scannedAt: string;
  emailsFound: number;
  itemsCreated: number;
  categories: Record<string, number>;
}

export interface ClassifiedEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  rawText: string;
  category: EmailCategory;
  confidence: number;
  childName: string | null;
  isDuplicate: boolean;
  extractedData: {
    eventTitle?: string;
    eventDate?: string;
    eventTime?: string;
    eventLocation?: string;
    assignmentTitle?: string;
    subject?: string;
    dueDate?: string;
    actionDescription?: string;
    deadline?: string;
    urgency?: 'high' | 'medium' | 'low';
    behaviorType?: 'positive' | 'negative' | 'neutral';
    details?: string;
    points?: number;
    summary?: string;
  };
}

// ─── Wellness Types ───────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  familyId: string;
  name: string;
  emoji: string;
  color: string;       // tailwind bg color class e.g. 'bg-green-100'
  createdAt: string;
}

export interface HabitCheckIn {
  habitId: string;
  userId: string;
  date: string;        // YYYY-MM-DD
}

export interface FamilyGoal {
  id: string;
  familyId: string;
  title: string;
  description: string;
  targetValue: number;
  currentProgress: number;
  unit: string;        // e.g. 'miles', 'books', '%'
  createdAt: string;
  completedAt?: string;
}

export interface HealthLogEntry {
  id: string;
  userId: string;
  date: string;        // YYYY-MM-DD
  exerciseMinutes: number;
  sleepHours: number;
  waterGlasses: number;
}

// ─── Goal Templates Types ─────────────────────────────────────────────────────

export type GoalTemplateCategory = 'Health' | 'Learning' | 'Finance' | 'Fun' | 'Custom';

export interface GoalTemplate {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: GoalTemplateCategory;
  targetValue: number;
  unit: string;
  allowancePoints?: number; // points awarded on completion
}

export interface GoalContribution {
  userId: string;
  amount: number;
  loggedAt: string; // ISO timestamp
}

export interface ActiveGoal {
  id: string;
  familyId: string;
  templateId: string | null;  // null = custom
  title: string;
  description: string;
  emoji: string;
  category: GoalTemplateCategory;
  targetValue: number;
  unit: string;
  allowancePoints?: number;
  contributions: GoalContribution[];
  createdAt: string;
  completedAt?: string;
}

// ─── Document Vault Types ─────────────────────────────────────────────────────

export type DocumentCategory =
  | 'Insurance'
  | 'Medical'
  | 'School'
  | 'Legal'
  | 'Financial'
  | 'Other';

export interface FamilyDocument {
  id: string;
  familyId: string;
  name: string;
  category: DocumentCategory;
  expiryDate?: string;
  notes?: string;
  fileUrl?: string;
  createdAt: string;
}

// ─── Health Tracker Types ─────────────────────────────────────────────────────

export type MedicationFrequency = 'daily' | 'twice-daily' | 'weekly' | 'as-needed';

export interface Medication {
  id: string;
  familyId: string;
  memberId: string;        // User id
  name: string;
  dosage: string;          // e.g. "10mg"
  frequency: MedicationFrequency;
  instructions?: string;
  startDate?: string;
  endDate?: string;        // undefined = ongoing
  refillDate?: string;
  createdAt: string;
}

export type AppointmentType = 'Doctor' | 'Dentist' | 'Vision' | 'Therapy' | 'Other';

export interface HealthAppointment {
  id: string;
  familyId: string;
  memberId: string;
  title: string;
  type: AppointmentType;
  date: string;            // YYYY-MM-DD
  time?: string;           // HH:MM
  location?: string;
  notes?: string;
  createdAt: string;
}

export interface VitalRecord {
  id: string;
  familyId: string;
  memberId: string;
  date: string;
  weight?: number;         // lbs
  height?: number;         // inches
  bloodPressure?: string;  // e.g. "120/80"
  notes?: string;
}
