
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ListTodo, Plus, Trash2, Trophy, ChevronUp,
  Sparkles, BookOpen, Wallet, Smile, Dumbbell, Star, Medal, Zap,
} from 'lucide-react';
import { ActiveGoal, GoalContribution, GoalTemplate, GoalTemplateCategory, User, RewardTransaction } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { useFamily } from '../FamilyContext';

// ── helpers ───────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

// ── Preset templates ──────────────────────────────────────────────────────────

const TEMPLATES: GoalTemplate[] = [
  // Health
  { id: 't-h1', title: 'Walk 50 Miles Together',    description: 'Log your walks as a family and hit 50 miles.',      emoji: '🚶', category: 'Health',   targetValue: 50,  unit: 'miles',   allowancePoints: 100 },
  { id: 't-h2', title: 'No Fast Food for 30 Days',  description: 'Cook at home and skip the drive-through.',           emoji: '🥗', category: 'Health',   targetValue: 30,  unit: 'days',    allowancePoints: 75  },
  { id: 't-h3', title: 'Family Bike Ride 10 Times', description: 'Hit the trail together 10 weekends in a row.',       emoji: '🚴', category: 'Health',   targetValue: 10,  unit: 'rides',   allowancePoints: 50  },
  { id: 't-h4', title: 'Drink More Water',          description: 'Everyone hits 8 glasses a day for 2 weeks.',         emoji: '💧', category: 'Health',   targetValue: 14,  unit: 'days',    allowancePoints: 40  },
  // Learning
  { id: 't-l1', title: 'Read 20 Books This Year',   description: 'Each book counts — picture books too!',              emoji: '📚', category: 'Learning', targetValue: 20,  unit: 'books',   allowancePoints: 80  },
  { id: 't-l2', title: 'Learn Something New',       description: 'Complete 10 lessons in any topic.',                  emoji: '🧠', category: 'Learning', targetValue: 10,  unit: 'lessons', allowancePoints: 50  },
  { id: 't-l3', title: 'Board Game Night 8 Times',  description: 'Put the screens down and play together.',            emoji: '🎲', category: 'Learning', targetValue: 8,   unit: 'nights',  allowancePoints: 40  },
  { id: 't-l4', title: 'Visit 5 Museums',           description: 'Science, art, history — explore them all.',          emoji: '🏛️', category: 'Learning', targetValue: 5,   unit: 'visits',  allowancePoints: 60  },
  // Finance
  { id: 't-f1', title: 'Save $100 Together',        description: 'Pool contributions toward a family savings goal.',   emoji: '🏦', category: 'Finance',  targetValue: 100, unit: 'dollars', allowancePoints: 0   },
  { id: 't-f2', title: 'No Impulse Buys for a Month',description: '30 days of sticking to the shopping list.',         emoji: '🛒', category: 'Finance',  targetValue: 30,  unit: 'days',    allowancePoints: 50  },
  { id: 't-f3', title: 'Cook 20 Meals at Home',     description: 'Save money and eat better together.',                emoji: '🍳', category: 'Finance',  targetValue: 20,  unit: 'meals',   allowancePoints: 40  },
  // Fun
  { id: 't-u1', title: 'Watch 10 Classic Movies',   description: 'Work through the family movie bucket list.',         emoji: '🎬', category: 'Fun',      targetValue: 10,  unit: 'movies',  allowancePoints: 30  },
  { id: 't-u2', title: 'Visit 5 Local Parks',       description: 'Explore green spaces in your area.',                emoji: '🌳', category: 'Fun',      targetValue: 5,   unit: 'parks',   allowancePoints: 40  },
  { id: 't-u3', title: 'Try 8 New Restaurants',     description: 'Cuisine from different cultures each time.',         emoji: '🍜', category: 'Fun',      targetValue: 8,   unit: 'places',  allowancePoints: 35  },
  { id: 't-u4', title: 'Take a Weekend Getaway',    description: 'Plan and complete one family trip.',                 emoji: '🏕️', category: 'Fun',      targetValue: 1,   unit: 'trip',    allowancePoints: 100 },
];

