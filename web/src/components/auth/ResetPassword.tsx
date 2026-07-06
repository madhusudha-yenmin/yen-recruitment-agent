"use client";

import React, { useState } from 'react';
import { AuthView } from '../../types';

interface ResetPasswordProps {
  onNavigate: (view: AuthView) => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasNumberOrSymbol = /[0-9!@#$%^&*]/.test(password);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }
    if (!hasMinLength || !hasNumberOrSymbol) {
      setError('Please satisfy all password security requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 700);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 mb-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          {success ? 'Password Reset Complete!' : 'Create New Password'}
        </h2>
        <p className="text-sm text-slate-400">
          {success 
            ? 'Your account credentials have been updated securely.' 
            : 'Enter a strong, unique password for your account'}
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

      {success ? (
        <div className="space-y-4 text-center">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
            <p className="font-semibold text-sm text-emerald-200">Ready to Orchestrate!</p>
            <p>You can now sign in with your new password.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('signin')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>Proceed to Sign In</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">New Password *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Confirm New Password *</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Password Strength Checklist */}
          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2 text-xs text-slate-400">
            <p className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">Security Requirements:</p>
            <div className="flex items-center space-x-2">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${hasMinLength ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-600'}`}>
                {hasMinLength ? '✓' : '•'}
              </span>
              <span className={hasMinLength ? 'text-slate-200' : ''}>At least 8 characters in length</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${hasNumberOrSymbol ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-600'}`}>
                {hasNumberOrSymbol ? '✓' : '•'}
              </span>
              <span className={hasNumberOrSymbol ? 'text-slate-200' : ''}>Contains at least 1 number or special symbol</span>
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
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Reset Password Now</span>
            )}
          </button>
        </form>
      )}

      {!success && (
        <div className="pt-4 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={() => onNavigate('signin')}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center space-x-1.5 mx-auto cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Cancel & Return to Sign In</span>
          </button>
        </div>
      )}
    </div>
  );
};
