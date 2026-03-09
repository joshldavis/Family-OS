import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  FamilyState,
  FamilyAction,
  Status,
} from './types';
import {
  MOCK_USERS,
  SEED_STUDENTS,
  SEED_ASSIGNMENTS,
  SEED_CHORES,
  SEED_EVENTS,
  SEED_TRANSACTIONS,
  SEED_BUDGETS,
  SEED_SAVINGS,
} from './db';
import {
  loadFamilyData,
  subscribeToFamily,
  upsertAssignment,
  deleteAssignment,
  upsertChore,
  deleteChore,
  upsertEvent,
  deleteEvent,
  upsertTransaction,
  deleteTransaction,
  upsertBudget,
  upsertSavings,
  toAssignment,
  toChore,
  toEvent,
  toTransaction,
  toBudget,
  toSavings,
} from './services/supabaseSync';

// ─── Storage Key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'family_os_v2';

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL_STATE: FamilyState = {
  currentUser: null,
  students: SEED_STUDENTS,
  assignments: SEED_ASSIGNMENTS,
  chores: SEED_CHORES,
  events: SEED_EVENTS,
  transactions: SEED_TRANSACTIONS,
  budgets: SEED_BUDGETS,
  savings: SEED_SAVINGS,
  isGoogleLinked: false,
  lastBriefingGeneratedAt: undefined,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function familyReducer(state: FamilyState, action: FamilyAction): FamilyState {
  const now = new Date().toISOString();

  switch (action.type) {

    // ── Auth ──────────────────────────────────────────────────────────────────

    case 'LOGIN':
      return { ...state, currentUser: action.payload };

    case 'LOGOUT':
      return { ...state, currentUser: null };

    // ── Assignments ───────────────────────────────────────────────────────────

    case 'ADD_ASSIGNMENT':
      return { ...state, assignments: [action.payload, ...state.assignments] };

    case 'UPDATE_ASSIGNMENT':
      return {
        ...state,
        assignments: state.assignments.map(a =>
          a.id === action.payload.id ? { ...action.payload, updatedAt: now } : a
        ),
      };

    case 'DELETE_ASSIGNMENT':
      return {
        ...state,
        assignments: state.assignments.filter(a => a.id !== action.payload),
      };

    case 'COMPLETE_ASSIGNMENT':
      return {
        ...state,
        assignments: state.assignments.map(a =>
          a.id === action.payload.id
            ? {
                ...a,
                status: Status.DONE,
                completedAt: now,
                completedById: action.payload.completedById,
                updatedAt: now,
              }
            : a
        ),
      };

    // ── Chores ────────────────────────────────────────────────────────────────

    case 'ADD_CHORE':
      return { ...state, chores: [action.payload, ...state.chores] };

    case 'UPDATE_CHORE':
      return {
        ...state,
        chores: state.chores.map(c =>
          c.id === action.payload.id ? { ...action.payload, updatedAt: now } : c
        ),
      };

    case 'DELETE_CHORE':
      return {
        ...state,
        chores: state.chores.filter(c => c.id !== action.payload),
      };

    case 'COMPLETE_CHORE':
      return {
        ...state,
        chores: state.chores.map(c =>
          c.id === action.payload.id
            ? {
                ...c,
                status: Status.DONE,
                completedAt: now,
                completedById: action.payload.completedById,
                updatedAt: now,
              }
            : c
        ),
      };

    case 'UNCOMPLETE_CHORE':
      return {
        ...state,
        chores: state.chores.map(c =>
          c.id === action.payload
            ? {
                ...c,
                status: Status.NOT_STARTED,
                completedAt: undefined,
                completedById: undefined,
                updatedAt: now,
              }
            : c
        ),
      };

    // ── Events ────────────────────────────────────────────────────────────────

    case 'ADD_EVENT':
      return { ...state, events: [action.payload, ...state.events] };

    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map(e =>
          e.id === action.payload.id ? { ...action.payload, updatedAt: now } : e
        ),
      };

    case 'DELETE_EVENT':
      return {
        ...state,
        events: state.events.filter(e => e.id !== action.payload),
      };

    // ── Finance ───────────────────────────────────────────────────────────────

    case 'ADD_TRANSACTION':
      return { ...state, transactions: [action.payload, ...state.transactions] };

    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter(t => t.id !== action.payload),
      };

    case 'UPDATE_BUDGET':
      return {
        ...state,
        budgets: state.budgets.map(b =>
          b.id === action.payload.id ? action.payload : b
        ),
      };

    case 'UPDATE_SAVINGS':
      return {
        ...state,
        savings: state.savings.map(s =>
          s.id === action.payload.id ? action.payload : s
        ),
      };

    // ── Settings ──────────────────────────────────────────────────────────────

    case 'SET_GOOGLE_LINKED':
      return { ...state, isGoogleLinked: action.payload };

    case 'SET_BRIEFING_TIMESTAMP':
      return { ...state, lastBriefingGeneratedAt: action.payload };

    case 'SET_BRIEFING':
      return {
        ...state,
        lastBriefingGeneratedAt: action.payload.timestamp,
        lastBriefingText: action.payload.text,
      };

    // ── Hydration ─────────────────────────────────────────────────────────────

    case 'HYDRATE':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// ─── Persistence Helpers ──────────────────────────────────────────────────────

function loadFromStorage(): Partial<FamilyState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<FamilyState>;
  } catch {
    return null;
  }
}

