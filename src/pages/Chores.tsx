
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Chore, Status, User, Frequency } from '../types';
import { Plus, CheckSquare, Square, Trash2, Calendar, User as UserIcon, Sparkles, X, Wand2, Loader2, CheckCircle2 } from 'lucide-react';
import AIScanModal from '../components/AIScanModal';
import { useFamily } from '../FamilyContext';

interface ChoresProps {
  users: User[];
}

const Chores: React.FC<ChoresProps> = ({ users }) => {
  const { state, dispatch } = useFamily();
  const chores = state.chores;
  const currentUser = state.currentUser;

  const [filterUser, setFilterUser] = useState<string>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [autoScheduleResult, setAutoScheduleResult] = useState<string | null>(null);

  const toggleChore = (id: string) => {
    const chore = chores.find(c => c.id === id);
    if (!chore) return;
    if (chore.status !== Status.DONE) {
      dispatch({
        type: 'COMPLETE_CHORE',
        payload: { id, completedById: currentUser?.id ?? chore.assigneeId },
      });
    } else {
      dispatch({ type: 'UNCOMPLETE_CHORE', payload: id });
    }
  };

  const deleteChore = (id: string) => {
    setDeletingId(id);
    setTimeout(() => {
      dispatch({ type: 'DELETE_CHORE', payload: id });
      setDeletingId(null);
    }, 300);
  };

  const handleSaveChore = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const now = new Date().toISOString();

    const newChore: Chore = {
      id: `c-${Date.now()}`,
      assigneeId: formData.get('assigneeId') as string,
      title: formData.get('title') as string,
      frequency: formData.get('frequency') as Frequency,
      dueDate: formData.get('dueDate') as string,
      status: Status.NOT_STARTED,
      createdAt: now,
      updatedAt: now,
    };

    dispatch({ type: 'ADD_CHORE', payload: newChore });
    setIsModalOpen(false);
  };

  const handleAIScanResult = (extractedList: any[]) => {
    const now = new Date().toISOString();
    extractedList.forEach((item, idx) => {
      const matchedUser = users.find(u =>
        u.name.toLowerCase().includes(item.assigneeName?.toLowerCase() || '')
      ) || users[0];

      const newChore: Chore = {
        id: `c-ai-${Date.now()}-${idx}`,
        assigneeId: matchedUser.id,
        title: item.title,
        frequency: Frequency.ONE_TIME,
        dueDate: item.dueDate,
        status: Status.NOT_STARTED,
        createdAt: now,
        updatedAt: now,
      };
      dispatch({ type: 'ADD_CHORE', payload: newChore });
    });
  };

  const handleAutoSchedule = async () => {
    setIsAutoScheduling(true);
    setAutoScheduleResult(null);

    try {
      const apiKey = import.meta.env.VITE_API_KEY || '';
      if (!apiKey) throw new Error('No API key');

      const ai = new GoogleGenAI({ apiKey });
      const todayStr = new Date().toISOString().split('T')[0];

      const incompleteChores = chores.filter(c => c.status !== Status.DONE);
      const familyMembers = users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        currentLoad: incompleteChores.filter(c => c.assigneeId === u.id).length,
      }));

      const context = `
Today: ${todayStr}
Family members: ${JSON.stringify(familyMembers)}
Incomplete chores: ${JSON.stringify(incompleteChores.map(c => ({ id: c.id, title: c.title, assigneeId: c.assigneeId, dueDate: c.dueDate })))}

Rules:
- Parents can do any chore
- Children should only get age-appropriate chores (feeding pets, tidying rooms, emptying dishwasher, etc.)
- Balance the load evenly, considering each member's current load
- Overdue chores should be prioritized
`.trim();

      const result = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{
          parts: [{
            text: `You are a smart chore scheduler for a family. Reassign the incomplete chores to optimize fairness and efficiency. Return a JSON array of objects with: { "choreId": string, "assigneeId": string, "dueDate": string (YYYY-MM-DD) }. Only include chores that need reassignment.\n\n${context}`
          }]
        }],
        config: { responseMimeType: 'application/json' },
      });

      const reassignments = JSON.parse(result.text || '[]');
      if (Array.isArray(reassignments) && reassignments.length > 0) {
        const now = new Date().toISOString();
        reassignments.forEach((r: any) => {
          const chore = chores.find(c => c.id === r.choreId);
          if (chore) {
            dispatch({
              type: 'UPDATE_CHORE',
              payload: { ...chore, assigneeId: r.assigneeId, dueDate: r.dueDate, updatedAt: now },
            });
          }
        });
        setAutoScheduleResult(`✨ Reassigned ${reassignments.length} chore${reassignments.length > 1 ? 's' : ''} for better balance!`);
      } else {
        setAutoScheduleResult('✅ All chores are already optimally assigned!');
      }
    } catch {
      setAutoScheduleResult('⚠️ Could not auto-schedule. Check your Gemini API key.');
    } finally {
      setIsAutoScheduling(false);
      setTimeout(() => setAutoScheduleResult(null), 5000);
    }
  };

  const filteredChores  = chores.filter(c => filterUser === 'all' || c.assigneeId === filterUser);
  const todayStr        = new Date().toISOString().split('T')[0];
  const overdueChores   = filteredChores.filter(c => c.status !== Status.DONE && c.dueDate < todayStr);
  const activeChores    = filteredChores.filter(c => c.status !== Status.DONE && c.dueDate >= todayStr);
  const completedChores = filteredChores.filter(c => c.status === Status.DONE);

  const ChoreCard: React.FC<{ chore: Chore }> = ({ chore }) => {
    const assignee = users.find(u => u.id === chore.assigneeId);
    return (
      <div className={`bg-white border p-4 rounded-xl notion-shadow group hover:border-indigo-200 transition-all duration-300 flex items-center gap-4 ${deletingId === chore.id ? 'opacity-0 scale-95 translate-x-4 pointer-events-none' : 'opacity-100'}`}>
        <button onClick={() => toggleChore(chore.id)} className="text-slate-400 hover:text-indigo-600 transition-colors">
          {chore.status === Status.DONE ? <CheckSquare size={22} className="text-green-500" /> : <Square size={22} />}
        </button>
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${chore.status === Status.DONE ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{chore.title}</h4>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-slate-400">
              <UserIcon size={12} />
              {assignee?.name ?? 'Unassigned'}
            </div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-slate-400">
              <Calendar size={12} />
              {chore.dueDate}
            </div>
          </div>
        </div>
        <button
          onClick={() => deleteChore(chore.id)}
          className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Chores</h1>
          <p className="text-slate-500 mt-1">Share the load. Keep the house running smoothly.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAutoSchedule}
            disabled={isAutoScheduling}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-60"
          >
            {isAutoScheduling ? (
              <><Loader2 size={18} className="animate-spin" />Scheduling...</>
            ) : (
              <><Wand2 size={18} />Auto-Schedule</>
            )}
          </button>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
          >
            <Sparkles size={18} />
            Magic Scan
          </button>
          <select
            className="bg-white border rounded-lg px-4 py-2 text-sm focus:outline-none notion-shadow"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
          >
            <option value="all">Everyone</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            Add Chore
          </button>
        </div>
      </header>

      {autoScheduleResult && (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
          <CheckCircle2 size={20} className="text-indigo-600 flex-shrink-0" />
          <p className="text-sm font-medium text-indigo-900">{autoScheduleResult}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Overdue ({overdueChores.length})
          </h3>
          <div className="space-y-3">
            {overdueChores.length > 0 ? overdueChores.map(c => <ChoreCard key={c.id} chore={c} />) : <p className="text-sm text-slate-400 italic">No overdue chores.</p>}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Active ({activeChores.length})
          </h3>
          <div className="space-y-3">
            {activeChores.length > 0 ? activeChores.map(c => <ChoreCard key={c.id} chore={c} />) : <p className="text-sm text-slate-400 italic">No active chores.</p>}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Completed ({completedChores.length})
          </h3>
          <div className="space-y-3">
            {completedChores.length > 0 ? completedChores.map(c => <ChoreCard key={c.id} chore={c} />) : <p className="text-sm text-slate-400 italic">No completed chores.</p>}
          </div>
        </section>
      </div>

      {/* Add Chore Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-50/30">
              <h2 className="text-xl font-bold text-slate-900">Add New Chore</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveChore} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Chore Title</label>
                <input
                  name="title"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="e.g. Mow the Lawn"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Assign To</label>
                <select name="assigneeId" className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all">
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Due Date</label>
                  <input
                    type="date"
                    name="dueDate"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Frequency</label>
                  <select name="frequency" className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all">
                    <option value={Frequency.ONE_TIME}>{Frequency.ONE_TIME}</option>
                    <option value={Frequency.DAILY}>{Frequency.DAILY}</option>
                    <option value={Frequency.WEEKLY}>{Frequency.WEEKLY}</option>
                  </select>
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
                  Add Chore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AIScanModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        context="chores"
        onDataExtracted={handleAIScanResult}
        users={users}
      />
    </div>
  );
};

export default Chores;
