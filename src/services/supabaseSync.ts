/**
 * supabaseSync.ts — Phase 3A
 *
 * Bidirectional sync between the app's FamilyState and Supabase tables.
 * Strategy: localStorage is the local cache; Supabase is source of truth.
 *
 *  • loadFamilyData()     — called on login; pulls all rows → FamilyState shape
 *  • pushFamilyData()     — called after onboarding; writes initial rows
 *  • upsertRows()         — called per-table when state slices change
 *  • deleteRow()          — called when a record is removed
 *  • subscribeToFamily()  — sets up Supabase real-time channel
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Frequency } from '../types';
import type {
  FamilyState,
  Family,
  User,
  Student,
  Assignment,
  Chore,
  CalendarEvent,
  Transaction,
  BudgetCategory,
  SavingsGoal,
} from '../types';

// ── Row mapping helpers ───────────────────────────────────────────────────────
// The DB uses snake_case; the app uses camelCase. Map them here.
// NOTE: Assignment and Chore do not have familyId on the app type, so the
//       "from*" write helpers take an explicit familyId parameter.

// ── Assignment ────────────────────────────────────────────────────────────────

export const toAssignment = (r: any): Assignment => ({
  id: r.id,
  studentId: r.student_id ?? '',
  title: r.title,
  subject: r.subject ?? '',
  dueDate: r.due_date ?? '',
  status: r.status,
  estimatedMinutes: r.estimated_minutes ?? 0,
  source: r.source ?? 'Manual',
  notes: r.notes ?? undefined,
  createdAt: r.created_at ?? new Date().toISOString(),
  updatedAt: r.updated_at ?? new Date().toISOString(),
});

const fromAssignment = (a: Assignment, familyId: string) => ({
  id: a.id,
  family_id: familyId,
  student_id: a.studentId ?? null,
  title: a.title,
  subject: a.subject,
  due_date: a.dueDate,
  status: a.status,
  estimated_minutes: a.estimatedMinutes ?? null,
  source: a.source ?? null,
  notes: a.notes ?? null,
  updated_at: new Date().toISOString(),
});

// ── Chore ────────────────────────────────────────────────────────────────────

export const toChore = (r: any): Chore => ({
  id: r.id,
  assigneeId: r.assignee_id ?? '',
  title: r.title,
  frequency: (r.recurrence as Frequency) ?? Frequency.ONE_TIME,
  dueDate: r.due_date ?? '',
  status: r.status,
  pointValue: r.points ?? 0,
  notes: r.notes ?? undefined,
  createdAt: r.created_at ?? new Date().toISOString(),
  updatedAt: r.updated_at ?? new Date().toISOString(),
});

const fromChore = (c: Chore, familyId: string) => ({
  id: c.id,
  family_id: familyId,
  assignee_id: c.assigneeId ?? null,
  title: c.title,
  due_date: c.dueDate,
  status: c.status,
  points: c.pointValue ?? 0,
  recurrence: c.frequency ?? null,
  updated_at: new Date().toISOString(),
});

// ── Calendar Event ────────────────────────────────────────────────────────────

export const toEvent = (r: any): CalendarEvent => ({
  id: r.id,
  familyId: r.family_id,
  title: r.title,
  start: r.start_time,
  end: r.end_time ?? '',
  location: r.location ?? undefined,
  provider: r.provider ?? 'internal',
  externalId: r.google_event_id ?? undefined,
  createdAt: r.created_at ?? new Date().toISOString(),
});

const fromEvent = (e: CalendarEvent) => ({
  id: e.id,
  family_id: e.familyId,
  title: e.title,
  start_time: e.start,
  end_time: e.end ?? null,
  location: e.location ?? null,
  provider: e.provider ?? 'internal',
  google_event_id: e.externalId ?? null,
});

// ── Transaction ───────────────────────────────────────────────────────────────

export const toTransaction = (r: any): Transaction => ({
  id: r.id,
  familyId: r.family_id,
  description: r.description,
  amount: r.amount,
  category: r.category ?? '',
  date: r.date,
  type: r.type,
  createdAt: r.created_at ?? new Date().toISOString(),
  source: r.source ?? undefined,
});

const fromTransaction = (t: Transaction) => ({
  id: t.id,
  family_id: t.familyId,
  description: t.description,
  amount: t.amount,
  category: t.category ?? null,
  date: t.date,
  type: t.type,
  source: t.source ?? null,
});

// ── Budget Category ───────────────────────────────────────────────────────────
// DB: category (text), limit_amount, spent, period
// App type: name (string), limit, spent, color — no familyId on app type

export const toBudget = (r: any): BudgetCategory => ({
  id: r.id,
  name: r.category ?? '',   // DB 'category' → app 'name'
  limit: r.limit_amount ?? 0,
  spent: r.spent ?? 0,
  color: '#6366f1',          // default; color is UI-only, not stored in DB
});

const fromBudget = (b: BudgetCategory, familyId: string) => ({
  id: b.id,
  family_id: familyId,
  category: b.name,         // app 'name' → DB 'category'
  limit_amount: b.limit,
  spent: b.spent,
  period: 'monthly',
});

// ── Savings Goal ──────────────────────────────────────────────────────────────
// DB: name, target, current, deadline, icon
// App type: name, targetAmount, currentAmount, dueDate — no familyId on app type

export const toSavings = (r: any): SavingsGoal => ({
  id: r.id,
  name: r.name,
  targetAmount: r.target ?? 0,       // DB 'target' → app 'targetAmount'
  currentAmount: r.current ?? 0,     // DB 'current' → app 'currentAmount'
  dueDate: r.deadline ?? undefined,  // DB 'deadline' → app 'dueDate'
});

const fromSavings = (s: SavingsGoal, familyId: string) => ({
  id: s.id,
  family_id: familyId,
  name: s.name,
  target: s.targetAmount,            // app 'targetAmount' → DB 'target'
  current: s.currentAmount,          // app 'currentAmount' → DB 'current'
  deadline: s.dueDate ?? null,       // app 'dueDate' → DB 'deadline'
  icon: null,
});

// ── Student ───────────────────────────────────────────────────────────────────

export const toStudent = (r: any): Student => ({
  id: r.id,
  familyId: r.family_id,
  name: r.name,
  grade: r.grade ?? '',
  notes: r.notes ?? undefined,
});

const fromStudent = (s: Student) => ({
  id: s.id,
  family_id: s.familyId,
  name: s.name,
  grade: s.grade ?? null,
  avatar_url: null,
  student_email: null,
});

// ── Load all family data from Supabase ───────────────────────────────────────

export interface LoadedFamilyData {
  family: Family;
  users: User[];
  students: Student[];
  assignments: Assignment[];
  chores: Chore[];
  events: CalendarEvent[];
  transactions: Transaction[];
  budgets: BudgetCategory[];
  savings: SavingsGoal[];
}

export async function loadFamilyData(familyId: string): Promise<LoadedFamilyData | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const [
      famRes, profilesRes, studRes,
      asgRes, choreRes, evtRes,
      txRes, budRes, savRes,
    ] = await Promise.all([
      supabase.from('families').select('*').eq('id', familyId).single(),
      supabase.from('profiles').select('*').eq('family_id', familyId),
      supabase.from('students').select('*').eq('family_id', familyId),
      supabase.from('assignments').select('*').eq('family_id', familyId),
      supabase.from('chores').select('*').eq('family_id', familyId),
      supabase.from('events').select('*').eq('family_id', familyId),
      supabase.from('transactions').select('*').eq('family_id', familyId),
      supabase.from('budgets').select('*').eq('family_id', familyId),
      supabase.from('savings_goals').select('*').eq('family_id', familyId),
    ]);

    if (famRes.error) { console.error('[Sync] family load error', famRes.error); return null; }

    const dbFamily = famRes.data;
    const family: Family = {
      id: dbFamily.id,
      name: dbFamily.name,
      inviteCode: dbFamily.invite_code,
    };

    const users: User[] = (profilesRes.data ?? []).map((r: any) => ({
      id: r.id,
      familyId: r.family_id,
      name: r.name,
      email: r.email ?? '',
      role: r.role,
      avatar: r.avatar_url ?? undefined,
    }));

    return {
      family,
      users,
      students: (studRes.data ?? []).map(toStudent),
      assignments: (asgRes.data ?? []).map(toAssignment),
      chores: (choreRes.data ?? []).map(toChore),
      events: (evtRes.data ?? []).map(toEvent),
      transactions: (txRes.data ?? []).map(toTransaction),
      budgets: (budRes.data ?? []).map(toBudget),
      savings: (savRes.data ?? []).map(toSavings),
    };
  } catch (err) {
    console.error('[Sync] loadFamilyData failed', err);
    return null;
  }
}

// ── Push initial data to Supabase (called at onboarding complete) ─────────────

export async function pushFamilyData(
  family: Family,
  users: User[],
  state: Pick<FamilyState, 'students' | 'assignments' | 'chores' | 'events' | 'transactions' | 'budgets' | 'savings'>,
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const familyId = family.id;

  try {
    // Family
    await supabase.from('families').upsert({
      id: family.id, name: family.name, invite_code: family.inviteCode,
    });

    // Profiles
    const profileRows = users.map(u => ({
      id: u.id,
      family_id: u.familyId,
      name: u.name,
      email: u.email ?? null,
      role: u.role,
      avatar_url: u.avatar ?? null,
      points: 0,
    }));
    await supabase.from('profiles').upsert(profileRows);

    // Core tables — pass familyId explicitly since app types may not carry it
    if (state.students.length)
      await supabase.from('students').upsert(state.students.map(fromStudent));
    if (state.assignments.length)
      await supabase.from('assignments').upsert(state.assignments.map(a => fromAssignment(a, familyId)));
    if (state.chores.length)
      await supabase.from('chores').upsert(state.chores.map(c => fromChore(c, familyId)));
    if (state.events.length)
      await supabase.from('events').upsert(state.events.map(fromEvent));
    if (state.transactions.length)
      await supabase.from('transactions').upsert(state.transactions.map(fromTransaction));
    if (state.budgets.length)
      await supabase.from('budgets').upsert(state.budgets.map(b => fromBudget(b, familyId)));
    if (state.savings.length)
      await supabase.from('savings_goals').upsert(state.savings.map(s => fromSavings(s, familyId)));

    console.info('[Sync] Initial family data pushed to Supabase ✓');
  } catch (err) {
    console.error('[Sync] pushFamilyData failed', err);
  }
}

// ── Incremental upsert/delete helpers ────────────────────────────────────────
// familyId must be passed explicitly since Assignment/Chore types don't carry it.

export async function upsertAssignment(a: Assignment, familyId: string) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('assignments').upsert(fromAssignment(a, familyId));
  if (error) console.error('[Sync] upsertAssignment', error);
}
export async function deleteAssignment(id: string) {
  if (!isSupabaseConfigured) return;
  await supabase.from('assignments').delete().eq('id', id);
}

export async function upsertChore(c: Chore, familyId: string) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('chores').upsert(fromChore(c, familyId));
  if (error) console.error('[Sync] upsertChore', error);
}
export async function deleteChore(id: string) {
  if (!isSupabaseConfigured) return;
  await supabase.from('chores').delete().eq('id', id);
}

export async function upsertEvent(e: CalendarEvent) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('events').upsert(fromEvent(e));
  if (error) console.error('[Sync] upsertEvent', error);
}
export async function deleteEvent(id: string) {
  if (!isSupabaseConfigured) return;
  await supabase.from('events').delete().eq('id', id);
}

export async function upsertTransaction(t: Transaction) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('transactions').upsert(fromTransaction(t));
  if (error) console.error('[Sync] upsertTransaction', error);
}
export async function deleteTransaction(id: string) {
  if (!isSupabaseConfigured) return;
  await supabase.from('transactions').delete().eq('id', id);
}

export async function upsertBudget(b: BudgetCategory, familyId: string) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('budgets').upsert(fromBudget(b, familyId));
  if (error) console.error('[Sync] upsertBudget', error);
}

export async function upsertSavings(s: SavingsGoal, familyId: string) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('savings_goals').upsert(fromSavings(s, familyId));
  if (error) console.error('[Sync] upsertSavings', error);
}

// ── Real-time subscription ───────────────────────────────────────────────────

export type RealtimePayload = {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: any;
  old: any;
};

export function subscribeToFamily(
  familyId: string,
  onUpdate: (payload: RealtimePayload) => void,
) {
  if (!isSupabaseConfigured) return () => {};

  const tables = ['assignments', 'chores', 'events', 'transactions', 'budgets', 'savings_goals'];

  const channel = supabase
    .channel(`family:${familyId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', filter: `family_id=eq.${familyId}` },
      (payload: any) => {
        if (tables.includes(payload.table)) {
          onUpdate({
            table: payload.table,
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
          });
        }
      })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
