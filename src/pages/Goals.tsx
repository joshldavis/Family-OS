
import React, { useState, useMemo } from 'react';
import {
  ListTodo, Plus, Trash2, Trophy, ChevronUp, ChevronDown,
  Sparkles, BookOpen, Wallet, Smile, Dumbbell, Star,
} from 'lucide-react';
import { ActiveGoal, GoalContribution, GoalTemplate, GoalTemplateCategory, User } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { useFamily } from '../FamilyContext';

// ── helpers ───────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

// ── Preset templates ──────────────────────────────────────────────────────────

const TEMPLATES: GoalTemplate[] = [
  // Health
  { id: 't-h1', title: 'Walk 50 Miles Together',      description: 'Log your walks as a family and hit 50 miles.',       emoji: '🚶', category: 'Health',    targetValue: 50,  unit: 'miles',   allowancePoints: 100 },
  { id: 't-h2', title: 'No Fast Food for 30 Days',    description: 'Cook at home and skip the drive-through.',            emoji: '🥗', category: 'Health',    targetValue: 30,  unit: 'days',    allowancePoints: 75  },
  { id: 't-h3', title: 'Family Bike Ride 10 Times',   description: 'Hit the trail together 10 weekends in a row.',        emoji: '🚴', category: 'Health',    targetValue: 10,  unit: 'rides',   allowancePoints: 50  },
  { id: 't-h4', title: 'Drink More Water',            description: 'Everyone hits 8 glasses a day for 2 weeks.',          emoji: '💧', category: 'Health',    targetValue: 14,  unit: 'days',    allowancePoints: 40  },
  // Learning
  { id: 't-l1', title: 'Read 20 Books This Year',     description: 'Each book counts — picture books too!',               emoji: '📚', category: 'Learning',  targetValue: 20,  unit: 'books',   allowancePoints: 80  },
  { id: 't-l2', title: 'Learn Something New',         description: 'Complete 10 lessons in any topic.',                   emoji: '🧠', category: 'Learning',  targetValue: 10,  unit: 'lessons', allowancePoints: 50  },
  { id: 't-l3', title: 'Board Game Night 8 Times',    description: 'Put the screens down and play together.',             emoji: '🎲', category: 'Learning',  targetValue: 8,   unit: 'nights',  allowancePoints: 40  },
  { id: 't-l4', title: 'Visit 5 Museums',             description: 'Science, art, history — explore them all.',           emoji: '🏛️', category: 'Learning',  targetValue: 5,   unit: 'visits',  allowancePoints: 60  },
  // Finance
  { id: 't-f1', title: 'Save $100 Together',          description: 'Pool contributions toward a family savings goal.',    emoji: '🏦', category: 'Finance',   targetValue: 100, unit: 'dollars', allowancePoints: 0   },
  { id: 't-f2', title: 'No Impulse Buys for a Month', description: '30 days of sticking to the shopping list.',          emoji: '🛒', category: 'Finance',   targetValue: 30,  unit: 'days',    allowancePoints: 50  },
  { id: 't-f3', title: 'Cook 20 Meals at Home',       description: 'Save money and eat better together.',                emoji: '🍳', category: 'Finance',   targetValue: 20,  unit: 'meals',   allowancePoints: 40  },
  // Fun
  { id: 't-u1', title: 'Watch 10 Classic Movies',     description: 'Work through the family movie bucket list.',          emoji: '🎬', category: 'Fun',       targetValue: 10,  unit: 'movies',  allowancePoints: 30  },
  { id: 't-u2', title: 'Visit 5 Local Parks',         description: 'Explore green spaces in your area.',                 emoji: '🌳', category: 'Fun',       targetValue: 5,   unit: 'parks',   allowancePoints: 40  },
  { id: 't-u3', title: 'Try 8 New Restaurants',       description: 'Cuisine from different cultures each time.',          emoji: '🍜', category: 'Fun',       targetValue: 8,   unit: 'places',  allowancePoints: 35  },
  { id: 't-u4', title: 'Take a Weekend Getaway',      description: 'Plan and complete one family trip.',                  emoji: '🏕️', category: 'Fun',       targetValue: 1,   unit: 'trip',    allowancePoints: 100 },
];

const CATEGORY_META: Record<GoalTemplateCategory, { label: string; icon: React.ReactNode; color: string }> = {
  Health:   { label: 'Health',   icon: <Dumbbell  size={14} />, color: 'bg-green-100 text-green-700' },
  Learning: { label: 'Learning', icon: <BookOpen  size={14} />, color: 'bg-blue-100 text-blue-700'   },
  Finance:  { label: 'Finance',  icon: <Wallet    size={14} />, color: 'bg-yellow-100 text-yellow-700' },
  Fun:      { label: 'Fun',      icon: <Smile     size={14} />, color: 'bg-pink-100 text-pink-700'   },
  Custom:   { label: 'Custom',   icon: <Star      size={14} />, color: 'bg-slate-100 text-slate-700' },
};

const CATEGORIES: GoalTemplateCategory[] = ['Health', 'Learning', 'Finance', 'Fun'];

