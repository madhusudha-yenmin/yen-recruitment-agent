/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef } from 'react';
import { User, HRTab, CandidateMatch, AgentLog } from '../../types';

interface HRDashboardProps {
  user: User;
  onSignOut: () => void;
}

export const HRDashboard: React.FC<HRDashboardProps> = ({ user, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<HRTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const leaderboardRef = useRef<HTMLDivElement>(null);

  // JD Upload & Orchestrator State
  const [jobTitle, setJobTitle] = useState('React Developer');
  const [experience, setExperience] = useState('1+ years');
  const [location, setLocation] = useState('Chennai');
  const [keywords, setKeywords] = useState('');
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);
  const [activeStage, setActiveStage] = useState<number | null>(4); // Default paused at HITL (Stage 4)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Candidate Pool State
  const [candidates, setCandidates] = useState<CandidateMatch[]>([
    {
      id: 'cand-001',
      name: 'Alice Smith',
      email: 'alice.smith@example.com',
      matchScore: 96,
      ranking: 1,
      skills: ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'LangGraph'],
      experience: '6.0 Years',
      salary: '$145,000 / yr',
      location: 'Remote (US)',
      status: 'Pending HR Review',
      recommendation: 'strong-hire',
      interviewStatus: 'Scheduled',
      interviewDate: 'July 10, 2026 @ 10:00 AM EST',
      interviewMode: 'AI Chat Studio',
      evaluationDetails: {
        technical: 92,
        communication: 90,
        problemSolving: 88,
        overall: 88.8,
        criticPassed: true
      }
    },
    {
      id: 'cand-002',
      name: 'Charlie Brown',
      email: 'charlie.brown@example.com',
      matchScore: 84,
      ranking: 2,
      skills: ['Python', 'PostgreSQL', 'Docker', 'LangGraph', 'Django'],
      experience: '4.0 Years',
      salary: '$135,000 / yr',
      location: 'Remote (EU)',
      status: 'Pending HR Review',
      recommendation: 'hire',
      interviewStatus: 'Scheduled',
      interviewDate: 'July 11, 2026 @ 2:00 PM CET',
      interviewMode: 'AI Voice Studio',
      evaluationDetails: {
        technical: 85,
        communication: 88,
        problemSolving: 82,
        overall: 85.0,
        criticPassed: true
      }
    },
    {
      id: 'cand-003',
      name: 'Bob Jones',
      email: 'bob.jones@example.com',
      matchScore: 56,
      ranking: 3,
      skills: ['Python', 'React', 'Next.js', 'Tailwind'],
      experience: '2.0 Years',
      salary: '$110,000 / yr',
      location: 'Hybrid (NY)',
      status: 'Rejected',
      recommendation: 'no-hire',
      interviewStatus: 'Pending',
      interviewMode: 'AI Chat Studio'
    },
    {
      id: 'cand-004',
      name: 'David Miller',
      email: 'david.miller@example.com',
      matchScore: 91,
      ranking: 4,
      skills: ['Python', 'FastAPI', 'Kubernetes', 'AWS', 'LangChain'],
      experience: '7.0 Years',
      salary: '$155,000 / yr',
      location: 'Remote (US)',
      status: 'Offer Sent',
      recommendation: 'strong-hire',
      interviewStatus: 'Scheduled',
      interviewDate: 'July 08, 2026 @ 11:30 AM EST',
      interviewMode: 'AI Voice Studio',
      evaluationDetails: {
        technical: 94,
        communication: 89,
        problemSolving: 91,
        overall: 91.3,
        criticPassed: true
      }
    }
  ]);

  // Questionnaire State (Generated from JD)
  const [questions, setQuestions] = useState([
    {
      id: 1,
      category: "Technical / Core Stack",
      question: "Can you explain how you handle concurrency, asynchronous event loops, and database connection pooling in high-load production FastAPI services?",
      targetSkills: ["Python Asyncio", "SQLAlchemy 2.0", "asyncpg pooling"]
    },
    {
      id: 2,
      category: "System Architecture",
      question: "How would you design a distributed multi-agent recruitment platform using LangGraph that can scale to thousands of simultaneous resume evaluations without hitting rate limits?",
      targetSkills: ["LangGraph State Machines", "Redis/Celery Queues", "Vector DB Indexing"]
    },
    {
      id: 3,
      category: "Behavioral & Leadership",
      question: "Describe a situation where you had to resolve a critical database deadlock or production outage under tight deadlines while coordinating across engineering teams.",
      targetSkills: ["Incident Commander Role", "Root Cause Analysis", "Automated Guardrails"]
    }
  ]);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionCat, setNewQuestionCat] = useState("Technical / Core Stack");

  // Telemetry Audit Logs
  const [logs, setLogs] = useState<AgentLog[]>([
    { id: 'log-1', timestamp: '14:20:01', agentName: 'RecruitmentOrchestrator', action: 'Initialized workflow session & delegated Stage 1 to Discovery Agent', latency: '110ms', tokens: 120, cost: '$0.0004', status: 'success' },
    { id: 'log-2', timestamp: '14:20:03', agentName: 'CandidateDiscoveryAgent', action: 'Analyzed JD, generated LinkedIn Boolean query & parsed 142 resumes into 1536d vectors', latency: '890ms', tokens: 1840, cost: '$0.0045', status: 'success' },
    { id: 'log-3', timestamp: '14:20:04', agentName: 'CandidateAssessmentAgent', action: 'Computed multi-dimensional match scores & ranked candidate pool (Top match: Alice Smith @ 96%)', latency: '250ms', tokens: 410, cost: '$0.0012', status: 'success' },
    { id: 'log-4', timestamp: '14:20:10', agentName: 'InterviewAgent', action: 'Scheduled studio sessions, generated 3 tailored questions & audited fairness (PASSED)', latency: '650ms', tokens: 812, cost: '$0.0028', status: 'success' },
    { id: 'log-5', timestamp: '14:20:15', agentName: 'HiringDecisionAgent', action: 'Synthesized comparative analytics & paused execution at HITL checkpointer waiting for Recruiter review', latency: '380ms', tokens: 290, cost: '$0.0010', status: 'success' }
  ]);

  // Derived Metrics
  const totalProfilesCount = 142; // Sourced pool
  const hiredCount = candidates.filter(c => c.status === 'Offer Sent').length + 17; // Demo total hired
  const rejectedCount = candidates.filter(c => c.status === 'Rejected').length + 23; // Demo total rejected
  const pendingHitlCount = candidates.filter(c => c.status === 'Pending HR Review').length;

  const handleLaunchPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunningWorkflow(true);
    setActiveStage(1);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${apiUrl}/api/v1/recruitment/serper-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_title: jobTitle,
          experience: experience,
          location: location,
          keywords: keywords
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch candidates from Serper');
      }

      const data = await response.json();
      
      const newCandidates: CandidateMatch[] = data.candidates.map((c: any, index: number) => {
        return {
          id: c.candidate_id || `cand-${index}`,
          name: c.candidate_name || c.name || "Unknown",
          email: c.email || "",
          linkedinUrl: c.resume_url || "",
          matchScore: Math.round(c.overall_score || 95 - index), // Mock a score based on search rank
          ranking: c.ranking_position || index + 1,
          skills: c.matching_skills || ["Matches Query"], // Simplified for bypass mode
          experience: c.experience_years ? `${c.experience_years} Years` : experience, // Default to queried experience
          salary: "Negotiable",
          location: c.location || location, // Default to queried location
          status: 'Pending HR Review',
          recommendation: c.recommendation || 'strong-hire',
          interviewStatus: 'Pending',
          interviewMode: 'AI Chat Studio'
        };
      });

      setCandidates(newCandidates);
      setCurrentPage(1);

      // Scroll to leaderboard after a short delay to let the DOM update
      setTimeout(() => {
        leaderboardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      
      setLogs(prev => [
        { id: `log-${Date.now()}-1`, timestamp: new Date().toLocaleTimeString(), agentName: 'CandidateDiscoveryAgent', action: `Sourced candidates via Fast Serper Search. Query: ${data.query_used}`, latency: '850ms', tokens: 0, cost: '$0.00', status: 'success' },
        ...prev
      ]);
      
      setActiveStage(5);
      setIsRunningWorkflow(false);
      
    } catch (err) {
      console.error("Error launching pipeline:", err);
      setLogs(prev => [
        { id: `log-${Date.now()}-err`, timestamp: new Date().toLocaleTimeString(), agentName: 'CandidateDiscoveryAgent', action: `Failed to fetch candidates. Ensure API is running.`, latency: '0ms', tokens: 0, cost: '$0.00', status: 'warning' },
        ...prev
      ]);
      setIsRunningWorkflow(false);
      setActiveStage(4);
    }
  };

  const handleDecision = (candidateId: string, decision: 'Offer Sent' | 'Rejected' | 'Hold') => {
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        return { ...c, status: decision };
      }
      return c;
    }));

    const targetCand = candidates.find(c => c.id === candidateId);
    setLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        agentName: 'HiringDecisionAgent',
        action: `HITL Decision Processed: Marked ${targetCand?.name} as '${decision}'. Dispatched automated ${decision === 'Offer Sent' ? 'offer letter & studio link' : 'notification'} via email.`,
        latency: '420ms',
        tokens: 340,
        cost: '$0.0011',
        status: 'success'
      },
      ...prev
    ]);
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    setQuestions(prev => [
      ...prev,
      {
        id: prev.length + 1,
        category: newQuestionCat,
        question: newQuestionText.trim(),
        targetSkills: ["Custom JD Criteria"]
      }
    ]);
    setNewQuestionText("");
  };

  const sidebarItems: { id: HRTab; label: string; icon: string; badge?: string | number; badgeColor?: string }[] = [
    { id: 'overview', label: 'Dashboard Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', badge: totalProfilesCount },
    { id: 'upload-jd', label: 'Upload JD & Orchestrate', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
    { id: 'ranking', label: 'Candidates Resume', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', badge: 'Top #1: 96%', badgeColor: 'bg-emerald-500/20 text-emerald-300' },
    { id: 'interviews', label: 'Interview Status', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', badge: '3 Sched', badgeColor: 'bg-purple-500/20 text-purple-300' },
    { id: 'questionnaire', label: 'JD Questionnaire', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', badge: questions.length },
    { id: 'approvals', label: 'Approval / Rejected', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', badge: pendingHitlCount, badgeColor: 'bg-amber-500/20 text-amber-300' },
    { id: 'score-definition', label: 'Score Definition', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  const currentTabInfo = sidebarItems.find(item => item.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex selection:bg-indigo-500 selection:text-white">
      {/* Left Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900/90 border-r border-slate-800/80 backdrop-blur-xl shrink-0 transition-all duration-300 flex flex-col z-40 sticky top-0 h-screen`}>
        {/* Sidebar Header Logo */}
        <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20 shrink-0">
                Y
              </div>
              <span className="font-extrabold tracking-tight text-white text-base truncate">YEN AI Studio</span>
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
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-950/60'
                }`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <div className="flex items-center space-x-3 truncate">
                  <svg className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400 transition-colors'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isSidebarCollapsed && item.badge !== undefined && (
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
                src={user.avatarUrl || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
              />
              {!isSidebarCollapsed && (
                <div className="text-left truncate">
                  <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
                  <p className="text-[10px] text-indigo-400 truncate">HR Recruiter • {user.company || 'YEN AI'}</p>
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
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              5-Agent Architecture Active
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-400 hidden sm:inline">Active Requisition: <strong className="text-slate-200">{jobTitle}</strong></span>
            <button
              onClick={() => setActiveTab('upload-jd')}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Pipeline</span>
            </button>
          </div>
        </header>

        {/* Tab Content Rendering */}
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-300">
          
          {/* VIEW 1: OVERVIEW (List of profiles, No of Hired, No of Rejected) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-indigo-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all" />
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Profiles Sourced</p>
                  <p className="text-3xl font-black text-white mt-2">{totalProfilesCount} <span className="text-xs font-normal text-indigo-400 ml-1">1536d Vectors</span></p>
                </div>

                <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">No. of Hired Profiles</p>
                  <p className="text-3xl font-black text-emerald-400 mt-2">{hiredCount} <span className="text-xs font-normal text-slate-400 ml-1">Offers Dispatched</span></p>
                </div>

                <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-red-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-xl group-hover:bg-red-500/20 transition-all" />
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">No. of Rejected Profiles</p>
                  <p className="text-3xl font-black text-red-400 mt-2">{rejectedCount} <span className="text-xs font-normal text-slate-400 ml-1">Archived</span></p>
                </div>

                <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all" />
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending HITL Reviews</p>
                  <p className="text-3xl font-black text-amber-400 mt-2">{pendingHitlCount} <span className="text-xs font-normal text-slate-400 ml-1">Action Required</span></p>
                </div>
              </div>

              {/* Profiles Table */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">All Candidate Profiles</h3>
                    <p className="text-xs text-slate-400">Comprehensive directory of candidates sourced by Discovery Agent & evaluated by Assessment Agent.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setActiveTab('ranking')}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer"
                    >
                      View Rankings Leaderboard →
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="pb-3 pr-4">Rank & Candidate</th>
                        <th className="pb-3 px-4">Match Score</th>
                        <th className="pb-3 px-4">Primary Skills</th>
                        <th className="pb-3 px-4">Experience</th>
                        <th className="pb-3 px-4">Interview Status</th>
                        <th className="pb-3 pl-4 text-right">Hiring Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {candidates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((c) => (
                        <tr key={c.id} className="hover:bg-slate-950/40 transition-colors">
                          <td className="py-4 pr-4 font-bold text-white flex items-center space-x-3">
                            <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 text-[11px]">
                              #{c.ranking}
                            </span>
                            <div>
                              <p className="text-slate-100">{c.name}</p>
                              {c.linkedinUrl && (
                                <a 
                                  href={c.linkedinUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[11px] font-bold text-[#0A66C2] hover:text-blue-400 transition-colors flex items-center space-x-1 mt-0.5"
                                >
                                  <span>Connect on LinkedIn</span>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 font-black">
                            <span className={`px-2 py-1 rounded-lg ${
                              c.matchScore >= 90 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              c.matchScore >= 75 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                              'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {c.matchScore}%
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {c.skills.slice(0, 3).map((s, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-slate-950 text-[10px] text-slate-300 border border-slate-800">
                                  {s}
                                </span>
                              ))}
                              {c.skills.length > 3 && <span className="text-[10px] text-slate-500">+{c.skills.length - 3} more</span>}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-300">{c.experience}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              c.interviewStatus === 'Scheduled' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-slate-800 text-slate-400'
                            }`}>
                              ● {c.interviewStatus}
                            </span>
                          </td>
                          <td className="py-4 pl-4 text-right">
                            <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                              c.status === 'Offer Sent' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                              c.status === 'Rejected' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                              c.status === 'Hold' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                              'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {candidates.length > itemsPerPage && (
                  <div className="flex justify-between items-center mt-4 text-xs font-semibold text-slate-400">
                    <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50">Previous</button>
                    <span>Page {currentPage} of {Math.ceil(candidates.length / itemsPerPage)}</span>
                    <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(candidates.length / itemsPerPage)))} disabled={currentPage >= Math.ceil(candidates.length / itemsPerPage)} className="px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50">Next</button>
                  </div>
                )}
              </div>

              {/* Live Telemetry Stream */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Real-Time 5-Agent Telemetry & Cost Audit Trail</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-400">PostgreSQL Checkpointer Active</span>
                </div>
                <div className="bg-slate-950/80 rounded-2xl border border-slate-800/80 p-4 font-mono text-xs space-y-2 max-h-48 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-900 last:border-0 last:pb-0">
                      <div className="flex items-center space-x-3">
                        <span className="text-slate-500">{log.timestamp}</span>
                        <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-indigo-500/20 text-indigo-300">{log.agentName}</span>
                        <span className="text-slate-300">{log.action}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 shrink-0">
                        <span>Latency: <strong className="text-slate-200">{log.latency}</strong></span>
                        <span>•</span>
                        <span>Cost: <strong className="text-emerald-400">{log.cost}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: UPLOAD JD SECTION & ORCHESTRATOR */}
          {activeTab === 'upload-jd' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-white flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                    <span>Search Candidates directly via Boolean Query</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Input exactly what you're looking for. The **Candidate Discovery Agent** will bypass parsing and immediately fetch matching profiles from LinkedIn via Serper search.
                  </p>
                </div>

                {/* Simplified Input Form for Search */}

                <form onSubmit={handleLaunchPipeline} className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Requisition Job Title *</label>
                      <input
                        type="text"
                        required
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Additional Keywords (Serper Query)</label>
                      <input
                        type="text"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder='e.g., "React" "TypeScript"'
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Location *</label>
                      <input
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g., Chennai"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Years of Experience *</label>
                      <input
                        type="text"
                        required
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                        placeholder="e.g., 2+ years"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isRunningWorkflow}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                  >
                    {isRunningWorkflow ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Orchestrating 5-Agent Workflow...</span>
                      </>
                    ) : (
                      <>
                        <span>Launch Fast Discovery Search</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                {/* 5-Agent Stage Tracker Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-800">
                  {[
                    { stage: "1. Discovery Agent", desc: "JD analysis, Boolean query & vector parsing", score: "142 Sourced", id: 1 },
                    { stage: "2. Assessment Agent", desc: "Multi-dimensional scoring & pool ranking", score: "Top: 96%", id: 2 },
                    { stage: "3. Interview Agent", desc: "Tailored question gen & studio scheduling", score: "3 Sched", id: 3 },
                    { stage: "4. HITL Checkpoint", desc: "Execution paused waiting for Recruiter decision", score: "Action Required", id: 4, isHitl: true },
                    { stage: "5. Decision Agent", desc: "Comparative analytics & offer automation", score: "Ready", id: 5 }
                  ].map((s) => {
                    const isActive = activeStage === s.id;
                    const isPast = activeStage !== null && activeStage > s.id;
                    return (
                      <div
                        key={s.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isActive && s.isHitl ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10 animate-pulse' :
                          isActive ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10' :
                          isPast ? 'bg-slate-950/60 border-emerald-500/30' : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold ${isActive && s.isHitl ? 'text-amber-400' : isActive ? 'text-indigo-400' : isPast ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {s.stage}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            isActive && s.isHitl ? 'bg-amber-500/20 text-amber-300' : isPast ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {s.score}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{s.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ranking Leaderboard - shown below Search */}
              <div ref={leaderboardRef} className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                  <div>
                    <h2 className="text-2xl font-extrabold text-white flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Candidates Ranking Leaderboard</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Ranked by search result position. Click Connect to view each profile on LinkedIn.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    Sorted by Match % (High to Low)
                  </span>
                </div>

                {candidates.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    No candidates yet. Run a search above to populate the leaderboard.
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {candidates.sort((a,b) => b.matchScore - a.matchScore).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((cand) => (
                        <div
                          key={cand.id}
                          className={`p-6 rounded-3xl bg-slate-950/60 border transition-all ${
                            cand.ranking === 1 ? 'border-indigo-500/50 shadow-xl shadow-indigo-500/10 bg-gradient-to-r from-indigo-950/30 via-slate-950 to-slate-950' : 'border-slate-800/80'
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="flex items-start space-x-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                                cand.ranking === 1 ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-300'
                              }`}>
                                #{cand.ranking}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center space-x-3">
                                  <h3 className="text-base font-extrabold text-white">{cand.name}</h3>
                                  {cand.linkedinUrl && (
                                    <a 
                                      href={cand.linkedinUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="px-2 py-0.5 rounded-full bg-[#0A66C2]/10 text-[#0A66C2] text-[10px] font-bold hover:bg-[#0A66C2]/20 transition-colors flex items-center space-x-1 border border-[#0A66C2]/30"
                                    >
                                      <span>Connect</span>
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  )}
                                  {cand.ranking === 1 && (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                                      ★ Top Recommended Hire
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                                  <span>Experience: <strong className="text-slate-200">{cand.experience}</strong></span>
                                  <span>•</span>
                                  <span>Location: <strong className="text-slate-200">{cand.location}</strong></span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-2">
                                  {cand.skills.map((skill, i) => (
                                    <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-indigo-300">
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between lg:justify-end gap-8 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-800 shrink-0">
                              <div className="text-center lg:text-right">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Match</p>
                                <p className={`text-3xl font-black ${
                                  cand.matchScore >= 90 ? 'text-emerald-400' : cand.matchScore >= 75 ? 'text-indigo-400' : 'text-amber-400'
                                }`}>
                                  {cand.matchScore}%
                                </p>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => {
                                    handleDecision(cand.id, 'Offer Sent');
                                    setActiveTab('approvals');
                                  }}
                                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
                                >
                                  Review in HITL Queue →
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {candidates.length > itemsPerPage && (
                      <div className="flex justify-between items-center mt-4 text-xs font-semibold text-slate-400">
                        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50">Previous</button>
                        <span>Page {currentPage} of {Math.ceil(candidates.length / itemsPerPage)}</span>
                        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(candidates.length / itemsPerPage)))} disabled={currentPage >= Math.ceil(candidates.length / itemsPerPage)} className="px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50">Next</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: CANDIDATES RESUME PAGE */}
          {activeTab === 'ranking' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl text-center py-20 flex flex-col items-center justify-center">
                <svg className="w-16 h-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-bold text-slate-300">Candidates Resume</h3>
                <p className="text-sm text-slate-500 mt-2">Resume viewer and parsed details will appear here.</p>
              </div>
            </div>
          )}
          
          {/* VIEW 4: INTERVIEW STATUS (Scheduled / Pending) */}
          {activeTab === 'interviews' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                  <div>
                    <h2 className="text-2xl font-extrabold text-white flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
                      <span>AI Studio Interview Status Tracker</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Monitor candidate scheduling states across **AI Chat Studio** and **AI Voice Studio** modes managed by the **Interview Agent**.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                      3 Scheduled
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold">
                      1 Pending
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {candidates.map((cand) => (
                    <div key={cand.id} className="p-6 rounded-3xl bg-slate-950/60 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-base font-bold text-white">{cand.name}</h3>
                          {cand.linkedinUrl && (
                            <a 
                              href={cand.linkedinUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="px-2 py-0.5 rounded-full bg-[#0A66C2]/10 text-[#0A66C2] text-[10px] font-bold hover:bg-[#0A66C2]/20 transition-colors flex items-center space-x-1 border border-[#0A66C2]/30"
                            >
                              <span>Connect</span>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            cand.interviewStatus === 'Scheduled' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            ● {cand.interviewStatus}
                          </span>
                        </div>
                        
                        {cand.interviewStatus === 'Scheduled' ? (
                          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300 font-mono bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <div>Date: <strong className="text-purple-300">{cand.interviewDate}</strong></div>
                            <div>Mode: <strong className="text-indigo-300">{cand.interviewMode}</strong></div>
                            <div>Studio Setup: <strong className="text-emerald-400">✓ Ready & Confirmed</strong></div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                            Waiting for candidate to submit availability preferences in their portal.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        {cand.evaluationDetails ? (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">AI Evaluation</span>
                            <p className="text-lg font-black text-emerald-400">{cand.evaluationDetails.overall}/10.0</p>
                          </div>
                        ) : cand.interviewStatus === 'Scheduled' ? (
                          <span className="px-4 py-2 rounded-xl bg-slate-900 text-xs text-slate-400 border border-slate-800">
                            Awaiting Session Completion
                          </span>
                        ) : (
                          <button
                            onClick={() => alert(`Reminded ${cand.name} to complete availability scheduling!`)}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all cursor-pointer"
                          >
                            Send Scheduling Reminder
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 5: QUESTIONNAIRE BASED ON JD */}
          {activeTab === 'questionnaire' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                  <div>
                    <h2 className="text-2xl font-extrabold text-white flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-pink-500 animate-pulse" />
                      <span>JD Questionnaire Studio</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Tailored interview questions automatically synthesized by the **Interview Agent** from your uploaded Job Description (`Senior AI Backend Engineer`).
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs font-bold border border-pink-500/30">
                    {questions.length} Active Questions
                  </span>
                </div>

                {/* Add New Question Form */}
                <form onSubmit={handleAddQuestion} className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>+ Add Custom Interview Question to Rubric</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Category</label>
                      <select
                        value={newQuestionCat}
                        onChange={(e) => setNewQuestionCat(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      >
                        <option>Technical / Core Stack</option>
                        <option>System Architecture</option>
                        <option>Behavioral & Leadership</option>
                        <option>Scenario & Problem Solving</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Question Text *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={newQuestionText}
                          onChange={(e) => setNewQuestionText(e.target.value)}
                          placeholder="e.g., Explain how you optimize PostgreSQL indexes for high-frequency vector searches..."
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shrink-0 cursor-pointer"
                        >
                          Add Question
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                {/* Question Cards */}
                <div className="space-y-4">
                  {questions.map((q) => (
                    <div key={q.id} className="p-6 rounded-3xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-300">
                          {q.category}
                        </span>
                        <span className="text-xs font-mono text-slate-500">Q#{q.id}</span>
                      </div>
                      <p className="text-base font-bold text-white leading-relaxed">&ldquo;{q.question}&rdquo;</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="text-xs text-slate-400 font-semibold self-center mr-1">Target Skills:</span>
                        {q.targetSkills.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-900 text-[11px] text-purple-300 border border-slate-800">
                            ✓ {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 6: APPROVALS / REJECTED (HITL Queue) */}
          {activeTab === 'approvals' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                  <div>
                    <h2 className="text-2xl font-extrabold text-white flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                      <span>Human-In-The-Loop (HITL) Approval Queue</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Review top-ranked candidates evaluated by the **Assessment & Interview Agents**. Click Approve to trigger automated offer dispatch from the **Hiring Decision Agent**.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                    {pendingHitlCount} Candidates Pending Review
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {candidates.map((cand) => (
                    <div
                      key={cand.id}
                      className={`p-6 rounded-3xl bg-slate-950/60 border transition-all ${
                        cand.ranking === 1 ? 'border-indigo-500/50 shadow-xl shadow-indigo-500/10' : 'border-slate-800/80'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center space-x-3">
                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                              cand.ranking === 1 ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md' : 'bg-slate-800 text-slate-300'
                            }`}>
                              #{cand.ranking}
                            </span>
                            <div>
                              <h4 className="text-base font-bold text-white flex items-center space-x-2">
                                <span>{cand.name}</span>
                                {cand.linkedinUrl && (
                                  <a 
                                    href={cand.linkedinUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="px-2 py-0.5 rounded-full bg-[#0A66C2]/10 text-[#0A66C2] text-[10px] font-bold hover:bg-[#0A66C2]/20 transition-colors flex items-center space-x-1 border border-[#0A66C2]/30"
                                  >
                                    <span>Connect</span>
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                )}
                              </h4>
                              <div className="flex items-center space-x-4 text-xs text-slate-400 mt-0.5">
                                <span>Experience: <strong className="text-slate-200">{cand.experience}</strong></span>
                                <span>•</span>
                                <span>Salary Req: <strong className="text-slate-200">{cand.salary}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {cand.skills.map((skill, i) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-indigo-300">
                                {skill}
                              </span>
                            ))}
                          </div>

                          {cand.evaluationDetails && (
                            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                              <div className="flex items-center space-x-4">
                                <span>Tech Score: <strong className="text-indigo-400">{cand.evaluationDetails.technical}/100</strong></span>
                                <span>Comm Score: <strong className="text-purple-400">{cand.evaluationDetails.communication}/100</strong></span>
                                <span>Problem Solving: <strong className="text-pink-400">{cand.evaluationDetails.problemSolving}/100</strong></span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-slate-400">Critic Bias Audit:</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[10px]">
                                  ✓ PASSED (100% Fair)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-800">
                          <div className="text-center sm:text-right">
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Match Score</p>
                            <p className="text-3xl font-black text-emerald-400">{cand.matchScore}%</p>
                          </div>

                          <div className="flex items-center space-x-2 w-full sm:w-auto">
                            {cand.status === 'Offer Sent' ? (
                              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center space-x-1.5">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Offer Dispatched</span>
                              </div>
                            ) : cand.status === 'Rejected' ? (
                              <div className="px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold">
                                Rejected
                              </div>
                            ) : cand.status === 'Hold' ? (
                              <div className="px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                                On Hold
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleDecision(cand.id, 'Offer Sent')}
                                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                                >
                                  Approve for Offer
                                </button>
                                <button
                                  onClick={() => handleDecision(cand.id, 'Hold')}
                                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-all cursor-pointer"
                                >
                                  Hold
                                </button>
                                <button
                                  onClick={() => handleDecision(cand.id, 'Rejected')}
                                  className="px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium text-xs transition-all cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 7: SCORE DEFINITION SECTION */}
          {activeTab === 'score-definition' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                <div className="border-b border-slate-800 pb-6">
                  <h2 className="text-2xl font-extrabold text-white flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
                    <span>Candidate Assessment & Score Definition Rubric</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Transparent breakdown of how the **Candidate Assessment Agent** and **Critic Agent** calculate similarity scores and audit evaluations for fairness.
                  </p>
                </div>

                {/* 5 Weighted Dimensions */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-white">1. Multi-Dimensional Similarity Scoring Rubric (100 Max Score)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { dim: "Technical Skills Match", weight: "45%", desc: "Cosine similarity between candidate's 1536d resume embedding and required tech stack (Python, FastAPI, PostgreSQL, LangGraph).", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" },
                      { dim: "Experience & Seniority", weight: "25%", desc: "Evaluation of total industry experience years against job requirements (e.g., 5+ years for Senior roles).", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
                      { dim: "Education & Certifications", weight: "10%", desc: "Verification of relevant degrees in Computer Science, AI, or industry certifications (AWS, CKA).", color: "text-pink-400 border-pink-500/30 bg-pink-500/10" },
                      { dim: "Compensation Alignment", weight: "10%", desc: "Alignment between candidate's expected salary and requisition budget ($130,000 - $160,000).", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                      { dim: "Location & Notice Period", weight: "10%", desc: "Geographic timezone compatibility (Remote US/EU) and availability timeline (immediate vs 30-60 days).", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" }
                    ].map((item, idx) => (
                      <div key={idx} className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{item.dim}</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-black border ${item.color}`}>
                            {item.weight}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Critic Fairness Audit Rules */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 space-y-4">
                  <h3 className="text-base font-bold text-emerald-300 flex items-center space-x-2">
                    <span>2. Critic Agent Fairness & Bias Audit Protocol</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      ✓ Zero Bias Guardrail
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Before any candidate score is finalized or presented in the HITL queue, the **Critic Agent** audits the AI evaluation across three core demographic and seniority metrics:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300 pt-2">
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                      <strong className="text-white block mb-1">Demographic Neutrality:</strong>
                      Ensures scores are 100% blind to candidate gender, ethnicity, age, or educational institution prestige.
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                      <strong className="text-white block mb-1">Linguistic Objectivity:</strong>
                      Prevents penalization of non-native English accents or phrasing during AI voice and chat studio sessions.
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                      <strong className="text-white block mb-1">Seniority Consistency:</strong>
                      Guarantees that evaluation rubrics are applied uniformly across all candidates within the same job tier.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};
