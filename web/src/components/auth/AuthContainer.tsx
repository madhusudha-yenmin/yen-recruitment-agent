"use client";

import React, { useState } from 'react';
import { User, UserRole, AuthView } from '../../types';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';
import { ForgotPassword } from './ForgotPassword';
import { ResetPassword } from './ResetPassword';

interface AuthContainerProps {
  onLogin: (user: User) => void;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({ onLogin }) => {
  const [view, setView] = useState<AuthView>('signin');
  const [role, setRole] = useState<UserRole>('hr');

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-950 selection:bg-indigo-500 selection:text-white">
      {/* Background Glowing Blobs & Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e1e2e_1px,transparent_1px),linear-gradient(to_bottom,#1e1e2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none animate-pulse duration-10000" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl pointer-events-none animate-pulse duration-7000" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-semibold text-indigo-400 shadow-md">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            <span>Autonomous 5-Agent Recruitment Platform</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center space-x-2">
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">YEN AI</span>
            <span className="text-sm font-normal text-slate-400 border border-slate-800 px-2 py-0.5 rounded-md">v2.0</span>
          </h1>
        </div>

        {/* Glassmorphism Card */}
        <div className="p-8 rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-slate-800/80 shadow-2xl shadow-indigo-500/10 relative overflow-hidden">
          {/* Top Subtle Gradient Border Highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80" />

          {/* Role Selector Toggle (Only shown on signin/signup) */}
          {(view === 'signin' || view === 'signup') && (
            <div className="mb-6 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center relative">
              <button
                type="button"
                onClick={() => setRole('hr')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer relative z-10 ${
                  role === 'hr' ? 'text-white shadow-md bg-gradient-to-r from-indigo-600 to-purple-600' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>HR Recruiter</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('candidate')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer relative z-10 ${
                  role === 'candidate' ? 'text-white shadow-md bg-gradient-to-r from-purple-600 to-pink-600' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Candidate Portal</span>
              </button>
            </div>
          )}

          {/* Conditional View Rendering */}
          {view === 'signin' && <SignIn role={role} onLogin={onLogin} onNavigate={setView} />}
          {view === 'signup' && <SignUp role={role} onNavigate={setView} />}
          {view === 'forgot-password' && <ForgotPassword onNavigate={setView} />}
          {view === 'reset-password' && <ResetPassword onNavigate={setView} />}
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 flex items-center justify-center space-x-4">
          <span>Protected by LangGraph Checkpointer</span>
          <span>•</span>
          <span>Semantic ATS Matcher</span>
          <span>•</span>
          <span>HITL Validated</span>
        </div>
      </div>
    </div>
  );
};
