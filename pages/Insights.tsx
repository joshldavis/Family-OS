
import React, { useMemo } from 'react';
import { Assignment, Chore, CalendarEvent, Status } from '../types';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Zap, BrainCircuit } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface InsightsProps {
  assignments: Assignment[];
  chores: Chore[];
  events: CalendarEvent[];
}

const Insights: React.FC<InsightsProps> = ({ assignments, chores, events }) => {
  const completionRate = useMemo(() => {
    const total = assignments.length + chores.length;
    const done = assignments.filter(a => a.status === Status.DONE).length + chores.filter(c => c.status === Status.DONE).length;
    return Math.round((done / total) * 100);
  }, [assignments, chores]);

  const workloadByDay = useMemo(() => {
    const data: Record<string, { school: number; chores: number; events: number }> = {};
    const today = new Date();
    
    for (let i = -3; i < 4; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = d.toISOString().split('T')[0];
      data[key] = { school: 0, chores: 0, events: 0 };
    }

    assignments.forEach(a => {
      if (data[a.dueDate]) data[a.dueDate].school += a.estimatedMinutes;
    });
    chores.forEach(c => {
      if (data[c.dueDate]) data[c.dueDate].chores += 15; // Assumption: 15 mins per chore
    });
    events.forEach(e => {
      const key = e.start.split('T')[0];
      if (data[key]) {
        const duration = (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000;
        data[key].events += duration;
      }
    });

    return Object.entries(data).map(([date, values]) => ({
      name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      ...values,
      total: values.school + values.chores + values.events
    }));
  }, [assignments, chores, events]);

  const busiestDay = useMemo(() => {
    return workloadByDay.reduce((prev, current) => (prev.total > current.total) ? prev : current);
  }, [workloadByDay]);

  const pieData = [
    { name: 'Schoolwork', value: assignments.filter(a => a.status !== Status.DONE).length, color: '#6366f1' },
    { name: 'Chores', value: chores.filter(c => c.status !== Status.DONE).length, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Family Insights</h1>
        <p className="text-slate-500 mt-1">Data-driven views of your household's flow.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border rounded-2xl p-6 notion-shadow flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{completionRate}%</p>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Completion Rate</p>
          </div>
        </div>
        <div className="bg-white border rounded-2xl p-6 notion-shadow flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{busiestDay.name}</p>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Busiest Day This Week</p>
          </div>
        </div>
        <div className="bg-white border rounded-2xl p-6 notion-shadow flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">
              {assignments.filter(a => a.dueDate < new Date().toISOString().split('T')[0] && a.status !== Status.DONE).length}
            </p>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Overdue Items</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white border rounded-2xl p-8 notion-shadow">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Weekly Workload (Minutes)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadByDay}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" />
                <Bar dataKey="school" name="Schoolwork" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="chores" name="Chores" stackId="a" fill="#f59e0b" />
                <Bar dataKey="events" name="Events" stackId="a" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white border rounded-2xl p-8 notion-shadow">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Pending Items Distribution</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="bg-indigo-900 text-white rounded-3xl p-8 notion-shadow overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <BrainCircuit size={28} className="text-indigo-400" />
            <h3 className="text-2xl font-bold">Family Flow Report</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <h4 className="text-indigo-300 font-bold uppercase text-xs tracking-widest">Observations</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-indigo-400 mt-1 flex-shrink-0" />
                  <span>The household is highly efficient on Mondays, completing 90% of planned tasks.</span>
                </li>
                <li className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-400 mt-1 flex-shrink-0" />
                  <span>Schoolwork workload peaks on Wednesdays. Consider rescheduling non-urgent chores to Tuesday.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Zap size={18} className="text-indigo-400 mt-1 flex-shrink-0" />
                  <span>Maya has been very consistent with chores this week.</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-indigo-300 font-bold uppercase text-xs tracking-widest">Action Items</h4>
              <div className="bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm">
                <p className="text-sm">"Based on current trends, we recommend a family 'Sprint Session' on Sunday evenings to clear any lingering schoolwork before the new week starts."</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
      </section>
    </div>
  );
};

export default Insights;
