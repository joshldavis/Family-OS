
import React, { useState } from 'react';
import { Chore, Status, User, Role, Frequency } from '../types';
import { Plus, CheckSquare, Square, Trash2, Calendar, Clock, User as UserIcon, Sparkles } from 'lucide-react';
import AIScanModal from '../components/AIScanModal';

interface ChoresProps {
  chores: Chore[];
  setChores: React.Dispatch<React.SetStateAction<Chore[]>>;
  users: User[];
}

const Chores: React.FC<ChoresProps> = ({ chores, setChores, users }) => {
  const [filterUser, setFilterUser] = useState<string>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleChore = (id: string) => {
    setChores(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, status: c.status === Status.DONE ? Status.NOT_STARTED : Status.DONE };
      }
      return c;
    }));
  };

  const deleteChore = (id: string) => {
    setDeletingId(id);
    setTimeout(() => {
      setChores(prev => prev.filter(c => c.id !== id));
      setDeletingId(null);
    }, 300);
  };

  const handleAIScanResult = (extractedList: any[]) => {
    const newChores = extractedList.map((item, idx) => {
      const matchedUser = users.find(u => 
        u.name.toLowerCase().includes(item.assigneeName?.toLowerCase() || "")
      ) || users[0];

      return {
        id: `c-ai-${Date.now()}-${idx}`,
        assigneeId: matchedUser.id,
        title: item.title,
        frequency: Frequency.ONE_TIME,
        dueDate: item.dueDate,
        status: Status.NOT_STARTED
      };
    });
    setChores(prev => [...newChores, ...prev]);
  };

  const filteredChores = chores.filter(c => filterUser === 'all' || c.assigneeId === filterUser);
  const overdueChores = filteredChores.filter(c => c.status !== Status.DONE && c.dueDate < new Date().toISOString().split('T')[0]);
  const activeChores = filteredChores.filter(c => c.status !== Status.DONE && !overdueChores.find(oc => oc.id === c.id));
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
              {assignee?.name}
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
        <div className="flex gap-2">
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
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus size={18} />
            Add Chore
          </button>
        </div>
      </header>

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
