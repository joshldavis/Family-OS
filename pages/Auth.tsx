
import React, { useState } from 'react';
import { User } from '../types';
import { MOCK_USERS } from '../db';
import { ShieldCheck, User as UserIcon, Lock } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isJoin, setIsJoin] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate auth logic - find first mock user matching if email exists, else use Sarah
    const user = MOCK_USERS.find(u => u.email === email) || MOCK_USERS[0];
    onLogin(user);
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg">F</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Family OS</h1>
          <p className="text-slate-500 mt-2">Bring calm to the family chaos.</p>
        </div>

        <div className="bg-white border p-8 rounded-3xl notion-shadow">
          <div className="flex gap-2 p-1 bg-slate-50 rounded-xl mb-8">
            <button 
              onClick={() => setIsJoin(false)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isJoin ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setIsJoin(true)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isJoin ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
            >
              Join Family
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="email" 
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            
            {isJoin && (
               <div>
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Invite Code</label>
               <div className="relative">
                 <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                 <input 
                   type="text" 
                   className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                   placeholder="e.g. MILLER2024"
                   required
                 />
               </div>
             </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="password" 
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100">
              {isJoin ? 'Create Workspace' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t text-center space-y-4">
            <p className="text-xs text-slate-400">Quick Login for Demo:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {MOCK_USERS.map(u => (
                <button 
                  key={u.id}
                  onClick={() => onLogin(u)}
                  className="text-[10px] font-bold uppercase tracking-widest border px-3 py-1 rounded-full hover:bg-slate-50 transition-colors text-slate-500"
                >
                  {u.name} ({u.role})
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8 px-4">
          By continuing, you agree to our Terms of Service and Privacy Policy. 
          Your family data is private to your workspace.
        </p>
      </div>
    </div>
  );
};

export default Auth;
