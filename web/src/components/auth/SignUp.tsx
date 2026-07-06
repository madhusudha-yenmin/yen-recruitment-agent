"use client";

import React, { useState } from 'react';
import { User, UserRole, AuthView } from '../../types';

interface SignUpProps {
  role: UserRole;
  onLogin: (user: User) => void;
  onNavigate: (view: AuthView) => void;
}

export const SignUp: React.FC<SignUpProps> = ({ role, onLogin, onNavigate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // HR specific
  const [company, setCompany] = useState('');
  const [department, setDepartment] = useState('');
  
  // Candidate specific
  const [techStack, setTechStack] = useState('Python, FastAPI, PostgreSQL, Docker');
  const [experience, setExperience] = useState('5');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError('');

    setTimeout(() => {
      setLoading(false);
      if (role === 'hr') {
        onLogin({
          id: 'hr-' + Math.floor(Math.random() * 1000),
          name: name,
          email: email,
          role: 'hr',
          company: company || 'YEN Enterprise',
          department: department || 'Talent Acquisition',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
        });
      } else {
        const skillsArray = techStack.split(',').map(s => s.trim()).filter(Boolean);
        onLogin({
          id: 'cand-' + Math.floor(Math.random() * 1000),
          name: name,
          email: email,
          role: 'candidate',
          techStack: skillsArray.length ? skillsArray : ['Python', 'FastAPI', 'System Design'],
          experienceYears: parseFloat(experience) || 4.0,
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
        });
      }
    }, 700);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Create {role === 'hr' ? 'Recruiter' : 'Candidate'} Account
        </h2>
        <p className="text-sm text-slate-400">
          {role === 'hr' 
            ? 'Deploy autonomous 5-Agent hiring workflows & HITL reviews' 
            : 'Join AI interview studios & get matched with top AI engineering teams'}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === 'hr' ? "Sarah Jenkins" : "Alice Smith"}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Email Address *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={role === 'hr' ? "sarah@company.ai" : "alice@example.com"}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Role Specific Fields */}
        {role === 'hr' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Company Name</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="YEN AI Global"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Talent Acquisition"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Primary Tech Stack (comma separated)</label>
              <input
                type="text"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                placeholder="Python, FastAPI, PostgreSQL, LangGraph"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Years of Experience</label>
                <input
                  type="number"
                  step="0.5"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="5.0"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Resume Upload (Optional)</label>
                <div className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-dashed border-slate-700 text-slate-400 text-xs flex items-center justify-between cursor-pointer hover:border-indigo-500/50 transition-all">
                  <span className="truncate">alice_resume_2026.pdf</span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">Ready</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Create Password *</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
          />
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
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <span>Create {role === 'hr' ? 'HR Recruiter' : 'Candidate'} Account</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-slate-800/80 text-center">
        <p className="text-xs text-slate-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('signin')}
            className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors cursor-pointer"
          >
            Sign In Here
          </button>
        </p>
      </div>
    </div>
  );
};