const CATEGORY_META: Record<GoalTemplateCategory, { label: string; icon: React.ReactNode; color: string; gradient: string; textColor: string }> = {
  Health:   { label: 'Health',   icon: <Dumbbell size={13} />, color: 'bg-emerald-100 text-emerald-700', gradient: 'from-emerald-400 to-teal-500',    textColor: 'text-emerald-600' },
  Learning: { label: 'Learning', icon: <BookOpen size={13} />, color: 'bg-blue-100 text-blue-700',       gradient: 'from-blue-400 to-indigo-500',      textColor: 'text-blue-600'    },
  Finance:  { label: 'Finance',  icon: <Wallet   size={13} />, color: 'bg-amber-100 text-amber-700',     gradient: 'from-amber-400 to-orange-500',     textColor: 'text-amber-600'   },
  Fun:      { label: 'Fun',      icon: <Smile    size={13} />, color: 'bg-pink-100 text-pink-700',       gradient: 'from-pink-400 to-rose-500',        textColor: 'text-pink-600'    },
  Custom:   { label: 'Custom',   icon: <Star     size={13} />, color: 'bg-slate-100 text-slate-700',     gradient: 'from-slate-400 to-slate-500',      textColor: 'text-slate-600'   },
};

const CATEGORIES: GoalTemplateCategory[] = ['Health', 'Learning', 'Finance', 'Fun'];

// ── Confetti ──────────────────────────────────────────────────────────────────

