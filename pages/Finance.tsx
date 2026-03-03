
import React, { useState, useMemo } from 'react';
import { Transaction, BudgetCategory, SavingsGoal } from '../types';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  DollarSign,
  Sparkles,
  X
} from 'lucide-react';
import AIScanModal from '../components/AIScanModal';

interface FinanceProps {
  transactions: Transaction[];
  budgets: BudgetCategory[];
  savings: SavingsGoal[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setBudgets: React.Dispatch<React.SetStateAction<BudgetCategory[]>>;
  setSavings: React.Dispatch<React.SetStateAction<SavingsGoal[]>>;
}

const Finance: React.FC<FinanceProps> = ({ 
  transactions, 
  budgets, 
  savings,
  setTransactions,
  setBudgets,
  setSavings
}) => {
  const [activeTab, setActiveTab] = useState<'budget' | 'transactions' | 'savings'>('budget');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);

  const monthlyIncome = useMemo(() => 
    transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0), 
    [transactions]
  );

  const monthlyExpenses = useMemo(() => 
    transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0), 
    [transactions]
  );

  const netCashFlow = monthlyIncome - monthlyExpenses;

  const handleAIScanResult = (data: any) => {
    const newTransaction: Transaction = {
      id: `t-ai-${Date.now()}`,
      familyId: 'fam-1',
      date: data.date,
      description: data.description,
      amount: data.amount,
      category: data.category,
      type: 'expense'
    };
    setTransactions(prev => [newTransaction, ...prev]);
  };

  const handleSaveTransaction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const newTransaction: Transaction = {
      id: `t-${Date.now()}`,
      familyId: 'fam-1',
      date: formData.get('date') as string,
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string),
      category: formData.get('category') as string,
      type: formData.get('type') as 'income' | 'expense'
    };

    setTransactions(prev => [newTransaction, ...prev]);
    setIsTransactionModalOpen(false);
  };

  const handleSaveBudget = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newBudget: BudgetCategory = {
      id: `b-${Date.now()}`,
      name: formData.get('name') as string,
      limit: parseFloat(formData.get('limit') as string),
      spent: 0,
      color: randomColor
    };

    setBudgets(prev => [...prev, newBudget]);
    setIsBudgetModalOpen(false);
  };

  const handleSaveSavingsGoal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const newGoal: SavingsGoal = {
      id: `sg-${Date.now()}`,
      name: formData.get('name') as string,
      targetAmount: parseFloat(formData.get('targetAmount') as string),
      currentAmount: parseFloat(formData.get('currentAmount') as string) || 0,
      dueDate: formData.get('dueDate') as string || undefined,
    };

    setSavings(prev => [...prev, newGoal]);
    setIsSavingsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Finance</h1>
          <p className="text-slate-500 mt-1">Track family wealth, spending, and savings goals.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-sm text-sm"
          >
            <Sparkles size={18} />
            Scan Receipt
          </button>
          <button
            onClick={() => setIsTransactionModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm text-sm"
          >
            <Plus size={18} />
            Log Transaction
          </button>
        </div>
      </header>

      {/* Financial Pulse Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border rounded-2xl p-6 notion-shadow">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Net Balance</p>
          <div className="flex items-center justify-between">
            <h2 className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${netCashFlow.toLocaleString()}
            </h2>
            <div className={`p-2 rounded-lg ${netCashFlow >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {netCashFlow >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Current monthly cash flow</p>
        </div>
        <div className="bg-white border rounded-2xl p-6 notion-shadow">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Monthly Income</p>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">${monthlyIncome.toLocaleString()}</h2>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ArrowUpRight size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Total household earnings</p>
        </div>
        <div className="bg-white border rounded-2xl p-6 notion-shadow">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Monthly Expenses</p>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">${monthlyExpenses.toLocaleString()}</h2>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <ArrowDownRight size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Planned and unplanned spend</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        {[
          { id: 'budget', label: 'Budgeting', icon: CreditCard },
          { id: 'transactions', label: 'Transactions', icon: DollarSign },
          { id: 'savings', label: 'Savings Goals', icon: Target },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-colors relative ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <tab.icon size={16} />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>}
          </button>
        ))}
      </div>

      {activeTab === 'budget' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets.map(budget => {
            const progress = (budget.spent / budget.limit) * 100;
            const isDanger = progress > 90;
            return (
              <div key={budget.id} className="bg-white border rounded-2xl p-6 notion-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">{budget.name}</h3>
                    <p className="text-xs text-slate-500">Monthly Allocation</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isDanger ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                    {isDanger ? 'Near Limit' : 'On Track'}
                  </div>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">${budget.spent.toLocaleString()} spent</span>
                  <span className="text-slate-400">of ${budget.limit.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-700 ease-out rounded-full" 
                    style={{ width: `${Math.min(100, progress)}%`, backgroundColor: isDanger ? '#ef4444' : budget.color }}
                  ></div>
                </div>
                <p className="text-[10px] text-slate-400 mt-4 text-right">
                  ${Math.max(0, budget.limit - budget.spent).toLocaleString()} remaining
                </p>
              </div>
            );
          })}
          <button
            onClick={() => setIsBudgetModalOpen(true)}
            className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all group"
          >
            <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold">New Category</span>
          </button>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="bg-white border rounded-2xl overflow-hidden notion-shadow">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-900 text-sm">Recent Activity</h3>
            <button className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-700">
              <Filter size={14} /> Filter
            </button>
          </div>
          <div className="divide-y">
            {transactions.map(t => (
              <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600'}`}>
                    {t.type === 'income' ? <ArrowUpRight size={20} /> : <CreditCard size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{t.description}</p>
                    <p className="text-xs text-slate-400">{t.date} • {t.category}</p>
                  </div>
                </div>
                <p className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-slate-900'}`}>
                  {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'savings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {savings.map(goal => {
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            return (
              <div key={goal.id} className="bg-white border rounded-2xl p-8 notion-shadow relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                      <Target size={24} />
                    </div>
                    {goal.dueDate && (
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Date</p>
                        <p className="text-xs font-bold text-slate-600">{goal.dueDate}</p>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{goal.name}</h3>
                  <div className="flex items-end gap-2 mb-6">
                    <span className="text-3xl font-bold text-indigo-600">${goal.currentAmount.toLocaleString()}</span>
                    <span className="text-slate-400 mb-1">/ ${goal.targetAmount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-1000 ease-out" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs font-bold text-indigo-600">{Math.round(progress)}% Complete</span>
                    <button className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors">Adjust Goal</button>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
              </div>
            );
          })}
          <button
            onClick={() => setIsSavingsModalOpen(true)}
            className="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all group"
          >
            <Plus size={40} className="mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-lg">Create New Goal</span>
          </button>
        </div>
      )}

      {/* Transaction Modal */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-50/30">
              <h2 className="text-xl font-bold text-slate-900">Log Transaction</h2>
              <button onClick={() => setIsTransactionModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Description</label>
                <input
                  name="description"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="e.g. Grocery Store"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Amount ($)</label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Type</label>
                  <select
                    name="type"
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Category</label>
                  <input
                    name="category"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    placeholder="e.g. Groceries"
                  />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Savings Goal Modal */}
      {isSavingsModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-50/30">
              <h2 className="text-xl font-bold text-slate-900">New Savings Goal</h2>
              <button onClick={() => setIsSavingsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveSavingsGoal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Goal Name</label>
                <input
                  name="name"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="e.g. New Car"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Target Amount ($)</label>
                  <input
                    name="targetAmount"
                    type="number"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Starting Amount ($)</label>
                  <input
                    name="currentAmount"
                    type="number"
                    defaultValue="0"
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Target Date (Optional)</label>
                <input
                  type="date"
                  name="dueDate"
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-50/30">
              <h2 className="text-xl font-bold text-slate-900">New Budget Category</h2>
              <button onClick={() => setIsBudgetModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveBudget} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Category Name</label>
                <input
                  name="name"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="e.g. Dining Out"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Monthly Limit ($)</label>
                <input
                  name="limit"
                  type="number"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="0.00"
                />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AIScanModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        context="finance" 
        onDataExtracted={handleAIScanResult} 
      />
    </div>
  );
};

export default Finance;
