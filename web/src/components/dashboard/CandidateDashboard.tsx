/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect } from 'react';
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
  const [selectedSlots, setSelectedSlots] = useState<string[]>(user.availability?.timeSlots || ['Morning (09:00 - 12:00 IST)', 'Afternoon (13:00 - 17:00 IST)']);
  const [timezone, setTimezone] = useState<string>(user.availability?.timezone || 'IST (UTC+5:30) - Indian Standard Time');
  const [isAvailabilitySaved, setIsAvailabilitySaved] = useState<boolean>(user.availability?.isConfirmed || false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
  };

  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    phone: string;
    experience: number;
    status: string;
    role: string;
    skills: string[];
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // AI Interview Studio State
  const [messages, setMessages] = useState<{ sender: 'ai' | 'candidate'; text: string; timestamp: string }[]>([
    {
      sender: 'ai',
      text: "Hello! I am the YEN AI Interview Agent. Congratulations on progressing to the technical interview stage! Today, we will explore your technical experience. Are you ready to begin your assessment?",
      timestamp: "10:00 AM"
    }
  ]);
  const [currentInput, setCurrentInput] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [interviewScore, setInterviewScore] = useState<number | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('yen_access_token');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${apiUrl}/api/v1/recruitment/candidate/profile`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && data.profile) {
            setProfile(data.profile);
            
            // Check if availability has been confirmed in database
            if (data.profile.interviewDate && data.profile.interviewDate !== "Awaiting slot") {
              setIsAvailabilitySaved(true);
            } else {
              setIsAvailabilitySaved(false);
            }
            
            // Populate dynamic welcome message based on parsed candidate details
            const name = data.profile.name || user.name;
            const role = data.profile.role || "AI Specialist";
            const skills = (data.profile.skills && data.profile.skills.length > 0)
              ? data.profile.skills.slice(0, 3).join(', ')
              : "Python, FastAPI, and LangGraph";
              
            setMessages([
              {
                sender: 'ai',
                text: `Hello ${name}! I am the YEN AI Interview Agent. Congratulations on progressing to the technical interview stage for the ${role} role! Today, we will explore your technical experience with ${skills}. Are you ready to begin your assessment?`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          }
        }
      } catch (err) {
        console.error("Failed to load candidate profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [user.name]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const timeWindows = [
    'Morning (09:00 - 12:00 IST)',
    'Afternoon (13:00 - 17:00 IST)',
    'Evening (18:00 - 21:00 IST)'
  ];

  const toggleDay = (day: string) => {
    setIsAvailabilitySaved(false);
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const toggleSlot = (slot: string) => {
    setIsAvailabilitySaved(false);
    setSelectedSlots(prev => prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]);
  };

  const handleSaveAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('yen_access_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiUrl}/api/v1/recruitment/candidate/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          days: selectedDays,
          time_slots: selectedSlots,
          timezone: timezone
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setIsAvailabilitySaved(true);
        showToast("✓ Availability Preferences Saved! Your slot is confirmed & synced with HR.", "success");
      } else {
        showToast(data.detail || "Failed to save availability preferences.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Connection error — could not sync availability with server.", "error");
    }
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
        text: "That is an outstanding response! Using PostgreSQL checkpointers to persist thread state at each node boundary ensures zero data loss, and wrapping tool invocations in retry policies is industry best practice. I have recorded your response. Let's move on to our next architectural topic!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsSynthesizing(false);
    }, 1500);
  };

  const sidebarItems: { id: CandidateTab; label: string; icon: string; badge?: string; badgeColor?: string }[] = [
    { id: 'overview', label: 'My Profile & Applications', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', badge: 'Active Stage 3', badgeColor: 'bg-purple-500/20 text-purple-300' },
    { id: 'availability', label: 'Availability Screen', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', badge: isAvailabilitySaved ? 'Confirmed' : 'Pending', badgeColor: isAvailabilitySaved ? 'bg-purple-500/20 text-purple-300' : 'bg-amber-500/20 text-amber-300' },
    { id: 'studio', label: 'AI Interview Panel', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', badge: 'In Progress', badgeColor: 'bg-indigo-500/20 text-indigo-300' },
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
                  <p className="text-xs font-bold text-slate-200 truncate">{profile?.name || user.name}</p>
                  <p className="text-[10px] text-purple-400 truncate">{profile?.role || "Senior AI Backend Engineer"}</p>
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
            <span className="text-xs text-slate-400 hidden sm:inline">Active Application: <strong className="text-purple-300">{profile?.role || "Senior AI Backend Engineer"}</strong></span>
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
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Clean Profile Hero Card */}
              <div className="p-6 md:p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <img
                    src={user.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                    alt={user.name}
                    className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border border-purple-500/40 shadow-xl shrink-0"
                  />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-2xl font-black text-white tracking-tight">{profile?.name || user.name}</h2>
                      <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center space-x-1">
                        <span>✓ Verified AI Specialist</span>
                      </span>
                      <span className="px-3 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                        Job Title: {profile?.role || "Senior AI Backend Engineer"}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-300 flex flex-wrap items-center gap-2">
                      <span>📧 {profile?.email || user.email}</span>
                      <span className="text-slate-600">•</span>
                      <span>⏱️ {profile?.experience !== undefined ? profile.experience : 6}+ Years Experience</span>
                      <span className="text-slate-600">•</span>
                      <span>📍 Remote (IST / UTC+5:30)</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-400 font-bold mr-1">Verified Tech Stack:</span>
                      {(profile?.skills && profile.skills.length > 0 ? profile.skills : ['Python Asyncio', 'FastAPI', 'PostgreSQL', 'Docker', 'LangGraph', 'PyTorch']).map((tech, i) => (
                        <span key={i} className="px-2.5 py-0.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs font-semibold text-purple-300">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0 self-stretch md:self-center border-t md:border-t-0 pt-4 md:pt-0 border-slate-800/80">
                  <button
                    onClick={() => setActiveTab('studio')}
                    className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/25 transition-all cursor-pointer active:scale-95 flex items-center justify-center space-x-2"
                  >
                    <span>Launch AI Interview Panel</span>
                    <span className="text-sm">▶</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('availability')}
                    className="px-5 py-2.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <span>Update Availability Preferences</span>
                  </button>
                </div>
              </div>

              {/* 2-Column Grid: Pipeline Tracker (2 Cols) + Preparation Guidelines (1 Col) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left: Application & Interview Progress Tracker */}
                <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                        <span>🚀 Application & Interview Progress</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Job Title: <strong className="text-purple-300">{profile?.role || "Senior AI Backend Engineer"}</strong>
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-purple-500/15 text-purple-300 text-xs font-mono font-bold border border-purple-500/30 self-start sm:self-center">
                      Interview Stage 3 Active
                    </span>
                  </div>

                  {/* Clean, Minimized Vertical Progress Timeline without internal descriptions */}
                  <div className="space-y-2.5">
                    {[
                      {
                        stepNumber: "01",
                        title: "Application & Profile Submitted",
                        status: "Completed",
                        date: "July 06, 2026",
                        state: "completed"
                      },
                      {
                        stepNumber: "02",
                        title: "Initial Profile Assessment & Screening",
                        status: "Qualified ✓",
                        date: "July 06, 2026",
                        state: "completed"
                      },
                      {
                        stepNumber: "03",
                        title: "Autonomous AI Interview Studio Session",
                        status: "Active Session",
                        date: "In Progress",
                        state: "active"
                      },
                      {
                        stepNumber: "04",
                        title: "HR Final Review & Next Steps",
                        status: "Upcoming",
                        date: "Pending Stage 3",
                        state: "pending"
                      }
                    ].map((step, idx) => (
                      <div
                        key={idx}
                        className={`py-2.5 px-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          step.state === 'active'
                            ? 'bg-gradient-to-r from-purple-900/30 to-slate-900/90 border-purple-500/50 shadow-sm shadow-purple-500/10'
                            : step.state === 'completed'
                            ? 'bg-slate-950/40 border-emerald-500/30'
                            : 'bg-slate-950/20 border-slate-800/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 border ${
                            step.state === 'active'
                              ? 'bg-purple-600 text-white border-purple-400'
                              : step.state === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          }`}>
                            {step.state === 'completed' ? '✓' : step.stepNumber}
                          </div>
                          <h4 className={`text-xs font-bold ${step.state === 'active' ? 'text-white' : step.state === 'completed' ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {step.title}
                          </h4>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                            step.state === 'active'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : step.state === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800/80 text-slate-500'
                          }`}>
                            {step.status}
                          </span>
                          <span className="text-[10px] text-slate-500 min-w-[70px] text-right">{step.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Interview Guidelines & Preparation Checklist */}
                <div className="p-6 md:p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-6">
                  <div className="border-b border-slate-800/80 pb-5">
                    <h3 className="text-lg font-extrabold text-white flex items-center justify-between">
                      <span>📋 Interview Preparation</span>
                      <span className="text-xs font-mono text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/20">
                        Stage 3 Active
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Guidelines and tips for your upcoming AI technical assessment.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {[
                      { title: "Technical Topics & Scope", desc: "Be prepared to discuss asynchronous Python architectures, LangGraph checkpointers, and PostgreSQL database indexing." },
                      { title: "Assessment Format", desc: "Interactive conversational dialogue. You can speak naturally or type out architectural explanations." },
                      { title: "Flexible Scheduling", desc: "You have complete control over your schedule. Update your availability anytime from the Availability screen." },
                      { title: "Support & Assistance", desc: "Need accommodations or technical support? Reach out to our team at candidate-support@ai-universe.dev." }
                    ].map((guide, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                        <h4 className="text-xs font-bold text-purple-300">{guide.title}</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{guide.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('studio')}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition-all cursor-pointer flex items-center justify-center space-x-2"
                    >
                      <span>Enter AI Interview Studio →</span>
                    </button>
                  </div>
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
                      Set your preferred dates and time windows (IST). Your selections instantly sync with the **Interview Agent** to schedule your AI Studio sessions.
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


                  <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDays(['Monday', 'Wednesday', 'Friday']);
                        setSelectedSlots(['Morning (09:00 - 12:00 IST)', 'Afternoon (13:00 - 17:00 IST)']);
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
                      Interactive technical & architectural assessment conducted by the **Interview Agent**.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-extrabold text-xs border border-purple-500/30">
                      ● Active Assessment Stage
                    </span>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-xs border border-emerald-500/30 flex items-center space-x-1">
                      <span>✓ Verified AI Interviewer</span>
                    </span>
                  </div>
                </div>

                {/* Chat Console */}
                <div className="bg-slate-950/80 rounded-3xl border border-slate-800/80 p-6 space-y-4 max-h-[420px] overflow-y-auto">
                  {messages.map((m, idx) => (
                    <div key={idx} className={`flex flex-col ${m.sender === 'candidate' ? 'items-end' : 'items-start'} space-y-1`}>
                      <div className="flex items-center space-x-2 px-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          {m.sender === 'ai' ? '🤖 YEN Interview Agent' : `👤 ${profile?.name || user.name} (Candidate)`}
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
                      onClick={() => setCurrentInput("When an agent node crashes in LangGraph, the PostgreSQL checkpointer restores the exact state dictionary from the last checkpoint. This allows retry handlers or fallback nodes to resume execution without re-running previous LLM calls or losing candidate context.")}
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

      {/* Dynamic Toast Notification Panel */}
      {toast.visible && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-6 duration-300 pointer-events-none">
          <div className={`p-4 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center space-x-3.5 max-w-sm ${
            toast.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
              : 'bg-red-950/80 border-red-500/30 text-red-200'
          }`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {toast.type === 'success' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="text-xs font-bold leading-relaxed">{toast.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};