const Confetti: React.FC = () => {
  const colors = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#f97316'];
  const pieces = Array.from({ length: 48 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.8}s`,
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '-12px',
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
            animation: `confettiFall 2.2s ease-in ${p.delay} forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

// ── Celebration modal ─────────────────────────────────────────────────────────

interface CelebrationProps {
  goal: ActiveGoal;
  onClose: () => void;
}

const CelebrationModal: React.FC<CelebrationProps> = ({ goal, onClose }) => (
  <>
    <Confetti />
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
        style={{ animation: 'celebrationPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-6xl mb-3">{goal.emoji}</div>
        <div className="text-4xl mb-2">🏆</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Goal Complete!</h2>
        <p className="text-slate-600 text-sm mb-4">
          <span className="font-semibold">{goal.title}</span> — your family crushed it!
        </p>
        {goal.allowancePoints ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5">
            <p className="text-amber-700 font-bold text-lg flex items-center justify-center gap-2">
              <Trophy size={20} /> +{goal.allowancePoints} points earned!
            </p>
            <p className="text-amber-500 text-xs mt-0.5">Added to everyone who contributed</p>
          </div>
        ) : null}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-bold text-white text-sm transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
        >
          Keep Going! 🚀
        </button>
      </div>
      <style>{`
        @keyframes celebrationPop {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  </>
);

// ── Category badge ────────────────────────────────────────────────────────────

const CategoryBadge: React.FC<{ category: GoalTemplateCategory }> = ({ category }) => {
  const meta = CATEGORY_META[category];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

interface GoalsProps {
  users: User[];
  currentUser: User;
  rewardTransactions?: RewardTransaction[];
  setRewardTransactions?: (fn: (prev: RewardTransaction[]) => RewardTransaction[]) => void;
}

const Goals: React.FC<GoalsProps> = ({ users, currentUser, setRewardTransactions }) => {
  const [activeGoals, setActiveGoals] = useLocalStorage<ActiveGoal[]>('family_os_active_goals', []);
  const [activeTab, setActiveTab]     = useState<'browse' | 'active' | 'leaderboard'>('browse');
  const [filterCat, setFilterCat]     = useState<GoalTemplateCategory | 'All'>('All');
  const [showCustom, setShowCustom]   = useState(false);
  const [adjustId, setAdjustId]       = useState<string | null>(null);
  const [adjustAmt, setAdjustAmt]     = useState('1');
  const [celebration, setCelebration] = useState<ActiveGoal | null>(null);
  const awardedRef = useRef<Set<string>>(new Set()); // track which goals we've already awarded

  const [customForm, setCustomForm] = useState({
    title: '', description: '', emoji: '🎯',
    category: 'Custom' as GoalTemplateCategory,
    targetValue: '', unit: '', allowancePoints: '',
  });

  // Pre-mark already-completed goals so we don't re-celebrate on mount
  useEffect(() => {
    activeGoals.forEach(g => {
      const total = g.contributions.reduce((s, c) => s + c.amount, 0);
      if (total >= g.targetValue) awardedRef.current.add(g.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adoptedIds = new Set(activeGoals.map(g => g.templateId).filter(Boolean));

  const filteredTemplates = useMemo(() =>
    TEMPLATES.filter(t => filterCat === 'All' || t.category === filterCat),
    [filterCat]
  );

  const adoptTemplate = (template: GoalTemplate) => {
    setActiveGoals(prev => [...prev, {
      id: uid(), familyId: 'family1',
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
      id: uid(), familyId: 'family1', templateId: null,
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
      const contribution: GoalContribution = { userId: currentUser.id, amount: clamped, loggedAt: now() };
      const newTotal = total + clamped;
      const justCompleted = newTotal >= g.targetValue && !awardedRef.current.has(g.id);

      if (justCompleted) {
        awardedRef.current.add(g.id);
        // Award points to all contributors (+ current user if not yet contributed)
        if (g.allowancePoints && setRewardTransactions) {
          const contributors = new Set([
            ...g.contributions.map(c => c.userId),
            currentUser.id,
          ]);
          const txns: RewardTransaction[] = [...contributors].map(uid => ({
            id: `goal-${g.id}-${uid}-${Date.now()}`,
            familyId: 'family1',
            userId: uid,
            type: 'earned' as const,
            points: g.allowancePoints!,
            description: `🏆 Goal complete: ${g.title}`,
            date: today(),
          }));
          setRewardTransactions(prev => [...prev, ...txns]);
        }
        // Trigger celebration after state update
        setTimeout(() => setCelebration({ ...g, contributions: [...g.contributions, contribution], completedAt: today() }), 100);
      }

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

  // ── Leaderboard data ─────────────────────────────────────────────────────
  const leaderboard = useMemo(() => {
    const scoreMap: Record<string, { user: User; points: number; contributions: number; goalsCompleted: number }> = {};
    users.forEach(u => { scoreMap[u.id] = { user: u, points: 0, contributions: 0, goalsCompleted: 0 }; });

    activeGoals.forEach(g => {
      const total = totalFor(g);
      const done = total >= g.targetValue;
      g.contributions.forEach(c => {
        if (scoreMap[c.userId]) {
          scoreMap[c.userId].contributions += c.amount;
          if (done && g.allowancePoints) scoreMap[c.userId].points += g.allowancePoints;
        }
      });
      if (done) {
        const contributors = new Set(g.contributions.map(c => c.userId));
        contributors.forEach(uid => { if (scoreMap[uid]) scoreMap[uid].goalsCompleted++; });
      }
    });

    return Object.values(scoreMap)
      .filter(e => e.contributions > 0 || e.goalsCompleted > 0)
      .sort((a, b) => b.points - a.points || b.goalsCompleted - a.goalsCompleted);
  }, [activeGoals, users]);

  const perMember = (goal: ActiveGoal) =>
    users.map(u => ({
      user: u,
      total: goal.contributions.filter(c => c.userId === u.id).reduce((s, c) => s + c.amount, 0),
    })).filter(m => m.total > 0);

  const inProgress = activeGoals.filter(g => totalFor(g) < g.targetValue);
  const completed  = activeGoals.filter(g => totalFor(g) >= g.targetValue);

  return (
    <div className="space-y-6">
      {/* Celebration modal */}
      {celebration && <CelebrationModal goal={celebration} onClose={() => setCelebration(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
          <ListTodo size={22} className="text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Goal Marketplace</h1>
          <p className="text-sm text-slate-500">Shared family challenges with points & rewards</p>
        </div>
      </div>

      {/* Stats strip */}
      {activeGoals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active', value: inProgress.length,  icon: <Zap size={16} className="text-indigo-500" />,  bg: 'bg-indigo-50' },
            { label: 'Completed', value: completed.length, icon: <Trophy size={16} className="text-amber-500" />, bg: 'bg-amber-50'  },
            { label: 'Earning', value: activeGoals.reduce((s, g) => s + (g.allowancePoints ?? 0), 0) + ' pts', icon: <Star size={16} className="text-pink-500" />, bg: 'bg-pink-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 flex items-center gap-3`}>
              {s.icon}
              <div>
                <p className="text-lg font-bold text-slate-900 leading-none">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {([
            { key: 'browse',      label: '✨ Browse'                         },
            { key: 'active',      label: `🎯 Active (${inProgress.length})`  },
            { key: 'leaderboard', label: '🏅 Leaderboard'                    },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
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
              {(['Health','Learning','Finance','Fun','Custom'] as GoalTemplateCategory[]).map(c => <option key={c} value={c}>{c}</option>)}
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

      {/* ── BROWSE TAB ── */}
      {activeTab === 'browse' && (
        <div className="space-y-5">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredTemplates.map(template => {
              const adopted = adoptedIds.has(template.id);
              const meta = CATEGORY_META[template.category];
              return (
                <div
                  key={template.id}
                  className={`rounded-2xl overflow-hidden border transition-all ${
                    adopted ? 'opacity-60' : 'hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  {/* Coloured header strip */}
                  <div className={`bg-gradient-to-r ${meta.gradient} p-4 flex items-center gap-3`}>
                    <span className="text-3xl drop-shadow">{template.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm leading-tight">{template.title}</p>
                      <CategoryBadge category={template.category} />
                    </div>
                    {template.allowancePoints ? (
                      <div className="flex-shrink-0 bg-white/20 backdrop-blur-sm rounded-xl px-2.5 py-1.5 text-center">
                        <p className="text-white font-bold text-sm leading-none">{template.allowancePoints}</p>
                        <p className="text-white/80 text-[9px] uppercase tracking-wide">pts</p>
                      </div>
                    ) : null}
                  </div>
                  {/* Body */}
                  <div className="bg-white p-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">{template.description}</p>
                      <p className="text-xs text-slate-400 mt-1">Target: <span className="font-semibold text-slate-600">{template.targetValue} {template.unit}</span></p>
                    </div>
                    <button
                      onClick={() => !adopted && adoptTemplate(template)}
                      disabled={adopted}
                      className={`flex-shrink-0 text-xs px-4 py-2 rounded-xl font-semibold transition-all ${
                        adopted
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'
                      }`}
                    >
                      {adopted ? '✓ Added' : 'Adopt'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ACTIVE TAB ── */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {inProgress.length === 0 && completed.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Sparkles size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No active goals yet.</p>
              <button onClick={() => setActiveTab('browse')} className="mt-2 text-indigo-600 text-sm hover:underline">Browse templates →</button>
            </div>
          )}

          {inProgress.length > 0 && (
            <div className="space-y-3">
              {inProgress.map(goal => {
                const total = totalFor(goal);
                const pct = Math.min(100, Math.round((total / goal.targetValue) * 100));
                const members = perMember(goal);
                return (
                  <div key={goal.id} className="bg-white border rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{goal.emoji}</span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{goal.title}</p>
                            <CategoryBadge category={goal.category} />
                            {goal.allowancePoints ? (
                              <span className="text-xs text-amber-600 flex items-center gap-0.5">
                                <Trophy size={11} /> {goal.allowancePoints} pts
                              </span>
                            ) : null}
                          </div>
                          {goal.description && <p className="text-xs text-slate-400 mt-0.5">{goal.description}</p>}
                        </div>
                      </div>
                      <button onClick={() => deleteGoal(goal.id)} className="text-slate-300 hover:text-red-400 flex-shrink-0 mt-0.5">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>{pct}% complete</span>
                        <span className="font-medium">{total} / {goal.targetValue} {goal.unit}</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Per-member */}
                    {members.length > 0 && (
                      <div className="flex flex-wrap gap-2">
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
                    <div className="flex items-center gap-2">
                      {adjustId === goal.id ? (
                        <>
                          <input
                            className="w-16 border rounded-lg px-2 py-1 text-xs text-center"
                            type="number" min="1"
                            value={adjustAmt}
                            onChange={e => setAdjustAmt(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => logContribution(goal.id, Number(adjustAmt))} className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 flex items-center gap-1">
                            <ChevronUp size={12} /> Log
                          </button>
                          <button onClick={() => setAdjustId(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setAdjustId(goal.id); setAdjustAmt('1'); }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                        >
                          <ChevronUp size={12} /> Log My Progress
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed section */}
          {completed.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-2">Completed 🏆</p>
              <div className="space-y-2">
                {completed.map(goal => {
                  const members = perMember(goal);
                  return (
                    <div key={goal.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{goal.emoji}</span>
                          <div>
                            <p className="font-semibold text-sm text-green-900">🏆 {goal.title}</p>
                            <p className="text-xs text-green-600">
                              Completed {goal.completedAt}
                              {goal.allowancePoints ? ` · +${goal.allowancePoints} pts earned` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {members.slice(0, 3).map(({ user }) => (
                            <img key={user.id} src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full border-2 border-white object-cover -ml-1" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ))}
                          <button onClick={() => deleteGoal(goal.id)} className="ml-2 text-slate-300 hover:text-red-400">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD TAB ── */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          {leaderboard.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Medal size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No contributions yet — log progress on a goal to appear here!</p>
              <button onClick={() => setActiveTab('active')} className="mt-2 text-indigo-600 text-sm hover:underline">Go to Active Goals →</button>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                const medal = medals[idx] ?? `#${idx + 1}`;
                return (
                  <div
                    key={entry.user.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border ${idx === 0 ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}
                  >
                    <span className="text-2xl w-8 text-center">{medal}</span>
                    <img src={entry.user.avatar} alt={entry.user.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{entry.user.name}</p>
                      <p className="text-xs text-slate-500">
                        {entry.goalsCompleted > 0 ? `${entry.goalsCompleted} goal${entry.goalsCompleted > 1 ? 's' : ''} completed · ` : ''}
                        {entry.contributions} total contributions
                      </p>
                    </div>
                    {entry.points > 0 && (
                      <div className="text-right">
                        <p className="font-bold text-amber-600 text-lg leading-none">{entry.points}</p>
                        <p className="text-xs text-slate-400">pts earned</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* All goals summary */}
          {activeGoals.length > 0 && (
            <div className="bg-slate-50 border rounded-2xl p-4 mt-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Family Progress</p>
              <div className="space-y-3">
                {activeGoals.map(goal => {
                  const total = totalFor(goal);
                  const pct = Math.min(100, Math.round((total / goal.targetValue) * 100));
                  const done = total >= goal.targetValue;
                  return (
                    <div key={goal.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">{goal.emoji} {goal.title}</span>
                        <span className={done ? 'text-green-600 font-bold' : 'text-slate-400'}>{done ? '✓ Done' : `${pct}%`}</span>
                      </div>
                      <div className="bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full transition-all duration-700 ${done ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
  return (
    <Goals
      users={props.users ?? []}
      currentUser={currentUser}
      rewardTransactions={props.rewardTransactions}
      setRewardTransactions={props.setRewardTransactions}
    />
  );
};

export default GoalsWrapper;
