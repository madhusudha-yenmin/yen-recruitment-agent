"use client";

import React, { useState } from 'react';
import { User, UserRole, AuthView } from '../../types';

interface SignInProps {
  role: UserRole;
  onLogin: (user: User) => void;
  onNavigate: (view: AuthView) => void;
}

export const SignIn: React.FC<SignInProps> = ({ role, onLogin, onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleQuickFill = () => {
    if (role === 'hr') {
      setEmail('recruiter@yen.ai');
      setPassword('Admin@1234!');
    } else {
      setEmail('alice.smith@example.com');
      setPassword('Candidate@2026!');
    }
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    setTimeout(() => {
      setLoading(false);
      if (role === 'hr') {
        onLogin({
          id: 'hr-001',
          name: 'Sarah Jenkins',
          email: email,
          role: 'hr',
          company: 'YEN AI Global',
          department: 'Talent Acquisition & Orchestration',
          avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
        });
      } else {
        onLogin({
          id: 'cand-001',
          name: 'Alice Smith',
          email: email,
          role: 'candidate',
          techStack: ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'LangGraph'],
          experienceYears: 6.0,
          avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
        });
      }
    }, 600);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Welcome back, {role === 'hr' ? 'Recruiter' : 'Candidate'}
        </h2>
        <p className="text-sm text-slate-400">
          Sign in to access your {role === 'hr' ? 'autonomous hiring orchestrator' : 'AI interview studio & portal'}
        </p>
      </div>

      {/* Quick Fill Banner for Instant Demoing */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-indigo-300">Instant Demo Access</p>
            <p className="text-[11px] text-slate-400">Pre-fill valid {role === 'hr' ? 'HR Recruiter' : 'Candidate'} credentials</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleQuickFill}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
        >
          Use Demo Account
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5 text-left">
          <label className="text-xs font-medium text-slate-300">Email Address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={role === 'hr' ? "recruiter@yen.ai" : "alice.smith@example.com"}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Password</label>
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>Sign In to {role === 'hr' ? 'Recruiter Dashboard' : 'Candidate Portal'}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-slate-800/80 text-center">
        <p className="text-xs text-slate-400">
          Don&apos;t have an account yet?{' '}
          <button
            type="button"
            onClick={() => onNavigate('signup')}
            className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors cursor-pointer"
          >
            Create {role === 'hr' ? 'Recruiter' : 'Candidate'} Account
          </button>
        </p>
      </div>
    </div>
  );
};
