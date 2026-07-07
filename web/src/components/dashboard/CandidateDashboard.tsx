/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from 'react';
import { User, CandidateTab } from '../../types';

interface CandidateDashboardProps {
  user: User;
  onSignOut: () => void;
}

export const CandidateDashboard: React.FC<CandidateDashboardProps> = ({ user, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<CandidateTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Availability Screen State
  const [selectedDays, setSelectedDays] = useState<string[]>(user.availability?.days || ['Monday', 'Wednesday', 'Friday']);
  const [selectedSlots, setSelectedSlots] = useState<string[]>(user.availability?.timeSlots || ['Morning (09:00 - 12:00 EST)', 'Afternoon (13:00 - 17:00 EST)']);
  const [timezone, setTimezone] = useState<string>(user.availability?.timezone || 'EST (UTC-5)');
  const [isAvailabilitySaved, setIsAvailabilitySaved] = useState<boolean>(user.availability?.isConfirmed || true);

  // AI Interview Studio State
  const [messages, setMessages] = useState<{ sender: 'ai' | 'candidate'; text: string; timestamp: string }[]>([
    {
      sender: 'ai',
      text: "Hello Alice! I am the YEN AI Interview Agent. Congratulations on your top ranking (96% Match) for the Senior AI Backend Engineer role! Today, we will explore your technical experience with Python, FastAPI, and LangGraph. Are you ready to begin your assessment?",
      timestamp: "10:00 AM"
    },
    {
      sender: 'candidate',
      text: "Hello! Thank you so much. Yes, I am ready to begin. I've been building multi-agent systems and asynchronous backend services for over 6 years now.",
      timestamp: "10:01 AM"
    },
    {
      sender: 'ai',
      text: "Excellent! Let's dive into our first technical question: When designing a distributed multi-agent architecture using LangGraph and PostgreSQL checkpointers, how do you handle state persistence and failure recovery if an agent node crashes mid-execution?",
      timestamp: "10:02 AM"
    }
  ]);
  const [currentInput, setCurrentInput] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [interviewScore, setInterviewScore] = useState<number | null>(9.2);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const timeWindows = [
    'Morning (09:00 - 12:00 EST)',
    'Afternoon (13:00 - 17:00 EST)',
    'Evening (18:00 - 21:00 EST)'
  ];

  const toggleDay = (day: string) => {
    setIsAvailabilitySaved(false);
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const toggleSlot = (slot: string) => {
    setIsAvailabilitySaved(false);
    setSelectedSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]);
  };

  const handleSaveAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAvailabilitySaved(true);
    alert("✓ Availability Preferences Saved! Your AI Studio session has been confirmed & synced with the Interview Agent.");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || isSynthesizing) return;

    const newCandMsg = {
      sender: 'candidate' as const,
      text: currentInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newCandMsg]);
    setCurrentInput("");
    setIsSynthesizing(true);

    setTimeout(() => {
      const aiResponse = {
        sender: 'ai' as const,
        text: "That is an outstanding response! Using PostgreSQL checkpointers to persist thread state at each node boundary ensures zero data loss, and wrapping tool invocations in retry policies is industry best practice. I have recorded your evaluation: 9.4/10 for technical depth!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsSynthesizing(false);
      setInterviewScore(9.4);
    }, 1500);
  };

  const sidebarItems: { id: CandidateTab; label: string; icon: string; badge?: string; badgeColor?: string }[] = [
    { id: 'overview', label: 'My Profile & Applications', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', badge: '96% Match', badgeColor: 'bg-emerald-500/20 text-emerald-300' },
    { id: 'availability', label: 'Availability Screen', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', badge: isAvailabilitySaved ? 'Confirmed' : 'Pending', badgeColor: isAvailabilitySaved ? 'bg-purple-500/20 text-purple-300' : 'bg-amber-500/20 text-amber-300' },
    { id: 'studio', label: 'AI Interview Panel', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', badge: 'Active', badgeColor: 'bg-indigo-500/20 text-indigo-300' },
  ];

  const currentTabInfo = sidebarItems.find(item => item.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex selection:bg-purple-500 selection:text-white">
      {/* Left Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900/90 border-r border-slate-800/80 backdrop-blur-xl shrink-0 transition-all duration-300 flex flex-col z-40 sticky top-0 h-screen`}>
        {/* Sidebar Header Logo */}
        <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-purple-500/20 shrink-0">
                Y
              </div>
              <span className="font-extrabold tracking-tight text-white text-base truncate">Candidate Portal</span>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer mx-auto"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
            </svg>
          </button>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {sidebarItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full px-3.5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer group ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-950/60'
                }`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <div className="flex items-center space-x-3 truncate">
                  <svg className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-purple-400 transition-colors'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isSidebarCollapsed && item.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                    item.badgeColor ? item.badgeColor : isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <img
                src={user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
              />
              {!isSidebarCollapsed && (
                <div className="text-left truncate">
                  <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
                  <p className="text-[10px] text-purple-400 truncate">Senior AI Engineer • Rank #1</p>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <button
                onClick={onSignOut}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all cursor-pointer shrink-0"
                title="Sign Out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-extrabold text-white tracking-tight">{currentTabInfo?.label}</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ✓ Verified Candidate Portal
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-400 hidden sm:inline">Active Application: <strong className="text-purple-300">Senior AI Backend Engineer</strong></span>
            <button
              onClick={() => setActiveTab('studio')}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-600/20 transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span>Enter AI Studio</span>
            </button>
          </div>
        </header>

        {/* Tab Content Rendering */}
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-300">
          
          {/* VIEW 1: MY PROFILE & APPLICATIONS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Profile Overview Card */}
              <div className="p-8 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center space-x-5">
                    <img
                      src={user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                      alt={user.name}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-500/50 shadow-xl"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-3">
                        <h2 className="text-2xl font-black text-white">{user.name}</h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                          ✓ Verified AI Specialist
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{user.email} • {user.experienceYears || 6} Years Experience</p>
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {(user.techStack || ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'LangGraph', 'PyTorch']).map((tech, i) => (
                          <span key={i} className="px-2.5 py-0.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-semibold text-purple-300">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setActiveTab('availability')}
                      className="px-5 py-3 rounded-2xl bg-slate-900 border border-slate-700 hover:border-purple-500/50 text-slate-200 font-bold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Update Availability</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('studio')}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>Launch AI Interview Studio</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Application & Match Score */}
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">Active Application Status</h3>
                    <p className="text-xs text-slate-400">Requisition: <strong className="text-slate-200">Senior AI Backend Engineer</strong> • Sourced via Discovery Agent</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-xs border border-emerald-500/30">
                      ★ Top Rank #1
                    </span>
                    <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-extrabold text-xs border border-purple-500/30">
                      96% Match Score
                    </span>
                  </div>
                </div>

                {/* 4-Step Pipeline Status Tracker */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                  {[
                    { step: "1. Resume Vectorized", status: "Completed", date: "July 06, 2026", done: true },
                    { step: "2. Assessment Match", status: "96% Top Rank", date: "July 06, 2026", done: true },
                    { step: "3. AI Studio Session", status: "Scheduled & Active", date: "July 10, 2026", done: true, active: true },
                    { step: "4. HR HITL Review", status: "In Progress", date: "Pending Final Approval", done: false }
                  ].map((s, idx) => (
                    <div
                      key={idx}
                      className={`p-5 rounded-2xl border transition-all ${
                        s.active ? 'bg-purple-500/10 border-purple-500/50 shadow-lg shadow-purple-500/10' :
                        s.done ? 'bg-slate-950/60 border-emerald-500/30' : 'bg-slate-950/30 border-slate-800/80 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-bold ${s.active ? 'text-purple-300' : s.done ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {s.step}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          s.active ? 'bg-purple-500/20 text-purple-300' : s.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{s.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: AVAILABILITY SCREEN */}
          {activeTab === 'availability' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                  <div>
                    <h2 className="text-2xl font-extrabold text-white flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
                      <span>Interview Availability & Scheduling Screen</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Set your preferred dates, time windows, and timezone. Your selections instantly sync with the **Interview Agent** to schedule your AI Studio sessions.
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    isAvailabilitySaved ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {isAvailabilitySaved ? '✓ Confirmed & Synced' : '● Unsaved Changes'}
                  </span>
                </div>

                <form onSubmit={handleSaveAvailability} className="space-y-6">
                  {/* Select Preferred Days */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-white block">1. Select Preferred Interview Days</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {daysOfWeek.map((day) => {
                        const isSelected = selectedDays.includes(day);
                        return (
                          <button
                            type="button"
                            key={day}
                            onClick={() => toggleDay(day)}
                            className={`p-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md shadow-purple-500/10'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <span>{day}</span>
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              isSelected ? 'bg-purple-500 text-white' : 'bg-slate-800 text-transparent'
                            }`}>
                              ✓
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Select Preferred Time Slots */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-white block">2. Select Preferred Time Windows</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {timeWindows.map((slot) => {
                        const isSelected = selectedSlots.includes(slot);
                        return (
                          <button
                            type="button"
                            key={slot}
                            onClick={() => toggleSlot(slot)}
                            className={`p-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/10'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <span>{slot}</span>
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-transparent'
                            }`}>
                              ✓
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Select Timezone */}
                  <div className="space-y-3 max-w-md">
                    <label className="text-sm font-bold text-white block">3. Confirm Your Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => { setTimezone(e.target.value); setIsAvailabilitySaved(false); }}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <option>EST (UTC-5) - Eastern Standard Time</option>
                      <option>PST (UTC-8) - Pacific Standard Time</option>
                      <option>UTC (UTC+0) - Coordinated Universal Time</option>
                      <option>CET (UTC+1) - Central European Time</option>
                      <option>IST (UTC+5:30) - Indian Standard Time</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDays(['Monday', 'Wednesday', 'Friday']);
                        setSelectedSlots(['Morning (09:00 - 12:00 EST)', 'Afternoon (13:00 - 17:00 EST)']);
                        setIsAvailabilitySaved(false);
                      }}
                      className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Reset to Default
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-purple-600/25 transition-all cursor-pointer active:scale-95"
                    >
                      Save Availability & Confirm AI Studio Slot
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* VIEW 3: AI INTERVIEW PANEL */}
          {activeTab === 'studio' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                  <div>
                    <h2 className="text-2xl font-extrabold text-white flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <span>AI Interview Panel & Studio Workspace</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Interactive technical assessment conducted by the **Interview Agent**. Evaluated in real-time with **Critic Agent Fairness Auditing**.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {interviewScore && (
                      <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-extrabold text-xs border border-indigo-500/30">
                        AI Score: {interviewScore}/10.0
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-xs border border-emerald-500/30 flex items-center space-x-1">
                      <span>✓ Critic Audit: 100% Fair</span>
                    </span>
                  </div>
                </div>

                {/* Chat Console */}
                <div className="bg-slate-950/80 rounded-3xl border border-slate-800/80 p-6 space-y-4 max-h-[420px] overflow-y-auto">
                  {messages.map((m, idx) => (
                    <div key={idx} className={`flex flex-col ${m.sender === 'candidate' ? 'items-end' : 'items-start'} space-y-1`}>
                      <div className="flex items-center space-x-2 px-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          {m.sender === 'ai' ? '🤖 YEN Interview Agent' : '👤 Alice Smith (Candidate)'}
                        </span>
                        <span className="text-[10px] text-slate-500">{m.timestamp}</span>
                      </div>
                      <div className={`p-4 rounded-2xl max-w-2xl text-xs leading-relaxed ${
                        m.sender === 'ai'
                          ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-md'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-none shadow-lg shadow-purple-600/20'
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {isSynthesizing && (
                    <div className="flex items-center space-x-2 text-xs text-purple-400 font-mono animate-pulse pl-2">
                      <span>🤖 Interview Agent is analyzing response & running Critic fairness audit...</span>
                    </div>
                  )}
                </div>

                {/* Response Input */}
                <form onSubmit={handleSendMessage} className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      placeholder="Type your technical response here... (e.g., Explain LangGraph state checkpointers)"
                      disabled={isSynthesizing}
                      className="flex-1 px-5 py-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!currentInput.trim() || isSynthesizing}
                      className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      Submit Response
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Tip: You can use sample answers to quickly test the AI evaluation engine.</span>
                    <button
                      type="button"
                      onClick={() => setCurrentInput("When an agent node crashes in LangGraph, the PostgreSQL checkpointer restores the exact state dictionary from the last checkpoint. This allows retry handlers or fallback nodes to resume execution without re-running previous LLM calls or losing vector context.")}
                      className="text-purple-400 hover:text-purple-300 font-semibold underline cursor-pointer"
                    >
                      ⚡ Use Sample Technical Answer
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};
