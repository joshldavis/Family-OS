
import React, { useState, useEffect, useRef, ComponentType } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

import {
  Role,
  Family,
  User,
  Recipe,
  MealPlanEntry,
  ShoppingList,
  Reward,
  RewardTransaction,
  PinboardNote,
  FamilyDocument,
  OnboardingData,
  FamilyProfile,
  ActionItem,
  BehaviorUpdate,
  Announcement,
  ClassifiedEmail,
  EmailScanConfig,
  EmailScanResult,
  CalendarEvent,
  Assignment,
} from './types';

import {
  MOCK_FAMILY,
  MOCK_USERS,
  SEED_RECIPES,
  SEED_MEAL_PLAN,
  SEED_SHOPPING_LISTS,
  SEED_REWARDS,
  SEED_REWARD_TRANSACTIONS,
  SEED_NOTES,
  SEED_DOCUMENTS,
  generateFamilyData,
} from './db';

// Notifications
import { useNotifications, BriefingContext } from './hooks/useNotifications';

// Module system
import { ModuleProvider, useModules } from './modules/ModuleContext';
import { ICON_MAP } from './modules/iconMap';

// Global state context (Phase 3)
import { FamilyProvider, useFamily } from './FamilyContext';

// Pages
import Dashboard         from './pages/Dashboard';
import Schoolwork        from './pages/Schoolwork';
import Chores            from './pages/Chores';
import Calendar          from './pages/Calendar';
import Insights          from './pages/Insights';
import Settings          from './pages/Settings';
import Finance           from './pages/Finance';
import Auth              from './pages/Auth';
import MealPlanning      from './pages/MealPlanning';
import ShoppingLists     from './pages/ShoppingLists';
import Allowance         from './pages/Allowance';
import Pinboard          from './pages/Pinboard';
import Documents         from './pages/Documents';
import EmailIntelligence from './pages/EmailIntelligence';
import Wellness          from './pages/Wellness';
import Goals            from './pages/Goals';
import Health           from './pages/Health';

// Components
import AIChatPanel from './components/AIChatPanel';
import Onboarding  from './components/Onboarding';

// ── Component map: module id → page component ────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MODULE_COMPONENTS: Record<string, ComponentType<any>> = {
  'dashboard':           Dashboard,
  'schoolwork':          Schoolwork,
  'chores':              Chores,
  'calendar':            Calendar,
  'finance':             Finance,
  'meal-planning':       MealPlanning,
  'shopping':            ShoppingLists,
  'allowance':           Allowance,
  'pinboard':            Pinboard,
  'documents':           Documents,
  'email-intelligence':  EmailIntelligence,
  'wellness':            Wellness,
  'goals':               Goals,
  'health':              Health,
  'insights':            Insights,
  'settings':            Settings,
};

// ── Load persisted family profile ─────────────────────────────────────────────
const loadProfile = (): FamilyProfile | null => {
  try {
    const raw = localStorage.getItem('family_os_profile');
    return raw ? (JSON.parse(raw) as FamilyProfile) : null;
  } catch { return null; }
};

