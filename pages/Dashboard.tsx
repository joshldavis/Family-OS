
import React from 'react';
import { 
  User, 
  Assignment, 
  Chore, 
  CalendarEvent, 
  OnboardingState, 
  Status,
  BudgetCategory 
} from '../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight,
  Sparkles,
  Calendar as CalendarIcon,
  GraduationCap,
  ClipboardCheck,
  Wallet
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardProps {
  user: User;
  assignments: Assignment[];
  chores: Chore[];
  events: CalendarEvent[];
  onboarding: OnboardingState;
  budgets: BudgetCategory[];
}

const Dashboard: React.FC<DashboardProps> = ({ user, assignments, chores, events, onboarding, budgets }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const todayAssignments = assignments.filter(a => a.dueDate === todayStr);
  const todayChores = chores.filter(c => c.dueDate === todayStr);
  const todayEvents = events.filter(e => e.start.startsWith(todayStr));

  const overdueAssignments = assignments.filter(a => a.dueDate < todayStr && a.status !== Status.DONE);
  const overdueChores = chores.filter(c => c.dueDate < todayStr && c.status !== Status.DONE);

  const totalBudget = budgets.reduce((acc, b) => acc + b.limit, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
  const budgetProgress = Math.min(100, (totalSpent / totalBudget) * 100);

  const onboardingSteps = [
    { id: 'addedChild', label: 'Add a child student', done: onboarding.addedChild },
    { id: 'addedAssignments', label: 'Add 3 assignments', done: onboarding.addedAssignments >= 3 },
    { id: 'addedChores', label: 'Add 3 chores', done: onboarding.addedChores >= 3 },
    { id: 'addedEvents', label: 'Add 2 calendar events', done: onboarding.addedEvents >= 2 },
  ];

  const progress = Math.round((onboardingSteps.filter(s => s.done).length / onboardingSteps.length) * 100);

  // Helper for safe date display
  const formatDisplayDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Good morning, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 mt-1">Here is what's happening in the Miller household today.</p>
        </div>
        <div className="flex items-center gap-4 bg-white border p-3 rounded-xl notion-shadow">
          <div className="text-center px-4 border-r">
            <p className="text-2xl font-bold text-red-500">{overdueAssignments.length}</p>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Overdue Work</p>
          </div>
          <div className="text-center px-4 border-r">
            <p className="text-2xl font-bold text-amber-500">{overdueChores.length}</p>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Overdue Chores</p>
          </div>
          <div className="text-center px-4">
            <p className="text-2xl font-bold text-indigo-500">{todayEvents.length}</p>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Events Today</p>
          </div>
        </div>
      </header>

      {progress < 100 && (
        <section className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                <Sparkles size={20} className="text-indigo-600" />
                Welcome to Family OS
              </h2>
              <p className="text-indigo-700 text-sm">Finish your setup to unlock full family analytics.</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-indigo-600">{progress}% complete</span>
            </div>
          </div>
          <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden mb-6">
            <div className="bg-indigo-600 h-full transition-all duration-700" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {onboardingSteps.map(step => (
              <div key={step.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                {step.done ? (
                  <CheckCircle2 size={18} className="text-green-500" />
                ) : (
                  <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300"></div>
                )}
                <span className={`text-sm ${step.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Focus */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <Clock size={22} className="text-slate-400" />
                Today's Timeline
              </h3>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>

            <div className="space-y-4">
              {todayEvents.length === 0 && todayAssignments.length === 0 && todayChores.length === 0 ? (
                <div className="bg-white border-2 border-dashed rounded-2xl p-12 text-center">
                  <p className="text-slate-400">Nothing scheduled for today. Enjoy the calm!</p>
                </div>
              ) : (
                <>
                  {todayEvents.map(event => (
                    <div key={event.id} className="flex gap-4 items-start bg-white p-4 rounded-xl border notion-shadow group hover:border-indigo-200 transition-colors">
                      <div className="w-12 text-right">
                        <span className="text-xs font-bold text-indigo-600">{event.start.split('T')[1]}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          <h4 className="font-semibold text-slate-900">{event.title}</h4>
                        </div>
                        {event.location && <p className="text-xs text-slate-500 mt-1">📍 {event.location}</p>}
                      </div>
                      <div className="bg-indigo-50 px-2 py-1 rounded text-[10px] font-bold text-indigo-600 uppercase">Event</div>
                    </div>
                  ))}

                  {todayAssignments.filter(a => a.status !== Status.DONE).map(assignment => (
                    <div key={assignment.id} className="flex gap-4 items-start bg-white p-4 rounded-xl border notion-shadow group hover:border-amber-200 transition-colors">
                      <div className="w-12 text-right">
                        <span className="text-xs font-bold text-amber-600">{assignment.estimatedMinutes}m</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <h4 className="font-semibold text-slate-900">{assignment.title}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{assignment.subject}</p>
                      </div>
                      <div className="bg-amber-50 px-2 py-1 rounded text-[10px] font-bold text-amber-600 uppercase">School</div>
                    </div>
                  ))}

                  {todayChores.filter(c => c.status !== Status.DONE).map(chore => (
                    <div key={chore.id} className="flex gap-4 items-start bg-white p-4 rounded-xl border notion-shadow group hover:border-green-200 transition-colors">
                      <div className="w-12 text-right">
                        <span className="text-xs font-bold text-green-600">Task</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          <h4 className="font-semibold text-slate-900">{chore.title}</h4>
                        </div>
                      </div>
                      <div className="bg-green-50 px-2 py-1 rounded text-[10px] font-bold text-green-600 uppercase">Chore</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          <div className="bg-white border rounded-2xl p-6 notion-shadow">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" />
              Critical Items
            </h4>
            <div className="space-y-4">
              {overdueAssignments.length === 0 && overdueChores.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No overdue items. Great job!</p>
              ) : (
                <>
                  {overdueAssignments.slice(0, 2).map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-red-900 truncate">{a.title}</p>
                        <p className="text-[10px] text-red-600">Due {formatDisplayDate(a.dueDate)}</p>
                      </div>
                      <GraduationCap size={16} className="text-red-400" />
                    </div>
                  ))}
                  {overdueChores.slice(0, 2).map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-amber-900 truncate">{c.title}</p>
                        <p className="text-[10px] text-amber-600">Due {formatDisplayDate(c.dueDate)}</p>
                      </div>
                      <ClipboardCheck size={16} className="text-amber-400" />
                    </div>
                  ))}
                </>
              )}
              <Link to="/schoolwork" className="block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 pt-2 border-t">
                View All Priority Tasks
              </Link>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-6 notion-shadow">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Wallet size={18} className="text-indigo-500" />
              Finance Pulse
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Monthly Budget</span>
                <span className="font-bold text-slate-900">${totalSpent.toLocaleString()} / ${totalBudget.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${budgetProgress > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} 
                  style={{ width: `${budgetProgress}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {budgetProgress > 90 ? '⚠️ You are near your monthly limit.' : 'Healthy spending this month.'}
              </p>
              <Link to="/finance" className="block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 pt-2 border-t mt-4">
                Manage Finances
              </Link>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6 notion-shadow relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-bold mb-2">Weekly Summary</h4>
              <p className="text-slate-400 text-sm mb-4">You've completed 12 tasks this week. Keep the momentum!</p>
              <Link to="/insights" className="inline-flex items-center gap-2 text-sm font-bold text-white hover:translate-x-1 transition-transform">
                Read Family Flow Report <ArrowRight size={16} />
              </Link>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