function saveToStorage(state: FamilyState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Family OS: failed to persist state', e);
  }
}

// ─── Derived Selectors ────────────────────────────────────────────────────────

export function getOverdueChores(state: FamilyState) {
  const today = new Date().toISOString().split('T')[0];
  return state.chores.filter(c => c.status !== Status.DONE && c.dueDate < today);
}

export function getOverdueAssignments(state: FamilyState) {
  const today = new Date().toISOString().split('T')[0];
  return state.assignments.filter(a => a.status !== Status.DONE && a.dueDate < today);
}

export function getUpcomingEvents(state: FamilyState, withinDays = 7) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 86400000);
  return state.events
    .filter(e => {
      const start = new Date(e.start);
      return start >= now && start <= cutoff;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export function getBudgetsNearLimit(state: FamilyState, threshold = 0.8) {
  return state.budgets.filter(b => b.limit > 0 && b.spent / b.limit >= threshold);
}

export function getChoreCompletionRate(state: FamilyState) {
  if (state.chores.length === 0) return 0;
  const done = state.chores.filter(c => c.status === Status.DONE).length;
  return Math.round((done / state.chores.length) * 100);
}

export function getAssignmentsDueSoon(state: FamilyState, withinDays = 3) {
  const today  = new Date().toISOString().split('T')[0];
  const cutoff = new Date(Date.now() + withinDays * 86400000).toISOString().split('T')[0];
  return state.assignments.filter(
    a => a.status !== Status.DONE && a.dueDate >= today && a.dueDate <= cutoff
  );
}

// Builds a structured summary for the AI briefing
export function buildBriefingContext(state: FamilyState) {
  return {
    overdueChores: getOverdueChores(state).map(c => ({
      title: c.title,
      assigneeId: c.assigneeId,
      daysOverdue: Math.floor((Date.now() - new Date(c.dueDate).getTime()) / 86400000),
    })),
    overdueAssignments: getOverdueAssignments(state).map(a => ({
      title: a.title,
      subject: a.subject,
      studentId: a.studentId,
      daysOverdue: Math.floor((Date.now() - new Date(a.dueDate).getTime()) / 86400000),
    })),
    dueSoonAssignments: getAssignmentsDueSoon(state).map(a => ({
      title: a.title,
      subject: a.subject,
      studentId: a.studentId,
      dueDate: a.dueDate,
      estimatedMinutes: a.estimatedMinutes,
    })),
    upcomingEvents: getUpcomingEvents(state).map(e => ({
      title: e.title,
      start: e.start,
      location: e.location,
    })),
    budgetAlerts: getBudgetsNearLimit(state).map(b => ({
      category: b.name,
      spent: b.spent,
      limit: b.limit,
      percentUsed: Math.round((b.spent / b.limit) * 100),
    })),
    choreCompletionRate: getChoreCompletionRate(state),
    familyMembers: state.students.map(s => ({
      id: s.id,
      name: s.name,
      grade: s.grade,
    })),
    users: state.currentUser
      ? [state.currentUser, ...MOCK_USERS.filter(u => u.id !== state.currentUser!.id)]
      : MOCK_USERS,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface FamilyContextValue {
  state: FamilyState;
  dispatch: React.Dispatch<FamilyAction>;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const FamilyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(familyReducer, INITIAL_STATE);
  // Gate persistence until hydration completes so we never overwrite saved data
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Track recently-synced IDs to suppress echo from our own Supabase writes
  const recentlySyncedIds = React.useRef<Set<string>>(new Set());
  const trackSynced = (id: string) => {
    recentlySyncedIds.current.add(id);
    setTimeout(() => recentlySyncedIds.current.delete(id), 3000);
  };

  // ── Supabase-aware dispatch ──────────────────────────────────────────────
  // Fires local dispatch immediately (optimistic), then syncs to Supabase async.
  const syncDispatch = useCallback((action: FamilyAction) => {
    // 1. Optimistic local update
    dispatch(action);

    // 2. Async Supabase sync — fire-and-forget, never blocks UI
    const familyId = state.currentUser?.familyId ?? '';
    if (!familyId) return; // No sync without a logged-in family

    const now = new Date().toISOString();

    switch (action.type) {
      // ── Assignments ──────────────────────────────────────────────────────
      case 'ADD_ASSIGNMENT':
      case 'UPDATE_ASSIGNMENT':
        trackSynced(action.payload.id);
        upsertAssignment(action.payload, familyId);
        break;

      case 'COMPLETE_ASSIGNMENT': {
        const a = state.assignments.find(x => x.id === action.payload.id);
        if (a) {
          const updated = {
            ...a,
            status: Status.DONE,
            completedAt: now,
            completedById: action.payload.completedById,
            updatedAt: now,
          };
          trackSynced(a.id);
          upsertAssignment(updated, familyId);
        }
        break;
      }

      case 'DELETE_ASSIGNMENT':
        trackSynced(action.payload);
        deleteAssignment(action.payload);
        break;

      // ── Chores ───────────────────────────────────────────────────────────
      case 'ADD_CHORE':
      case 'UPDATE_CHORE':
        trackSynced(action.payload.id);
        upsertChore(action.payload, familyId);
        break;

      case 'COMPLETE_CHORE': {
        const c = state.chores.find(x => x.id === action.payload.id);
        if (c) {
          const updated = {
            ...c,
            status: Status.DONE,
            completedAt: now,
            completedById: action.payload.completedById,
            updatedAt: now,
          };
          trackSynced(c.id);
          upsertChore(updated, familyId);
        }
        break;
      }

      case 'UNCOMPLETE_CHORE': {
        const c = state.chores.find(x => x.id === action.payload);
        if (c) {
          const updated = {
            ...c,
            status: Status.NOT_STARTED,
            completedAt: undefined,
            completedById: undefined,
            updatedAt: now,
          };
          trackSynced(c.id);
          upsertChore(updated, familyId);
        }
        break;
      }

      case 'DELETE_CHORE':
        trackSynced(action.payload);
        deleteChore(action.payload);
        break;

      // ── Events ───────────────────────────────────────────────────────────
      case 'ADD_EVENT':
      case 'UPDATE_EVENT':
        trackSynced(action.payload.id);
        upsertEvent(action.payload);
        break;

      case 'DELETE_EVENT':
        trackSynced(action.payload);
        deleteEvent(action.payload);
        break;

      // ── Finance ──────────────────────────────────────────────────────────
      case 'ADD_TRANSACTION':
        trackSynced(action.payload.id);
        upsertTransaction(action.payload);
        break;

      case 'DELETE_TRANSACTION':
        trackSynced(action.payload);
        deleteTransaction(action.payload);
        break;

      case 'UPDATE_BUDGET':
        trackSynced(action.payload.id);
        upsertBudget(action.payload, familyId);
        break;

      case 'UPDATE_SAVINGS':
        trackSynced(action.payload.id);
        upsertSavings(action.payload, familyId);
        break;

      // ── No-op actions (auth/settings only touch localStorage) ────────────
      default:
        break;
    }
  }, [dispatch, state]); // Re-create when state changes so closures are fresh

  // ── Hydrate from localStorage, then refresh from Supabase ───────────────
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      dispatch({ type: 'HYDRATE', payload: saved });

      // If there's a logged-in user with a family, fetch fresh data from Supabase
      const familyId = saved.currentUser?.familyId;
      if (familyId) {
        loadFamilyData(familyId).then(data => {
          if (data) {
            console.info('[Sync] Hydrated from Supabase ✓');
            dispatch({
              type: 'HYDRATE',
              payload: {
                students: data.students,
                assignments: data.assignments,
                chores: data.chores,
                events: data.events,
                transactions: data.transactions,
                budgets: data.budgets,
                savings: data.savings,
              },
            });
          }
        }).catch(err => console.warn('[Sync] Supabase hydration failed, using localStorage', err));
      }
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage only after hydration so INITIAL_STATE never clobbers saved data
  useEffect(() => {
    if (isHydrated) saveToStorage(state);
  }, [state, isHydrated]);

  // ── Supabase real-time subscription ─────────────────────────────────────
  // Subscribes when a family is logged in; unsubscribes on family change / logout.
  useEffect(() => {
    const familyId = state.currentUser?.familyId;
    if (!familyId) return;

    const unsubscribe = subscribeToFamily(familyId, (payload) => {
      // Skip changes we just wrote ourselves (suppress echo)
      const recordId: string | undefined = payload.new?.id ?? payload.old?.id;
      if (recordId && recentlySyncedIds.current.has(recordId)) return;

      if (payload.eventType === 'DELETE') {
        switch (payload.table) {
          case 'assignments': dispatch({ type: 'DELETE_ASSIGNMENT', payload: payload.old.id }); break;
          case 'chores':      dispatch({ type: 'DELETE_CHORE',      payload: payload.old.id }); break;
          case 'events':      dispatch({ type: 'DELETE_EVENT',      payload: payload.old.id }); break;
          case 'transactions': dispatch({ type: 'DELETE_TRANSACTION', payload: payload.old.id }); break;
        }
      } else {
        // INSERT or UPDATE — map DB row to app type and dispatch
        switch (payload.table) {
          case 'assignments':
            dispatch({
              type: payload.eventType === 'INSERT' ? 'ADD_ASSIGNMENT' : 'UPDATE_ASSIGNMENT',
              payload: toAssignment(payload.new),
            });
            break;
          case 'chores':
            dispatch({
              type: payload.eventType === 'INSERT' ? 'ADD_CHORE' : 'UPDATE_CHORE',
              payload: toChore(payload.new),
            });
            break;
          case 'events':
            dispatch({
              type: payload.eventType === 'INSERT' ? 'ADD_EVENT' : 'UPDATE_EVENT',
              payload: toEvent(payload.new),
            });
            break;
          case 'transactions':
            if (payload.eventType === 'INSERT') {
              dispatch({ type: 'ADD_TRANSACTION', payload: toTransaction(payload.new) });
            }
            break;
          case 'budgets':
            dispatch({ type: 'UPDATE_BUDGET', payload: toBudget(payload.new) });
            break;
          case 'savings_goals':
            dispatch({ type: 'UPDATE_SAVINGS', payload: toSavings(payload.new) });
            break;
        }
      }
    });

    return unsubscribe;
  }, [state.currentUser?.familyId]); // Re-subscribe when family changes

  return (
    <FamilyContext.Provider value={{ state, dispatch: syncDispatch }}>
      {children}
    </FamilyContext.Provider>
  );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useFamilyContext(): FamilyContextValue {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamilyContext must be used within FamilyProvider');
  return ctx;
}

// Convenience hook that also exposes computed selectors
export function useFamily() {
  const { state, dispatch } = useFamilyContext();

  const overdueChores      = getOverdueChores(state);
  const overdueAssignments = getOverdueAssignments(state);
  const upcomingEvents     = getUpcomingEvents(state);
  const budgetAlerts       = getBudgetsNearLimit(state);
  const briefingContext    = buildBriefingContext(state);

  return {
    state,
    dispatch,
    // Derived selectors
    overdueChores,
    overdueAssignments,
    upcomingEvents,
    budgetAlerts,
    briefingContext,
    // Badge count — overdue items + budget alerts
    attentionCount: overdueChores.length + overdueAssignments.length + budgetAlerts.length,
  };
}