// ── Inner app (needs ModuleProvider + FamilyProvider already in tree) ─────────
const AppInner: React.FC = () => {
  const { isEnabled, getEnabledRoutes, setEnabledModules } = useModules();
  const { state, dispatch, attentionCount } = useFamily();

  // ── Profile / onboarding ─────────────────────────────────────────────
  const [profile, setProfile] = useState<FamilyProfile | null>(() => loadProfile());
  const isOnboarded = profile !== null;

  const activeFamilyUsers: User[] = profile?.users ?? MOCK_USERS;
  const activeFamily: Family      = profile?.family ?? MOCK_FAMILY;

  // ── Extra-module state (not in FamilyContext) ─────────────────────────
  const [recipes,            setRecipes]            = useLocalStorage<Recipe[]>('family_os_recipes',          SEED_RECIPES);
  const [mealPlan,           setMealPlan]           = useLocalStorage<MealPlanEntry[]>('family_os_meal_plan', SEED_MEAL_PLAN);
  const [shoppingLists,      setShoppingLists]      = useLocalStorage<ShoppingList[]>('family_os_shopping',   SEED_SHOPPING_LISTS);
  const [rewards,            setRewards]            = useLocalStorage<Reward[]>('family_os_rewards',          SEED_REWARDS);
  const [rewardTransactions, setRewardTransactions] = useLocalStorage<RewardTransaction[]>('family_os_reward_txns', SEED_REWARD_TRANSACTIONS);
  const [notes,              setNotes]              = useLocalStorage<PinboardNote[]>('family_os_notes',      SEED_NOTES);
  const [documents,          setDocuments]          = useLocalStorage<FamilyDocument[]>('family_os_documents', SEED_DOCUMENTS);

  // ── Email Intelligence state ──────────────────────────────────────────
  const [actionItems,      setActionItems]      = useLocalStorage<ActionItem[]>('family_os_action_items', []);
  const [behaviorUpdates,  setBehaviorUpdates]  = useLocalStorage<BehaviorUpdate[]>('family_os_behavior_updates', []);
  const [announcements,    setAnnouncements]    = useLocalStorage<Announcement[]>('family_os_announcements', []);
  const [classifiedEmails, setClassifiedEmails] = useLocalStorage<ClassifiedEmail[]>('family_os_classified_emails', []);
  const [emailScanConfig,  setEmailScanConfig]  = useLocalStorage<EmailScanConfig>('family_os_email_config', {
    enabled: false,
    schoolDomains: [],
    knownSenders: [],
    includeClassDojo: true,
    includeGoogleClassroom: true,
    lastScanAt: null,
    scanIntervalMinutes: 60,
  });
  const [lastScanResult,   setLastScanResult]   = useLocalStorage<EmailScanResult | null>('family_os_last_scan', null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ── Notifications ─────────────────────────────────────────────────────
  const {
    permission: notifPermission,
    settings: notifSettings,
    updateSettings: updateNotifSettings,
    requestPermission: requestNotifPermission,
    fireMorningBriefing,
    sendTestNotification,
  } = useNotifications();

  // Fire morning briefing once per day when the user is logged in
  const briefingFired = useRef(false);
  useEffect(() => {
    if (!state.currentUser || briefingFired.current) return;
    briefingFired.current = true;

    const today = new Date().toLocaleDateString('en-CA');
    const ctx: BriefingContext = {
      overdueChores: state.chores
        .filter(c => c.status !== 'Done' && c.dueDate < today)
        .map(c => c.title),
      dueTodayAssignments: state.assignments
        .filter(a => a.status !== 'Done' && a.dueDate === today)
        .map(a => a.title),
      todayEvents: state.events
        .filter(e => e.start.startsWith(today))
        .map(e => e.title),
      missingMeals: 0,
    };
    fireMorningBriefing(ctx);
  }, [state.currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Onboarding complete ───────────────────────────────────────────────
  const handleOnboardingComplete = (data: OnboardingData) => {
    const appData = generateFamilyData(data);
    const newProfile: FamilyProfile = {
      onboardingData: data,
      family: appData.family,
      users: appData.users,
    };
    localStorage.setItem('family_os_profile', JSON.stringify(newProfile));
    setProfile(newProfile);

    // Hydrate FamilyContext with generated data
    const parentUser = appData.users.find(u => u.role === Role.PARENT) ?? appData.users[0];
    dispatch({
      type: 'HYDRATE',
      payload: {
        currentUser: parentUser,
        students: appData.students,
        assignments: appData.assignments,
        chores: appData.chores,
        events: appData.events,
        transactions: appData.transactions,
        budgets: appData.budgets,
        savings: appData.savings,
      },
    });

    if (data.emailConfig) {
      setEmailScanConfig(prev => ({
        ...prev,
        enabled: data.emailConfig!.enabled,
        schoolDomains: data.emailConfig!.schoolDomains,
        includeClassDojo: data.emailConfig!.includeClassDojo,
        includeGoogleClassroom: data.emailConfig!.includeGoogleClassroom,
        knownSenders: data.emailConfig!.knownSenders,
      }));
    }

    // Apply module selections from onboarding
    const moduleData = (data as any).modules as Record<string, boolean> | undefined;
    if (moduleData) {
      const enabledIds = Object.entries(moduleData)
        .filter(([, on]) => on)
        .map(([id]) => id);
      setEnabledModules(enabledIds);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────
  const handleResetData = () => {
    [
      'family_os_profile', 'family_os_recipes', 'family_os_meal_plan',
      'family_os_shopping', 'family_os_rewards', 'family_os_reward_txns',
      'family_os_notes', 'family_os_documents', 'family_os_action_items',
      'family_os_behavior_updates', 'family_os_announcements',
      'family_os_classified_emails', 'family_os_email_config', 'family_os_last_scan',
      'family_os_habits', 'family_os_habit_checkins', 'family_os_family_goals', 'family_os_health_log',
      'family_os_active_goals',
      'family_os_medications', 'family_os_appointments', 'family_os_vitals',
      'family_os_notification_settings', 'family_os_last_briefing_date',
      'family_os_module_preferences', 'family_os_v2',
    ].forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  // ── Email handlers ────────────────────────────────────────────────────
  const handleScanComplete = (result: {
    eventsCreated: CalendarEvent[];
    assignmentsCreated: Assignment[];
    actionItems: ActionItem[];
    behaviorUpdates: BehaviorUpdate[];
    announcements: Announcement[];
    classifiedEmails: ClassifiedEmail[];
    scanResult: EmailScanResult;
  }) => {
    result.eventsCreated.forEach(e     => dispatch({ type: 'ADD_EVENT',      payload: e }));
    result.assignmentsCreated.forEach(a => dispatch({ type: 'ADD_ASSIGNMENT', payload: a }));
    if (result.actionItems.length > 0)      setActionItems(p => [...p, ...result.actionItems]);
    if (result.behaviorUpdates.length > 0)  setBehaviorUpdates(p => [...p, ...result.behaviorUpdates]);
    if (result.announcements.length > 0)    setAnnouncements(p => [...p, ...result.announcements]);
    if (result.classifiedEmails.length > 0) setClassifiedEmails(p => [...p, ...result.classifiedEmails]);
    setLastScanResult(result.scanResult);
    setEmailScanConfig(p => ({ ...p, lastScanAt: result.scanResult.scannedAt }));
  };

  const handleActionItemDone = (id: string) =>
    setActionItems(p => p.map(a => a.id === id ? { ...a, status: 'done' as const } : a));

  const handleUpdateEmailConfig = (updates: Partial<EmailScanConfig>) =>
    setEmailScanConfig(p => ({ ...p, ...updates }));

  // ── Gate 1: onboarding ────────────────────────────────────────────────
  if (!isOnboarded) return <Onboarding onComplete={handleOnboardingComplete} />;

  // ── Gate 2: login ─────────────────────────────────────────────────────
  if (!state.currentUser) {
    return (
      <Auth
        onLogin={(user) => dispatch({ type: 'LOGIN', payload: user })}
        users={activeFamilyUsers}
        familyName={activeFamily.name.replace('The ', '').replace(' Family', '')}
      />
    );
  }

  // ── AI context string ─────────────────────────────────────────────────
  const familyContext = `
Family: ${activeFamily.name}
Members: ${activeFamilyUsers.map(u => `${u.name} (${u.role})`).join(', ')}
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Upcoming Assignments: ${state.assignments.filter(a => a.status !== 'Done').map(a => `${a.title} (${a.subject}, due ${a.dueDate})`).join('; ') || 'None'}
Active Chores: ${state.chores.filter(c => c.status !== 'Done').map(c => `${c.title} (${activeFamilyUsers.find(u => u.id === c.assigneeId)?.name || 'unknown'}, due ${c.dueDate})`).join('; ') || 'None'}
Upcoming Events: ${state.events.slice(0, 5).map(e => `${e.title} (${e.start})`).join('; ') || 'None'}
Budget: $${state.budgets.reduce((a, b) => a + b.spent, 0)} of $${state.budgets.reduce((a, b) => a + b.limit, 0)} spent
`.trim();

  // ── Props factory ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPropsForModule = (moduleId: string): Record<string, any> => {
    switch (moduleId) {
      // Core pages — data comes from useFamily() inside the component
      case 'dashboard':
        return { actionItems, lastScanAt: emailScanConfig.lastScanAt };
      case 'schoolwork':
        return {};
      case 'chores':
        return { users: activeFamilyUsers };
      case 'calendar':
        return {};
      case 'finance':
        return {};
      case 'insights':
        return {};

      // Extra-module pages — still receive props from App state
      case 'meal-planning':
        return { recipes, mealPlan, setRecipes, setMealPlan, setShoppingLists };
      case 'shopping':
        return { shoppingLists, setShoppingLists };
      case 'allowance':
        return { users: activeFamilyUsers, rewards, rewardTransactions, setRewards, setRewardTransactions };
      case 'pinboard':
        return { notes, setNotes, users: activeFamilyUsers, currentUser: state.currentUser };
      case 'documents':
        return { documents, setDocuments };
      case 'email-intelligence':
        return {
          actionItems, behaviorUpdates, announcements, classifiedEmails,
          emailScanConfig, lastScanResult, students: state.students,
          events: state.events, assignments: state.assignments,
          familyName: activeFamily.name,
          onActionItemDone: handleActionItemDone,
          onScanComplete: handleScanComplete,
          onUpdateConfig: handleUpdateEmailConfig,
        };
      case 'wellness':
        return { users: activeFamilyUsers, currentUser: state.currentUser };
      case 'goals':
        return { users: activeFamilyUsers, currentUser: state.currentUser };
      case 'health':
        return { users: activeFamilyUsers };
      case 'settings':
        return {
          family: activeFamily,
          familyUsers: activeFamilyUsers,
          onResetData: handleResetData,
          emailScanConfig,
          onUpdateEmailConfig: handleUpdateEmailConfig,
          notifPermission,
          notifSettings,
          onUpdateNotifSettings: updateNotifSettings,
          onRequestNotifPermission: requestNotifPermission,
          onTestNotification: sendTestNotification,
        };
      default:
        return {};
    }
  };

  // ── Nav item ──────────────────────────────────────────────────────────
  const NavItem = ({
    to,
    iconName,
    label,
    badge,
  }: {
    to: string;
    iconName: string;
    label: string;
    badge?: number;
  }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    const Icon = ICON_MAP[iconName] ?? LayoutDashboard;
    return (
      <Link
        to={to}
        onClick={() => setIsSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
          isActive
            ? 'bg-slate-100 text-slate-900 font-medium'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
        }`}
      >
        <Icon size={20} />
        <span className="text-sm flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    );
  };

  // Settings pinned at bottom; all other enabled routes in registry order
  const enabledRoutes  = getEnabledRoutes();
  const navModules     = enabledRoutes.filter(m => m.id !== 'settings');
  const settingsModule = enabledRoutes.find(m => m.id === 'settings');

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-[#fcfcfc] text-slate-900">

        {/* Mobile header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b flex items-center justify-between px-4 z-40">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">F</div>
            <span>{activeFamily.name}</span>
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out notion-shadow
          md:relative md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full p-4">
            <div className="hidden md:flex items-center gap-2 px-2 mb-8">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">F</div>
              <span className="font-bold text-lg tracking-tight">{activeFamily.name}</span>
            </div>

            {/* Dynamic nav */}
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {navModules.map(mod => (
                <NavItem
                  key={mod.id}
                  to={mod.route!.path}
                  iconName={mod.icon}
                  label={mod.route!.label}
                  badge={mod.id === 'dashboard' ? attentionCount : undefined}
                />
              ))}
            </nav>

            <div className="pt-4 border-t space-y-1">
              {settingsModule && (
                <NavItem
                  to={settingsModule.route!.path}
                  iconName={settingsModule.icon}
                  label={settingsModule.route!.label}
                />
              )}
              <div className="px-2 pt-3 flex items-center gap-3">
                <img
                  src={state.currentUser.avatar}
                  className="w-8 h-8 rounded-full bg-slate-200 object-cover"
                  alt="Avatar"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{state.currentUser.name}</p>
                  <p className="text-xs text-slate-500 truncate">{state.currentUser.role}</p>
                </div>
              </div>
              <button
                onClick={() => dispatch({ type: 'LOGOUT' })}
                className="flex items-center gap-3 px-3 py-2 w-full text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-sm"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pt-14 md:pt-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 md:p-8">
            <Routes>
              {enabledRoutes.map(mod => {
                const PageComponent = MODULE_COMPONENTS[mod.id];
                if (!PageComponent) return null;
                return (
                  <Route
                    key={mod.id}
                    path={mod.route!.path}
                    element={<PageComponent {...getPropsForModule(mod.id)} />}
                  />
                );
              })}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>

      <AIChatPanel familyContext={familyContext} />
    </HashRouter>
  );
};

// ── Root — wraps everything in ModuleProvider + FamilyProvider ────────────────
const App: React.FC = () => (
  <ModuleProvider>
    <FamilyProvider>
      <AppInner />
    </FamilyProvider>
  </ModuleProvider>
);

export default App;
