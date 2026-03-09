
import React, { useState } from 'react';
import { User, Role } from '../types';
import { ShieldCheck, User as UserIcon, Lock, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthProps {
  onLogin: (user: User) => void;
  users: User[];
  familyName?: string;
}

const Auth: React.FC<AuthProps> = ({ onLogin, users, familyName }) => {
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [inviteCode,  setInviteCode]  = useState('');
  const [isJoin,      setIsJoin]      = useState(false);
  const [authError,   setAuthError]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  // ── Sign In ──────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured) {
        // Real Supabase authentication
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setAuthError(error.message);
          return;
        }

        if (data.user) {
          // Look up the user's profile record
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('auth_id', data.user.id)
            .single();

          if (profileErr || !profile) {
            setAuthError('Profile not found. Please contact your family administrator.');
            await supabase.auth.signOut();
            return;
          }

          onLogin({
            id:       profile.id,
            familyId: profile.family_id,
            name:     profile.name,
            email:    profile.email ?? email,
            role:     profile.role as Role,
            avatar:   profile.avatar_url ?? undefined,
          });
        }
      } else {
        // Demo / offline mode — match by email only
        if (users.length === 0) {
          setAuthError('No family members found. Please complete onboarding first.');
          return;
        }
        const user = users.find(u => u.email === email);
        if (!user) {
          setAuthError('No account found with that email address.');
          return;
        }
        onLogin(user);
      }
    } catch (err: any) {
      setAuthError(err?.message ?? 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Join Family ───────────────────────────────────────────────────────────────
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    if (inviteCode.trim().length < 4) {
      setAuthError('Please enter a valid invite code.');
      setLoading(false);
      return;
    }

    try {
      if (isSupabaseConfigured) {
        // Look up family by invite code
        const { data: familyRow, error: famErr } = await supabase
          .from('families')
          .select('id, name, invite_code')
          .eq('invite_code', inviteCode.trim().toUpperCase())
          .single();

        if (famErr || !familyRow) {
          setAuthError('Invite code not found. Please check with your family administrator.');
          return;
        }

        // Sign up new account
        const { data, error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) {
          setAuthError(signUpErr.message);
          return;
        }

        if (data.user) {
          // Create profile in this family
          const newProfile = {
            id:        data.user.id,
            auth_id:   data.user.id,
            family_id: familyRow.id,
            name:      email.split('@')[0], // placeholder; user can update in Settings
            email:     email,
            role:      'Parent',
            points:    0,
          };
          await supabase.from('profiles').upsert(newProfile);

          onLogin({
            id:       newProfile.id,
            familyId: newProfile.family_id,
            name:     newProfile.name,
            email:    newProfile.email,
            role:     Role.PARENT,
          });
        } else {
          // Email confirmation required
          setAuthError('Check your email for a confirmation link, then sign in.');
        }
      } else {
        // Demo mode — just use invite code as a password
        const user = users[0];
        if (!user) {
          setAuthError('No family members found. Please complete onboarding first.');
          return;
        }
        onLogin(user);
      }
    } catch (err: any) {
      setAuthError(err?.message ?? 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg">F</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Family OS</h1>
          <p className="text-slate-500 mt-2">
            {familyName ? `Welcome back, ${familyName} Family` : 'Bring calm to the family chaos.'}
          </p>
        </div>

        <div className="bg-white border p-8 rounded-3xl notion-shadow">
          {/* Tab toggle */}
          <div className="flex gap-2 p-1 bg-slate-50 rounded-xl mb-8">
            <button
              onClick={() => { setIsJoin(false); setAuthError(null); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isJoin ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsJoin(true); setAuthError(null); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isJoin ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
            >
              Join Family
            </button>
          </div>

          <form onSubmit={isJoin ? handleJoin : handleSignIn} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="auth-email" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Email Address
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  id="auth-email"
                  type="email"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Invite code (Join only) */}
            {isJoin && (
              <div>
                <label htmlFor="auth-invite" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Invite Code
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    id="auth-invite"
                    type="text"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    placeholder="e.g. SMITH2025"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="auth-password" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  id="auth-password"
                  type="password"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Error */}
            {authError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
                {authError}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? 'Please wait…' : isJoin ? 'Join Workspace' : 'Sign In'}
            </button>
          </form>

          {/* Quick login for demo / child accounts */}
          {users.length > 0 && (
            <div className="mt-8 pt-8 border-t text-center space-y-4">
              <p className="text-xs text-slate-400">
                {isSupabaseConfigured ? 'Quick Switch (children & demo)' : 'Quick Login:'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {users.map(u => (
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
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8 px-4">
          {isSupabaseConfigured
            ? 'Your family data is securely synced to the cloud.'
            : 'Your family data is private and stored locally on your device.'}
        </p>
      </div>
    </div>
  );
};

export default Auth;