// ── sub-components ────────────────────────────────────────────────────────────

const CategoryBadge: React.FC<{ category: GoalTemplateCategory }> = ({ category }) => {
  const meta = CATEGORY_META[category];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
};

// ── Goals page ────────────────────────────────────────────────────────────────

interface GoalsProps {
  users: User[];
  currentUser: User;
  rewardTransactions?: unknown[];
  setRewardTransactions?: (fn: (prev: unknown[]) => unknown[]) => void;
}

const Goals: React.FC<GoalsProps> = ({ users, currentUser }) => {
  const [activeGoals, setActiveGoals] = useLocalStorage<ActiveGoal[]>('family_os_active_goals', []);
  const [activeTab, setActiveTab]     = useState<'browse' | 'active'>('browse');
  const [filterCat, setFilterCat]     = useState<GoalTemplateCategory | 'All'>('All');
  const [showCustom, setShowCustom]   = useState(false);
  const [adjustId, setAdjustId]       = useState<string | null>(null);
  const [adjustAmt, setAdjustAmt]     = useState('1');
  const [customForm, setCustomForm]   = useState({
    title: '', description: '', emoji: '🎯',
    category: 'Custom' as GoalTemplateCategory,
    targetValue: '', unit: '', allowancePoints: '',
  });

  // Already-adopted template IDs
  const adoptedIds = new Set(activeGoals.map(g => g.templateId).filter(Boolean));

  const filteredTemplates = useMemo(() =>
    TEMPLATES.filter(t => filterCat === 'All' || t.category === filterCat),
    [filterCat]
  );

  const adoptTemplate = (template: GoalTemplate) => {
    setActiveGoals(prev => [...prev, {
      id: uid(),
      familyId: 'family1',
      templateId: template.id,
      title: template.title,
      description: template.description,
      emoji: template.emoji,
      category: template.category,
      targetValue: template.targetValue,
      unit: template.unit,
      allowancePoints: template.allowancePoints,
      contributions: [],
      createdAt: now(),
    }]);
    setActiveTab('active');
  };

  const addCustomGoal = () => {
    if (!customForm.title.trim() || !customForm.targetValue) return;
    setActiveGoals(prev => [...prev, {
      id: uid(),
      familyId: 'family1',
      templateId: null,
      title: customForm.title.trim(),
      description: customForm.description.trim(),
      emoji: customForm.emoji || '🎯',
      category: customForm.category,
      targetValue: Number(customForm.targetValue),
      unit: customForm.unit.trim() || 'units',
      allowancePoints: customForm.allowancePoints ? Number(customForm.allowancePoints) : undefined,
      contributions: [],
      createdAt: now(),
    }]);
    setCustomForm({ title: '', description: '', emoji: '🎯', category: 'Custom', targetValue: '', unit: '', allowancePoints: '' });
    setShowCustom(false);
    setActiveTab('active');
  };

  const logContribution = (goalId: string, delta: number) => {
    setActiveGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      const total = g.contributions.reduce((s, c) => s + c.amount, 0);
      const clamped = Math.max(0, Math.min(g.targetValue - total, delta));
      if (clamped === 0 && delta > 0) return g;
      const contribution: GoalContribution = {
        userId: currentUser.id,
        amount: clamped,
        loggedAt: now(),
      };
      const newTotal = total + clamped;
      return {
        ...g,
        contributions: [...g.contributions, contribution],
        completedAt: newTotal >= g.targetValue ? (g.completedAt ?? today()) : undefined,
      };
    }));
    setAdjustId(null);
  };

  const deleteGoal = (id: string) => setActiveGoals(prev => prev.filter(g => g.id !== id));

  const totalFor = (goal: ActiveGoal) => goal.contributions.reduce((s, c) => s + c.amount, 0);

  const perMember = (goal: ActiveGoal) =>
    users.map(u => ({
      user: u,
      total: goal.contributions.filter(c => c.userId === u.id).reduce((s, c) => s + c.amount, 0),
    })).filter(m => m.total > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
          <ListTodo size={22} className="text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Goal Templates</h1>
          <p className="text-sm text-slate-500">Browse templates or create custom family goals</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {(['browse', 'active'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'browse' ? '✨ Browse Templates' : `🎯 Active Goals (${activeGoals.length})`}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCustom(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          <Plus size={15} /> Custom Goal
        </button>
      </div>

      {/* Custom goal form */}
      {showCustom && (
        <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">Create a Custom Goal</p>
          <div className="flex gap-2">
            <input className="w-14 border rounded-lg px-2 py-1.5 text-center text-lg" value={customForm.emoji} onChange={e => setCustomForm(f => ({ ...f, emoji: e.target.value }))} maxLength={2} />
            <input className="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="Goal title" value={customForm.title} onChange={e => setCustomForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <input className="w-full border rounded-lg px-3 py-1.5 text-sm" placeholder="Description (optional)" value={customForm.description} onChange={e => setCustomForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex gap-2 flex-wrap">
            <select className="border rounded-lg px-3 py-1.5 text-sm" value={customForm.category} onChange={e => setCustomForm(f => ({ ...f, category: e.target.value as GoalTemplateCategory }))}>
              {(['Health', 'Learning', 'Finance', 'Fun', 'Custom'] as GoalTemplateCategory[]).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input className="w-24 border rounded-lg px-3 py-1.5 text-sm" type="number" min="1" placeholder="Target" value={customForm.targetValue} onChange={e => setCustomForm(f => ({ ...f, targetValue: e.target.value }))} />
            <input className="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="Unit (e.g. miles, books)" value={customForm.unit} onChange={e => setCustomForm(f => ({ ...f, unit: e.target.value }))} />
            <input className="w-28 border rounded-lg px-3 py-1.5 text-sm" type="number" min="0" placeholder="Points reward" value={customForm.allowancePoints} onChange={e => setCustomForm(f => ({ ...f, allowancePoints: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={addCustomGoal} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Save Goal</button>
            <button onClick={() => setShowCustom(false)} className="px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Browse tab */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {(['All', ...CATEGORIES] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filterCat === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredTemplates.map(template => {
              const adopted = adoptedIds.has(template.id);
              return (
                <div key={template.id} className={`border rounded-xl p-4 flex flex-col gap-3 ${adopted ? 'opacity-60 bg-slate-50' : 'bg-white hover:border-indigo-200 transition-colors'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{template.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{template.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={template.category} />
                      <span className="text-xs text-slate-400">{template.targetValue} {template.unit}</span>
                      {template.allowancePoints ? (
                        <span className="text-xs text-amber-600 flex items-center gap-0.5">
                          <Trophy size={11} /> {template.allowancePoints} pts
                        </span>
                      ) : null}
                    </div>
                    <button
                      onClick={() => !adopted && adoptTemplate(template)}
                      disabled={adopted}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                        adopted
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {adopted ? 'Added ✓' : '+ Adopt'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeGoals.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Sparkles size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No active goals yet.</p>
              <button onClick={() => setActiveTab('browse')} className="mt-2 text-indigo-600 text-sm hover:underline">Browse templates →</button>
            </div>
          )}
          {activeGoals.map(goal => {
            const total = totalFor(goal);
            const pct   = goal.targetValue > 0 ? Math.min(100, Math.round((total / goal.targetValue) * 100)) : 0;
            const done  = total >= goal.targetValue;
            const members = perMember(goal);

            return (
              <div key={goal.id} className={`border rounded-xl p-4 ${done ? 'border-green-300 bg-green-50' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{goal.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{done && '🏆 '}{goal.title}</p>
                        <CategoryBadge category={goal.category} />
                        {goal.allowancePoints ? (
                          <span className="text-xs text-amber-600 flex items-center gap-0.5">
                            <Trophy size={11} /> {goal.allowancePoints} pts on completion
                          </span>
                        ) : null}
                      </div>
                      {goal.description && <p className="text-xs text-slate-400 mt-0.5">{goal.description}</p>}
                    </div>
                  </div>
                  <button onClick={() => deleteGoal(goal.id)} className="text-slate-300 hover:text-red-400 flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${done ? 'bg-green-500' : 'bg-indigo-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap font-medium">
                    {total} / {goal.targetValue} {goal.unit}
                  </span>
                </div>

                {/* Per-member breakdown */}
                {members.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {members.map(({ user, total: mt }) => (
                      <div key={user.id} className="flex items-center gap-1.5 bg-slate-50 border rounded-lg px-2 py-1">
                        <img src={user.avatar} alt={user.name} className="w-5 h-5 rounded-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="text-xs text-slate-600">{user.name.split(' ')[0]}</span>
                        <span className="text-xs font-semibold text-indigo-600">{mt}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Log progress */}
                {!done && (
                  <div className="flex items-center gap-2">
                    {adjustId === goal.id ? (
                      <>
                        <input
                          className="w-16 border rounded-lg px-2 py-1 text-xs text-center"
                          type="number" min="1"
                          value={adjustAmt}
                          onChange={e => setAdjustAmt(e.target.value)}
                        />
                        <button onClick={() => logContribution(goal.id, Number(adjustAmt))} className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 flex items-center gap-1">
                          <ChevronUp size={12} /> Log
                        </button>
                        <button onClick={() => setAdjustId(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setAdjustId(goal.id); setAdjustAmt('1'); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <ChevronUp size={12} /> Log My Progress
                      </button>
                    )}
                  </div>
                )}

                {done && goal.allowancePoints && (
                  <p className="text-xs text-green-700 font-medium flex items-center gap-1 mt-1">
                    <Trophy size={12} /> Goal complete! {goal.allowancePoints} points earned.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Wrapper ───────────────────────────────────────────────────────────────────

const GoalsWrapper: React.FC<Partial<GoalsProps>> = (props) => {
  const { state } = useFamily();
  const currentUser = props.currentUser ?? state.currentUser;
  if (!currentUser) return null;
  return <Goals users={props.users ?? []} currentUser={currentUser} />;
};

export default GoalsWrapper;
