
import React, { useState } from 'react';
import { User, Role, Reward, RewardTransaction } from '../types';
import { Trophy, Plus, X, Star, Gift, History, Zap, Trash2, TrendingUp, ExternalLink } from 'lucide-react';

interface AllowanceProps {
  users: User[];
  rewards: Reward[];
  rewardTransactions: RewardTransaction[];
  setRewards: React.Dispatch<React.SetStateAction<Reward[]>>;
  setRewardTransactions: React.Dispatch<React.SetStateAction<RewardTransaction[]>>;
}

const Allowance: React.FC<AllowanceProps> = ({
  users, rewards, rewardTransactions, setRewards, setRewardTransactions,
}) => {
  const children = users.filter(u => u.role === Role.CHILD);
  const [selectedChild, setSelectedChild] = useState(children[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');
  const [addRewardOpen, setAddRewardOpen] = useState(false);
  const [rewardForm, setRewardForm] = useState({ name: '', description: '', pointCost: '', emoji: '🎁' });
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const getBalance = (userId: string) =>
    rewardTransactions.filter(t => t.userId === userId).reduce((acc, t) => acc + t.points, 0);

  const getTxns = (userId: string) =>
    rewardTransactions.filter(t => t.userId === userId).slice().reverse();

  const getStreak = (userId: string) => {
    const earnedDates = [...new Set(
      rewardTransactions.filter(t => t.userId === userId && t.type === 'earned').map(t => t.date)
    )].sort().reverse();
    if (!earnedDates.length) return 0;
    let streak = 1;
    for (let i = 0; i < earnedDates.length - 1; i++) {
      const a = new Date(earnedDates[i]);
      const b = new Date(earnedDates[i + 1]);
      const diff = (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  };

  const handleRedeem = (reward: Reward) => {
    if (getBalance(selectedChild) < reward.pointCost) return;
    setRedeemingId(reward.id);
    setTimeout(() => {
      setRewardTransactions(prev => [...prev, {
        id: `rt-${Date.now()}`,
        familyId: 'fam-1',
        userId: selectedChild,
        type: 'redeemed',
        points: -reward.pointCost,
        description: `Redeemed: ${reward.name}`,
        date: new Date().toISOString().split('T')[0],
        rewardId: reward.id,
      }]);
      setRedeemingId(null);
    }, 600);
  };

  const handleAddReward = () => {
    if (!rewardForm.name || !rewardForm.pointCost) return;
    setRewards(prev => [...prev, {
      id: `rw-${Date.now()}`,
      familyId: 'fam-1',
      name: rewardForm.name,
      description: rewardForm.description,
      pointCost: parseInt(rewardForm.pointCost),
      emoji: rewardForm.emoji,
    }]);
    setAddRewardOpen(false);
    setRewardForm({ name: '', description: '', pointCost: '', emoji: '🎁' });
  };

  const child = children.find(c => c.id === selectedChild);
  const balance = getBalance(selectedChild);
  const streak = getStreak(selectedChild);
  const allTimeEarned = rewardTransactions.filter(t => t.userId === selectedChild && t.type === 'earned').reduce((a, t) => a + t.points, 0);

  // Points → dollar conversion (100 pts = $1)
  const POINTS_PER_DOLLAR = 100;
  const allowanceDollars = (balance / POINTS_PER_DOLLAR).toFixed(2);
  const allowanceNote = encodeURIComponent(`Weekly allowance for ${child?.name?.split(' ')[0] ?? 'child'} 🏆`);

  const openVenmo = () => window.open(`venmo://paycharge?txn=pay&amount=${allowanceDollars}&note=${allowanceNote}`, '_blank');
  const openZelle = () => window.open(`zelle://pay?amount=${allowanceDollars}&memo=${allowanceNote}`, '_blank');

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Allowance & Rewards</h1>
          <p className="text-slate-500 mt-1">Track points earned from chores and redeem for rewards.</p>
        </div>
        <button
          onClick={() => setAddRewardOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm text-sm"
        >
          <Plus size={18} /> Add Reward
        </button>
      </header>

      {/* Child selector */}
      <div className="flex gap-3 flex-wrap">
        {children.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedChild(c.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
              selectedChild === c.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-white hover:border-indigo-200 notion-shadow'
            }`}
          >
            <img src={c.avatar} className="w-9 h-9 rounded-full" alt={c.name} />
            <div className="text-left">
              <p className={`font-bold text-sm ${selectedChild === c.id ? 'text-indigo-900' : 'text-slate-900'}`}>{c.name.split(' ')[0]}</p>
              <p className={`text-xs font-bold ${selectedChild === c.id ? 'text-indigo-600' : 'text-slate-400'}`}>{getBalance(c.id)} pts</p>
            </div>
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Point Balance</p>
            <p className="text-5xl font-bold mb-1">{balance}</p>
            <p className="text-indigo-200 text-sm">≈ ${allowanceDollars} allowance</p>
            {balance > 0 && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={openVenmo}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink size={12} /> Pay via Venmo
                </button>
                <button
                  onClick={openZelle}
                  className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink size={12} /> Pay via Zelle
                </button>
              </div>
            )}
          </div>
          <Trophy size={64} className="absolute right-4 bottom-4 text-white/10" />
        </div>
        <div className="bg-white border rounded-2xl p-6 notion-shadow">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Day Streak</p>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-bold text-amber-500">{streak}</p>
            <p className="text-slate-400 mb-1">days</p>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Zap size={12} className="text-amber-400" /> Consecutive days with completed chores
          </p>
        </div>
        <div className="bg-white border rounded-2xl p-6 notion-shadow">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">All-Time Earned</p>
          <p className="text-4xl font-bold text-green-600">{allTimeEarned}</p>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp size={12} className="text-green-400" /> Total points ever earned
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'catalog', label: 'Reward Catalog', icon: Gift },
          { id: 'history', label: 'Point History', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-colors relative ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <tab.icon size={16} /> {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
        ))}
      </div>

      {/* Reward Catalog */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map(reward => {
            const canAfford = balance >= reward.pointCost;
            const isRedeeming = redeemingId === reward.id;
            return (
              <div key={reward.id} className={`group bg-white border rounded-2xl p-6 notion-shadow transition-all ${canAfford ? 'hover:border-indigo-200' : 'opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">{reward.emoji}</div>
                  <button
                    onClick={() => setRewards(prev => prev.filter(r => r.id !== reward.id))}
                    className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{reward.name}</h3>
                <p className="text-xs text-slate-500 mb-4">{reward.description}</p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-sm font-bold text-indigo-600">
                    <Star size={14} className="fill-indigo-600" /> {reward.pointCost} pts
                  </span>
                  <button
                    onClick={() => handleRedeem(reward)}
                    disabled={!canAfford || !!isRedeeming}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      canAfford ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    } ${isRedeeming ? 'scale-95 opacity-80' : ''}`}
                  >
                    {isRedeeming ? '🎉 Redeemed!' : canAfford ? 'Redeem' : 'Not Enough Points'}
                  </button>
                </div>
              </div>
            );
          })}
          <button
            onClick={() => setAddRewardOpen(true)}
            className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all group min-h-[160px]"
          >
            <Plus size={28} className="mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-sm">New Reward</span>
          </button>
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div className="bg-white border rounded-2xl overflow-hidden notion-shadow">
          <div className="p-4 border-b bg-slate-50/50">
            <h3 className="font-bold text-slate-900 text-sm">Point History — {child?.name?.split(' ')[0]}</h3>
          </div>
          <div className="divide-y">
            {getTxns(selectedChild).length === 0 ? (
              <div className="p-12 text-center text-slate-400">No transactions yet. Complete chores to earn points!</div>
            ) : getTxns(selectedChild).map(txn => (
              <div key={txn.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${txn.type === 'earned' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'}`}>
                    {txn.type === 'earned' ? <Zap size={16} /> : <Gift size={16} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{txn.description}</p>
                    <p className="text-xs text-slate-400">{txn.date}</p>
                  </div>
                </div>
                <span className={`font-bold text-sm ${txn.type === 'earned' ? 'text-green-600' : 'text-purple-600'}`}>
                  {txn.type === 'earned' ? '+' : ''}{txn.points} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Reward Modal */}
      {addRewardOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">New Reward</h2>
              <button onClick={() => setAddRewardOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Emoji</label>
                  <input
                    value={rewardForm.emoji}
                    onChange={e => setRewardForm(f => ({ ...f, emoji: e.target.value }))}
                    className="w-16 border rounded-xl px-3 py-2 text-center text-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Reward Name *</label>
                  <input
                    autoFocus
                    value={rewardForm.name}
                    onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Movie Night Pick"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Description</label>
                <input
                  value={rewardForm.description}
                  onChange={e => setRewardForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="What does this reward give the child?"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Point Cost *</label>
                <input
                  type="number"
                  value={rewardForm.pointCost}
                  onChange={e => setRewardForm(f => ({ ...f, pointCost: e.target.value }))}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 100"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAddRewardOpen(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button
                  onClick={handleAddReward}
                  disabled={!rewardForm.name || !rewardForm.pointCost}
                  className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save Reward
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Allowance;
