
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GraduationCap, 
  ClipboardCheck, 
  Calendar as CalendarIcon, 
  BarChart3, 
  Settings as SettingsIcon,
  Plus,
  LogOut,
  ChevronRight,
  User as UserIcon,
  CheckCircle2,
  Clock,
  Menu,
  X,
  Wallet
} from 'lucide-react';

import { 
  User, 
  Role, 
  Student, 
  Assignment, 
  Chore, 
  CalendarEvent, 
  Status, 
  OnboardingState,
  Transaction,
  BudgetCategory,
  SavingsGoal
} from './types';
import { 
  MOCK_USERS, 
  SEED_STUDENTS, 
  SEED_ASSIGNMENTS, 
  SEED_CHORES, 
  SEED_EVENTS,
  SEED_TRANSACTIONS,
  SEED_BUDGETS,
  SEED_SAVINGS
} from './db';

// Components
import Dashboard from './pages/Dashboard';
import Schoolwork from './pages/Schoolwork';
import Chores from './pages/Chores';
import Calendar from './pages/Calendar';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import Finance from './pages/Finance';
import Auth from './pages/Auth';

const App: React.FC = () => {
  // Global State (Simulating Database)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>(SEED_STUDENTS);
  const [assignments, setAssignments] = useState<Assignment[]>(SEED_ASSIGNMENTS);
  const [chores, setChores] = useState<Chore[]>(SEED_CHORES);
  const [events, setEvents] = useState<CalendarEvent[]>(SEED_EVENTS);
  const [transactions, setTransactions] = useState<Transaction[]>(SEED_TRANSACTIONS);
  const [budgets, setBudgets] = useState<BudgetCategory[]>(SEED_BUDGETS);
  const [savings, setSavings] = useState<SavingsGoal[]>(SEED_SAVINGS);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);

  const [onboarding, setOnboarding] = useState<OnboardingState>({
    addedChild: true,
    addedAssignments: 3,
    addedChores: 3,
    addedEvents: 3,
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Persistence (Simplified)
  useEffect(() => {
    const savedUser = localStorage.getItem('family_os_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    
    const googleStatus = localStorage.getItem('google_linked');
    if (googleStatus === 'true') setIsGoogleLinked(true);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('family_os_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('family_os_user');
  };

  const toggleGoogleLink = (status: boolean) => {
    setIsGoogleLinked(status);
    localStorage.setItem('google_linked', status.toString());
  };

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const location = useLocation();
    const isActive = location.pathname === to;

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
        <span className="text-sm">{label}</span>
      </Link>
    );
  };

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-[#fcfcfc] text-slate-900">
        {/* Mobile Nav Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b flex items-center justify-between px-4 z-40">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">F</div>
            <span>Family OS</span>
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
              <span className="font-bold text-lg tracking-tight">Family OS</span>
            </div>

            <nav className="flex-1 space-y-1">
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="/schoolwork" icon={GraduationCap} label="Schoolwork" />
              <NavItem to="/chores" icon={ClipboardCheck} label="Chores" />
              <NavItem to="/calendar" icon={CalendarIcon} label="Calendar" />
              <NavItem to="/finance" icon={Wallet} label="Finance" />
              <NavItem to="/insights" icon={BarChart3} label="Insights" />
              <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
            </nav>

            <div className="pt-4 border-t space-y-4">
              <div className="px-2 flex items-center gap-3">
                <img src={currentUser.avatar} className="w-8 h-8 rounded-full bg-slate-200" alt="Avatar" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentUser.name}</p>
                  <p className="text-xs text-slate-500 truncate">{currentUser.role}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 w-full text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-sm"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 pt-14 md:pt-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 md:p-8">
            <Routes>
              <Route path="/" element={
                <Dashboard 
                  user={currentUser} 
                  assignments={assignments} 
                  chores={chores} 
                  events={events}
                  onboarding={onboarding}
                  budgets={budgets}
                />
              } />
              <Route path="/schoolwork" element={
                <Schoolwork 
                  students={students} 
                  assignments={assignments} 
                  setAssignments={setAssignments}
                  setStudents={setStudents}
                />
              } />
              <Route path="/chores" element={
                <Chores 
                  chores={chores} 
                  setChores={setChores} 
                  users={MOCK_USERS} 
                />
              } />
              <Route path="/calendar" element={
                <Calendar 
                  events={events} 
                  setEvents={setEvents} 
                  assignments={assignments}
                  isGoogleLinked={isGoogleLinked}
                />
              } />
              <Route path="/finance" element={
                <Finance 
                  transactions={transactions}
                  budgets={budgets}
                  savings={savings}
                  setTransactions={setTransactions}
                  setBudgets={setBudgets}
                  setSavings={setSavings}
                />
              } />
              <Route path="/insights" element={
                <Insights 
                  assignments={assignments} 
                  chores={chores} 
                  events={events} 
                />
              } />
              <Route path="/settings" element={
                <Settings 
                  user={currentUser} 
                  isGoogleLinked={isGoogleLinked}
                  onToggleGoogle={toggleGoogleLink}
                />
              } />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
