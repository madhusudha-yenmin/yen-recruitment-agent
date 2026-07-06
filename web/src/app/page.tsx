"use client";

import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { AuthContainer } from '../components/auth/AuthContainer';
import { HRDashboard } from '../components/dashboard/HRDashboard';
import { CandidateDashboard } from '../components/dashboard/CandidateDashboard';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user session exists in localStorage for persistence across page refreshes
    const savedUser = localStorage.getItem('yen_user_session');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setTimeout(() => {
          setUser(parsed);
          setIsLoading(false);
        }, 0);
        return;
      } catch (e) {
        console.error('Failed to parse user session', e);
      }
    }
    setTimeout(() => {
      setIsLoading(false);
    }, 0);
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('yen_user_session', JSON.stringify(newUser));
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem('yen_user_session');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">Loading YEN AI Studio...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthContainer onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {user.role === 'hr' ? (
        <HRDashboard user={user} onSignOut={handleSignOut} />
      ) : (
        <CandidateDashboard user={user} onSignOut={handleSignOut} />
      )}
    </div>
  );
}
