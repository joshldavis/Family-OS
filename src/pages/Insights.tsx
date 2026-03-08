
import React, { useMemo, useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Status } from '../types';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Zap, BrainCircuit, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useFamily } from '../FamilyContext';

interface AIReport {
  observations: string[];
  actionItems: string[];
  budgetAdvice: string;
}

const Insights: React.FC = () => {
  const { state } = useFamily();
  const { assignments, chores, events, transactions, budgets, savings } = state;
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const completionRate = useMemo(() => {
    const total = assignments.length + chores.length;
    const done = assignments.filter(a => a.status === Status.DONE).length + chores.filter(c => c.status === Status.DONE).length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
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
      if (data[c.dueDate]) data[c.dueDate].chores += 15;
    });
    events.forEach(e => {
      const key = e.start.split('T')[0];
      if (data[key]) {
        const duration = (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000;
        data[key].events += duration;
      }
    });

    return Object.entries(data).map(([date, values]) => ({
      name: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
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

  const totalBudget = budgets.reduce((a, b) => a + b.limit, 0);
  const totalSpent = budgets.reduce((a, b) => a + b.spent, 0);

  const generateAIReport = async () => {
    setIsGenerating(true);
    try {
      const apiKey = import.meta.env.VITE_API_KEY || '';
      if (!apiKey) throw new Error('No API key');

      const ai = new GoogleGenAI({ apiKey });
      const todayStr = new Date().toISOString().split('T')[0];

      const context = `
Today: ${todayStr}
Completion rate: ${completionRate}%
Busiest day: ${busiestDay.name}

Assignments (${assignments.length} total, ${assignments.filter(a => a.status === Status.DONE).length} done):
${assignments.map(a => `- ${a.title} (${a.subject}): ${a.status}, due ${a.dueDate}`).join('\n')}

Chores (${chores.length} total, ${chores.filter(c => c.status === Status.DONE).length} done):
${chores.map(c => `- ${c.title}: ${c.status}, due ${c.dueDate}`).join('\n')}

Events this week:
${events.map(e => `- ${e.title}: ${e.start}${e.location ? ' @ ' + e.location : ''}`).join('\n')}

Budget ($${totalSpent} of $${totalBudget} spent):
${budgets.map(b => `- ${b.name}: $${b.spent}/$${b.limit} (${Math.round((b.spent / b.limit) * 100)}%)`).join('\n')}

Recent Transactions:
${transactions.slice(0, 8).map(t => `- ${t.description}: $${t.amount} (${t.type}, ${t.category})`).join('\n')}

Savings Goals:
${savings.map(s => `- ${s.name}: $${s.currentAmount}/$${s.targetAmount}`).join('\n')}
`.trim();

      const result = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ parts: [{ text: `Analyze the following family data and provide insights. Return a JSON object with:
- "observations": array of 3-4 short (1-2 sentence) observations about the family's productivity, schedule, and finances
- "actionItems": array of 2-3 specific, actionable recommendations
- "budgetAdvice": a single paragraph with personalized budget advice

Be warm, specific, and practical. Reference actual data points.\n\n${context}` }] }],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(result.text || '{}');
      setAiReport(parsed);
      setHasGenerated(true);
    } catch (err) {
      setAiReport({
        observations: [
          'Unable to generate AI insights. Please check your Gemini API key in the .env file.',
        ],
        actionItems: ['Set VITE_API_KEY in your .env file to enable AI-powered reports.'],
        budgetAdvice: 'Connect your Gemini API key to get personalized budget advice.',
      });
      setHasGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  };

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

      {/* AI-Powered Family Flow Report */}
      <section className="bg-indigo-900 text-white rounded-3xl p-8 notion-shadow overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BrainCircuit size={28} className="text-indigo-400" />
              <div>
                <h3 className="text-2xl font-bold">Family Flow Report</h3>
                <p className="text-indigo-300 text-xs font-medium">AI-powered by Gemini</p>
              </div>
            </div>
            <button
              onClick={generateAIReport}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing...
                </>
              ) : hasGenerated ? (
                <>
                  <RefreshCw size={16} />
                  Refresh
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Report
                </>
              )}
            </button>
          </div>

          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={40} className="text-indigo-400 animate-spin mb-4" />
              <p className="text-indigo-300 text-sm">Gemini is analyzing your family data...</p>
            </div>
          ) : aiReport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <h4 className="text-indigo-300 font-bold uppercase text-xs tracking-widest">Observations</h4>
                <ul className="space-y-3">
                  {aiReport.observations.map((obs, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="text-indigo-400 mt-1 flex-shrink-0" />
                      <span className="text-sm">{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-indigo-300 font-bold uppercase text-xs tracking-widest">Action Items</h4>
                <ul className="space-y-3">
                  {aiReport.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Zap size={18} className="text-amber-400 mt-1 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <h4 className="text-indigo-300 font-bold uppercase text-xs tracking-widest mb-2">Budget Advice</h4>
                  <div className="bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm">
                    <p className="text-sm">{aiReport.budgetAdvice}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <h4 className="text-indigo-300 font-bold uppercase text-xs tracking-widest">Observations</h4>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-indigo-400 mt-1 flex-shrink-0" />
                    <span>Your task completion rate is {completionRate}% — {completionRate >= 70 ? 'great momentum!' : 'room for improvement.'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-400 mt-1 flex-shrink-0" />
                    <span>{busiestDay.name} is your busiest day with {busiestDay.total} minutes of activities.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Zap size={18} className="text-indigo-400 mt-1 flex-shrink-0" />
                    <span>Budget utilization is at {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% — {totalBudget > 0 && totalSpent / totalBudget > 0.85 ? 'watch your spending!' : 'healthy pacing.'}</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-indigo-300 font-bold uppercase text-xs tracking-widest">AI Analysis</h4>
                <div className="bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm flex items-center gap-3">
                  <Sparkles size={20} className="text-indigo-400 flex-shrink-0" />
                  <p className="text-sm">Click "Generate Report" to get a personalized AI analysis of your family's productivity, schedule, and finances.</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
      </section>
    </div>
  );
};

export default Insights;
