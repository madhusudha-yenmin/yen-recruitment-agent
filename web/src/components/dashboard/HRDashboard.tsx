/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from 'react';
import { User, AgentLog, CandidateMatch } from '../../types';

interface HRDashboardProps {
  user: User;
  onSignOut: () => void;
}

export const HRDashboard: React.FC<HRDashboardProps> = ({ user, onSignOut }) => {
  const [jobTitle, setJobTitle] = useState('Senior AI Backend Engineer');
  const [jobDesc, setJobDesc] = useState('Seeking a Senior AI Backend Engineer with 5+ years experience in Python, FastAPI, PostgreSQL, Docker, and LangGraph. Salary: $130k-$160k. Remote.');
  
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);
  const [activeStage, setActiveStage] = useState<number | null>(4); // Default paused at HITL (Stage 4)
  
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
      status: 'Pending HR Review',
      recommendation: 'no-hire'
    }
  ]);

  const [logs, setLogs] = useState<AgentLog[]>([
    { id: 'log-1', timestamp: '14:20:01', agentName: 'RecruitmentOrchestrator', action: 'Initialized workflow session & delegated Stage 1 to Discovery Agent', latency: '110ms', tokens: 120, cost: '$0.0004', status: 'success' },
    { id: 'log-2', timestamp: '14:20:03', agentName: 'CandidateDiscoveryAgent', action: 'Analyzed JD, generated LinkedIn Boolean query & parsed 3 resumes into 1536d vectors', latency: '890ms', tokens: 1840, cost: '$0.0045', status: 'success' },
    { id: 'log-3', timestamp: '14:20:04', agentName: 'CandidateAssessmentAgent', action: 'Computed multi-dimensional match scores & ranked candidate pool (Top match: Alice Smith @ 96%)', latency: '250ms', tokens: 410, cost: '$0.0012', status: 'success' },
    { id: 'log-4', timestamp: '14:20:10', agentName: 'InterviewAgent', action: 'Scheduled session, generated 4 tailored questions, conducted chat turns & audited fairness (PASSED)', latency: '650ms', tokens: 812, cost: '$0.0028', status: 'success' },
    { id: 'log-5', timestamp: '14:20:15', agentName: 'HiringDecisionAgent', action: 'Synthesized comparative analytics & paused execution at HITL checkpoint waiting for Recruiter review', latency: '380ms', tokens: 290, cost: '$0.0010', status: 'success' }
  ]);

  const handleLaunchPipeline = (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunningWorkflow(true);
    setActiveStage(1);

    // Simulate 5-Agent Pipeline Progression
    setTimeout(() => {
      setActiveStage(2);
      setLogs(prev => [
        { id: `log-${Date.now()}-1`, timestamp: new Date().toLocaleTimeString(), agentName: 'CandidateDiscoveryAgent', action: `Sourced & vectorized candidate pool for '${jobTitle}'`, latency: '780ms', tokens: 1520, cost: '$0.0038', status: 'success' },
        ...prev
      ]);
    }, 1200);

    setTimeout(() => {
      setActiveStage(3);
      setLogs(prev => [
        { id: `log-${Date.now()}-2`, timestamp: new Date().toLocaleTimeString(), agentName: 'CandidateAssessmentAgent', action: 'Multi-dimensional similarity scoring complete. Re-ranked pool.', latency: '310ms', tokens: 480, cost: '$0.0015', status: 'success' },
        ...prev
      ]);
    }, 2400);

    setTimeout(() => {
      setActiveStage(4);
      setIsRunningWorkflow(false);
      setLogs(prev => [
        { id: `log-${Date.now()}-3`, timestamp: new Date().toLocaleTimeString(), agentName: 'InterviewAgent', action: 'Generated customized question set & initialized AI studio setup', latency: '590ms', tokens: 620, cost: '$0.0021', status: 'success' },
        { id: `log-${Date.now()}-4`, timestamp: new Date().toLocaleTimeString(), agentName: 'HiringDecisionAgent', action: 'HITL CHECKPOINT REACHED: Execution paused waiting for Recruiter dashboard decision', latency: '150ms', tokens: 110, cost: '$0.0003', status: 'warning' },
        ...prev
      ]);
    }, 3600);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              Y
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white text-lg">YEN AI</span>
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                HR Recruiter Studio
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800">
              <img
                src={user.avatarUrl || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"}
                alt={user.name}
                className="w-6 h-6 rounded-full object-cover"
              />
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-200 leading-none">{user.name}</p>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">{user.company || 'YEN Enterprise'}</p>
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 animate-in fade-in duration-300">
        {/* Top Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-indigo-500/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all" />
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Requisitions</p>
            <p className="text-3xl font-extrabold text-white mt-2">4 <span className="text-xs font-normal text-indigo-400 ml-1">Live Roles</span></p>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-purple-500/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all" />
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Sourced & Vectorized</p>
            <p className="text-3xl font-extrabold text-white mt-2">142 <span className="text-xs font-normal text-purple-400 ml-1">1536d Vectors</span></p>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all" />
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending HITL Reviews</p>
            <p className="text-3xl font-extrabold text-amber-400 mt-2">3 <span className="text-xs font-normal text-slate-400 ml-1">Action Required</span></p>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/80 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Offers & Studio Sessions</p>
            <p className="text-3xl font-extrabold text-emerald-400 mt-2">18 <span className="text-xs font-normal text-slate-400 ml-1">Completed</span></p>
          </div>
        </div>

        {/* 5-Agent Pipeline Orchestrator Form & Stage Tracker */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl relative overflow-hidden space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                <span>5-Agent Recruitment Pipeline Orchestrator</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Input job requirements to trigger autonomous sourcing, vector parsing, multi-dimensional ranking, and interview studio setup.
              </p>
            </div>
          </div>

          <form onSubmit={handleLaunchPipeline} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Job Description & Hiring Criteria</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                  type="submit"
                  disabled={isRunningWorkflow}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-2 shrink-0 disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {isRunningWorkflow ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Orchestrating...</span>
                    </>
                  ) : (
                    <>
                      <span>Launch 5-Agent Pipeline</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* 5-Agent Stage Tracker Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
            {[
              { stage: "1. Orchestrator & Discovery", desc: "JD analysis, Boolean query & 1536d resume parsing", score: "3 Sourced", id: 1 },
              { stage: "2. Assessment Agent", desc: "Multi-dimensional similarity scoring & pool ranking", score: "Top: 96%", id: 2 },
              { stage: "3. Interview Agent", desc: "Tailored question gen, scheduling & studio setup", score: "Studio Ready", id: 3 },
              { stage: "4. HITL Checkpoint", desc: "Execution paused waiting for Recruiter decision", score: "Action Required", id: 4, isHitl: true },
              { stage: "5. Hiring Decision Agent", desc: "Comparative analytics & offer letter automation", score: "Pending HITL", id: 5 }
            ].map((s) => {
              const isActive = activeStage === s.id;
              const isPast = activeStage !== null && activeStage > s.id;
              
              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border transition-all relative ${
                    isActive && s.isHitl
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10 animate-pulse'
                      : isActive
                      ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                      : isPast
                      ? 'bg-slate-950/60 border-emerald-500/30'
                      : 'bg-slate-950/40 border-slate-800/80 opacity-60'
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

        {/* HITL Approval Queue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Human-In-The-Loop (HITL) Approval Queue</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  3 Candidates Pending
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review top matches evaluated by the Candidate Assessment Agent and approve to trigger automated offer dispatch.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className={`p-6 rounded-3xl bg-slate-900/80 border transition-all ${
                  cand.ranking === 1 ? 'border-indigo-500/50 shadow-xl shadow-indigo-500/10' : 'border-slate-800/80'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left info */}
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
                          <span className="text-xs font-normal text-slate-400">({cand.email})</span>
                        </h4>
                        <div className="flex items-center space-x-4 text-xs text-slate-400 mt-0.5">
                          <span>Experience: <strong className="text-slate-200">{cand.experience}</strong></span>
                          <span>•</span>
                          <span>Salary Req: <strong className="text-slate-200">{cand.salary}</strong></span>
                          <span>•</span>
                          <span>Location: <strong className="text-slate-200">{cand.location}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Skill Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {cand.skills.map((skill, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-medium text-indigo-300">
                          {skill}
                        </span>
                      ))}
                    </div>

                    {/* Evaluation breakdown if top match */}
                    {cand.evaluationDetails && (
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
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

                  {/* Right Actions & Match Score */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-4 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-800">
                    <div className="text-center sm:text-right">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Match Score</p>
                      <p className={`text-3xl font-black ${
                        cand.matchScore >= 90 ? 'text-emerald-400' : cand.matchScore >= 75 ? 'text-indigo-400' : 'text-amber-400'
                      }`}>
                        {cand.matchScore}%
                      </p>
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
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                          >
                            Approve for Offer & Studio
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

        {/* Live Telemetry & Cost Audit Stream */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Real-Time 5-Agent Telemetry & Cost Audit Trail</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">PostgreSQL Checkpointer Active</span>
          </div>

          <div className="bg-slate-950/80 rounded-2xl border border-slate-800/80 p-4 font-mono text-xs space-y-2.5 max-h-64 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-900 last:border-0 last:pb-0">
                <div className="flex items-center space-x-3">
                  <span className="text-slate-500">{log.timestamp}</span>
                  <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                    log.agentName === 'RecruitmentOrchestrator' ? 'bg-indigo-500/20 text-indigo-300' :
                    log.agentName === 'CandidateDiscoveryAgent' ? 'bg-purple-500/20 text-purple-300' :
                    log.agentName === 'CandidateAssessmentAgent' ? 'bg-pink-500/20 text-pink-300' :
                    log.agentName === 'InterviewAgent' ? 'bg-cyan-500/20 text-cyan-300' :
                    'bg-amber-500/20 text-amber-300'
                  }`}>
                    {log.agentName}
                  </span>
                  <span className="text-slate-300">{log.action}</span>
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-400 shrink-0">
                  <span>Latency: <strong className="text-slate-200">{log.latency}</strong></span>
                  <span>•</span>
                  <span>Tokens: <strong className="text-slate-200">{log.tokens}</strong></span>
                  <span>•</span>
                  <span>Cost: <strong className="text-emerald-400">{log.cost}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
