
import React, { useState, useMemo } from 'react';
import {
  Heart, Plus, Flame, Target, Trash2, CheckCircle2, Circle,
  Dumbbell, Moon, Droplets, ChevronUp, ChevronDown, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Habit, HabitCheckIn, FamilyGoal, HealthLogEntry, User } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { useFamily } from '../FamilyContext';

// ── helpers ───────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

const last7Days = (): string[] => {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
};

const shortDay = (dateStr: string) =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });

const uid = () => Math.random().toString(36).slice(2, 10);

const HABIT_COLORS = [
  { label: 'Green',  bg: 'bg-green-100',  text: 'text-green-700',  ring: 'ring-green-400' },
  { label: 'Blue',   bg: 'bg-blue-100',   text: 'text-blue-700',   ring: 'ring-blue-400' },
  { label: 'Purple', bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-400' },
  { label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-400' },
  { label: 'Pink',   bg: 'bg-pink-100',   text: 'text-pink-700',   ring: 'ring-pink-400' },
];

const DEFAULT_HABITS: Habit[] = [
  { id: 'h1', familyId: 'family1', name: 'Morning Walk',    emoji: '🚶', color: 'bg-green-100',  createdAt: today() },
  { id: 'h2', familyId: 'family1', name: 'Read 20 Minutes', emoji: '📚', color: 'bg-blue-100',   createdAt: today() },
  { id: 'h3', familyId: 'family1', name: 'No Screens After 9pm', emoji: '📵', color: 'bg-purple-100', createdAt: today() },
];

const DEFAULT_GOALS: FamilyGoal[] = [
  { id: 'g1', familyId: 'family1', title: 'Run a 5K Together', description: 'Train as a family for the spring 5K.', targetValue: 31, currentProgress: 12, unit: 'days trained', createdAt: today() },
  { id: 'g2', familyId: 'family1', title: 'Read 20 Books', description: 'Family reading challenge for the year.', targetValue: 20, currentProgress: 7, unit: 'books', createdAt: today() },
];

// ── Habit streak calculator ───────────────────────────────────────────────────

function calcStreak(habitId: string, userId: string, checkIns: HabitCheckIn[]): number {
  const dates = checkIns
    .filter(c => c.habitId === habitId && c.userId === userId)
    .map(c => c.date)
    .sort()
    .reverse();

  if (dates.length === 0) return 0;

  let streak = 0;
  const ref = new Date();
  for (let i = 0; i < 365; i++) {
    const d = ref.toISOString().slice(0, 10);
    if (dates.includes(d)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    ref.setDate(ref.getDate() - 1);
  }
  return streak;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface WellnessProps {
  users: User[];
  currentUser: User;
}

// ── Section: Habit Tracking ───────────────────────────────────────────────────

const HabitSection: React.FC<{ users: User[]; currentUser: User }> = ({ users, currentUser }) => {
  const [habits, setHabits]     = useLocalStorage<Habit[]>('family_os_habits', DEFAULT_HABITS);
  const [checkIns, setCheckIns] = useLocalStorage<HabitCheckIn[]>('family_os_habit_checkins', []);
  const [showAdd, setShowAdd]   = useState(false);
  const [newName, setNewName]   = useState('');
  const [newEmoji, setNewEmoji] = useState('✅');
  const [colorIdx, setColorIdx] = useState(0);

  const todayStr = today();
  const days = last7Days();

  const isChecked = (habitId: string, date: string) =>
    checkIns.some(c => c.habitId === habitId && c.userId === currentUser.id && c.date === date);

  const toggle = (habitId: string, date: string) => {
    if (isChecked(habitId, date)) {
      setCheckIns(prev => prev.filter(
        c => !(c.habitId === habitId && c.userId === currentUser.id && c.date === date)
      ));
    } else {
      setCheckIns(prev => [...prev, { habitId, userId: currentUser.id, date }]);
    }
  };

  const addHabit = () => {
    if (!newName.trim()) return;
    const color = HABIT_COLORS[colorIdx];
    setHabits(prev => [...prev, {
      id: uid(),
      familyId: 'family1',
      name: newName.trim(),
      emoji: newEmoji,
      color: color.bg,
      createdAt: today(),
    }]);
    setNewName('');
    setNewEmoji('✅');
    setShowAdd(false);
  };

  const deleteHabit = (id: string) =>
    setHabits(prev => prev.filter(h => h.id !== id));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Flame size={20} className="text-orange-500" /> Habit Tracking
        </h2>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <Plus size={16} /> Add Habit
        </button>
      </div>

      {showAdd && (
        <div className="bg-slate-50 border rounded-xl p-4 mb-4 space-y-3">
          <div className="flex gap-2">
            <input
              className="w-14 border rounded-lg px-2 py-1.5 text-center text-lg"
              value={newEmoji}
              onChange={e => setNewEmoji(e.target.value)}
              maxLength={2}
              placeholder="emoji"
            />
            <input
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
              placeholder="Habit name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHabit()}
            />
          </div>
          <div className="flex gap-2">
            {HABIT_COLORS.map((c, i) => (
              <button
                key={c.label}
                onClick={() => setColorIdx(i)}
                className={`w-7 h-7 rounded-full ${c.bg} ${i === colorIdx ? `ring-2 ${c.ring}` : ''}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={addHabit} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left font-medium text-slate-500 pb-2 pr-4 min-w-[160px]">Habit</th>
              {days.map(d => (
                <th key={d} className="text-center font-medium text-slate-400 pb-2 px-1 min-w-[36px]">
                  {shortDay(d)}
                </th>
              ))}
              <th className="text-center font-medium text-slate-500 pb-2 px-2">🔥</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {habits.map(habit => {
              const color = HABIT_COLORS.find(c => c.bg === habit.color) ?? HABIT_COLORS[0];
              const streak = calcStreak(habit.id, currentUser.id, checkIns);
              return (
                <tr key={habit.id}>
                  <td className="py-2 pr-4">
                    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                      {habit.emoji} {habit.name}
                    </span>
                  </td>
                  {days.map(d => (
                    <td key={d} className="text-center py-2 px-1">
                      <button
                        onClick={() => toggle(habit.id, d)}
                        className="w-7 h-7 flex items-center justify-center mx-auto rounded-full hover:bg-slate-100 transition-colors"
                        aria-label={`${isChecked(habit.id, d) ? 'Uncheck' : 'Check'} ${habit.name} for ${d}`}
                      >
                        {isChecked(habit.id, d)
                          ? <CheckCircle2 size={20} className="text-green-500" />
                          : <Circle size={20} className="text-slate-200" />}
                      </button>
                    </td>
                  ))}
                  <td className="text-center py-2 px-2">
                    {streak > 0
                      ? <span className="text-orange-500 font-semibold">{streak}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors"
                      aria-label={`Delete ${habit.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {habits.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm">No habits yet. Add one above!</p>
        )}
      </div>
    </section>
  );
};

// ── Section: Family Goals Board ───────────────────────────────────────────────

const GoalsSection: React.FC = () => {
  const [goals, setGoals] = useLocalStorage<FamilyGoal[]>('family_os_family_goals', DEFAULT_GOALS);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', targetValue: '', unit: '' });
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustAmt, setAdjustAmt] = useState('1');

  const addGoal = () => {
    if (!form.title.trim() || !form.targetValue) return;
    setGoals(prev => [...prev, {
      id: uid(),
      familyId: 'family1',
      title: form.title.trim(),
      description: form.description.trim(),
      targetValue: Number(form.targetValue),
      currentProgress: 0,
      unit: form.unit.trim() || 'units',
      createdAt: today(),
    }]);
    setForm({ title: '', description: '', targetValue: '', unit: '' });
    setShowAdd(false);
  };

  const applyAdjust = (id: string, delta: number) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      const next = Math.max(0, Math.min(g.targetValue, g.currentProgress + delta));
      return {
        ...g,
        currentProgress: next,
        completedAt: next >= g.targetValue ? (g.completedAt ?? today()) : undefined,
      };
    }));
    setAdjustId(null);
  };

  const deleteGoal = (id: string) => setGoals(prev => prev.filter(g => g.id !== id));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target size={20} className="text-indigo-500" /> Family Goals
        </h2>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <Plus size={16} /> New Goal
        </button>
      </div>

      {showAdd && (
        <div className="bg-slate-50 border rounded-xl p-4 mb-4 space-y-3">
          <input
            className="w-full border rounded-lg px-3 py-1.5 text-sm"
            placeholder="Goal title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <input
            className="w-full border rounded-lg px-3 py-1.5 text-sm"
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <div className="flex gap-2">
            <input
              className="w-28 border rounded-lg px-3 py-1.5 text-sm"
              type="number"
              min="1"
              placeholder="Target"
              value={form.targetValue}
              onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
            />
            <input
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
              placeholder="Unit (e.g. books, miles)"
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addGoal} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {goals.map(goal => {
          const pct = goal.targetValue > 0 ? Math.min(100, Math.round((goal.currentProgress / goal.targetValue) * 100)) : 0;
          const done = goal.currentProgress >= goal.targetValue;
          return (
            <div key={goal.id} className={`border rounded-xl p-4 ${done ? 'border-green-300 bg-green-50' : 'bg-white'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    {done && <span title="Completed!">🏆</span>}
                    {goal.title}
                  </p>
                  {goal.description && <p className="text-xs text-slate-400 mt-0.5">{goal.description}</p>}
                </div>
                <button onClick={() => deleteGoal(goal.id)} className="text-slate-300 hover:text-red-400 flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${done ? 'bg-green-500' : 'bg-indigo-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {goal.currentProgress} / {goal.targetValue} {goal.unit}
                </span>
              </div>

              {!done && (
                <div className="mt-3 flex items-center gap-2">
                  {adjustId === goal.id ? (
                    <>
                      <input
                        className="w-16 border rounded-lg px-2 py-1 text-xs text-center"
                        type="number"
                        min="1"
                        value={adjustAmt}
                        onChange={e => setAdjustAmt(e.target.value)}
                      />
                      <button
                        onClick={() => applyAdjust(goal.id, Number(adjustAmt))}
                        className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                      >
                        <ChevronUp size={12} /> Add
                      </button>
                      <button
                        onClick={() => applyAdjust(goal.id, -Number(adjustAmt))}
                        className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300 flex items-center gap-1"
                      >
                        <ChevronDown size={12} /> Sub
                      </button>
                      <button onClick={() => setAdjustId(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setAdjustId(goal.id); setAdjustAmt('1'); }}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      + Log Progress
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {goals.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm">No goals yet. Create one above!</p>
        )}
      </div>
    </section>
  );
};

// ── Section: Health Log ───────────────────────────────────────────────────────

const HealthSection: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [log, setLog] = useLocalStorage<HealthLogEntry[]>('family_os_health_log', []);

  const todayStr = today();
  const days = last7Days();

  const todayEntry = log.find(e => e.userId === currentUser.id && e.date === todayStr);

  const [form, setForm] = useState({
    exerciseMinutes: todayEntry?.exerciseMinutes ?? 0,
    sleepHours:      todayEntry?.sleepHours      ?? 0,
    waterGlasses:    todayEntry?.waterGlasses    ?? 0,
  });

  const saveToday = () => {
    setLog(prev => {
      const without = prev.filter(e => !(e.userId === currentUser.id && e.date === todayStr));
      return [...without, {
        id: todayEntry?.id ?? uid(),
        userId: currentUser.id,
        date: todayStr,
        exerciseMinutes: Number(form.exerciseMinutes),
        sleepHours: Number(form.sleepHours),
        waterGlasses: Number(form.waterGlasses),
      }];
    });
  };

  const chartData = useMemo(() => days.map(d => {
    const entry = log.find(e => e.userId === currentUser.id && e.date === d);
    return {
      day: shortDay(d),
      Exercise: entry?.exerciseMinutes ?? 0,
      Sleep: entry?.sleepHours ?? 0,
      Water: entry?.waterGlasses ?? 0,
    };
  }), [log, currentUser.id, days]);

  return (
    <section>
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Activity size={20} className="text-blue-500" /> Health Log
      </h2>

      {/* Today's entry */}
      <div className="bg-slate-50 border rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-slate-600 mb-3">Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 flex items-center gap-1"><Dumbbell size={12} /> Exercise (min)</span>
            <input
              type="number"
              min="0"
              max="480"
              className="border rounded-lg px-3 py-1.5 text-sm text-center"
              value={form.exerciseMinutes}
              onChange={e => setForm(f => ({ ...f, exerciseMinutes: Number(e.target.value) }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 flex items-center gap-1"><Moon size={12} /> Sleep (hrs)</span>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              className="border rounded-lg px-3 py-1.5 text-sm text-center"
              value={form.sleepHours}
              onChange={e => setForm(f => ({ ...f, sleepHours: Number(e.target.value) }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 flex items-center gap-1"><Droplets size={12} /> Water (glasses)</span>
            <input
              type="number"
              min="0"
              max="30"
              className="border rounded-lg px-3 py-1.5 text-sm text-center"
              value={form.waterGlasses}
              onChange={e => setForm(f => ({ ...f, waterGlasses: Number(e.target.value) }))}
            />
          </label>
        </div>
        <button
          onClick={saveToday}
          className="mt-3 px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          Save Today's Log
        </button>
      </div>

      {/* Weekly chart */}
      <p className="text-sm font-medium text-slate-600 mb-2">7-Day Summary</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Exercise" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Sleep"    fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Water"    fill="#38bdf8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
};

// ── Main Wellness Page ────────────────────────────────────────────────────────

const Wellness: React.FC<WellnessProps> = ({ users, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'habits' | 'goals' | 'health'>('habits');

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'habits', label: '🔥 Habits' },
    { key: 'goals',  label: '🎯 Goals' },
    { key: 'health', label: '💪 Health Log' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
          <Heart size={22} className="text-pink-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Wellness</h1>
          <p className="text-sm text-slate-500">Habits, goals, and daily health tracking</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border rounded-2xl p-6">
        {activeTab === 'habits' && <HabitSection users={users} currentUser={currentUser} />}
        {activeTab === 'goals'  && <GoalsSection />}
        {activeTab === 'health' && <HealthSection currentUser={currentUser} />}
      </div>
    </div>
  );
};

// ── Wrapper: pulls currentUser from FamilyContext if not passed ───────────────

const WellnessWrapper: React.FC<Partial<WellnessProps>> = (props) => {
  const { state } = useFamily();
  const currentUser = props.currentUser ?? state.currentUser;

  if (!currentUser) return null;

  return <Wellness users={props.users ?? []} currentUser={currentUser} />;
};

export default WellnessWrapper;
