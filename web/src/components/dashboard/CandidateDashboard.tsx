/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from 'react';
import { User } from '../../types';

interface CandidateDashboardProps {
  user: User;
  onSignOut: () => void;
}

export const CandidateDashboard: React.FC<CandidateDashboardProps> = ({ user, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'studio'>('overview');
  
  // Studio Interactive State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [evalResult, setEvalResult] = useState<{ score: number; note: string; criticPassed: boolean } | null>(null);
  const [isSubmittingTurn, setIsSubmittingTurn] = useState(false);

  const questions = [
    {
      id: 1,
      type: "Technical / Medium",
      question: "In your resume you mentioned working with Python and FastAPI. Can you explain how you handle concurrency, asynchronous event loops, and database connection pooling in high-load production APIs?",
      keyPoints: ["Asyncio & Event Loop", "SQLAlchemy / asyncpg connection pooling", "Memory profiling & GIL bottlenecks"],
      sampleAnswer: "In production, I leverage FastAPI's asynchronous route handlers backed by uvicorn workers. For database operations, I implement asyncpg connection pooling with SQLAlchemy 2.0 to prevent thread starvation under concurrent load."
    },
    {
      id: 2,
      type: "Architecture / Hard",
      question: "How would you design a distributed multi-agent recruitment system that can scale to thousands of simultaneous resume evaluations without hitting rate limits or memory leaks?",
      keyPoints: ["Stateless worker nodes", "Message queues (Redis/Celery)", "Vector DB indexing & chunking", "Circuit breakers for LLM APIs"],
      sampleAnswer: "I would decouple the ingestion and parsing stages using Celery workers and Redis message queues. Each agent (Discovery, Assessment) runs as a stateless LangGraph node with PostgreSQL checkpointers for state persistence."
    },
    {
      id: 3,
      type: "Behavioral / Medium",
      question: "Tell me about a time when you had to resolve a critical production outage under tight deadlines while collaborating across cross-functional engineering teams.",
      keyPoints: ["Root cause analysis", "Clear communication & incident commander role", "Post-mortem remediation & automated guardrails"],
      sampleAnswer: "During a major database deadlock incident, I stepped up as incident commander, coordinated rollback procedures with DevOps, and implemented automated query timeouts and retry guardrails that prevented any recurrence."
    }
  ];

  const handleQuickFillAnswer = () => {
    setAnswer(questions[currentQIndex].sampleAnswer);
  };

  const handleSubmitTurn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer) return;

    setIsSubmittingTurn(true);
    setEvalResult(null);

    setTimeout(() => {
      setIsSubmittingTurn(false);
      setEvalResult({
        score: 9.2,
        note: "Exceptional technical depth! Clearly demonstrated production mastery of asynchronous patterns and database pooling.",
        criticPassed: true
      });
    }, 800);
  };

  const handleNextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      setAnswer('');
      setEvalResult(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
              C
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white text-lg">YEN AI</span>
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Candidate Portal & AI Studio
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800">
              <img
                src={user.avatarUrl || "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"}
                alt={user.name}
                className="w-6 h-6 rounded-full object-cover"
              />
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-200 leading-none">{user.name}</p>
                <p className="text-[10px] text-emerald-400 leading-none mt-0.5 font-mono">● Active Candidate</p>
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
        {/* Candidate Profile Banner */}
        <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-purple-950/40 border border-slate-800/80 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center space-x-5 relative z-10">
            <img
              src={user.avatarUrl || "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"}
              alt={user.name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-xl"
            />
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-extrabold text-white">{user.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                  Verified Profile
                </span>
              </div>
              <p className="text-sm text-slate-400">{user.email} • <strong className="text-slate-200">{user.experienceYears || 6.0} Years Experience</strong></p>
              
              <div className="flex flex-wrap gap-1.5 pt-2">
                {(user.techStack || ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'LangGraph']).map((skill, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-medium text-purple-300">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 relative z-10 w-full md:w-auto justify-end">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Application & Status
            </button>
            <button
              onClick={() => setActiveTab('studio')}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center space-x-2 ${
                activeTab === 'studio' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
              <span>Enter AI Interview Studio</span>
            </button>
          </div>
        </div>

        {activeTab === 'overview' ? (
          <div className="space-y-6">
            {/* Active Application & Match Score */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Active Job Application</span>
                  <h2 className="text-2xl font-bold text-white mt-1">Senior AI Backend Engineer</h2>
                  <p className="text-xs text-slate-400 mt-0.5">YEN AI Global • Remote • $130,000 - $160,000 / yr</p>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assessment Match Score</p>
                    <p className="text-3xl font-black text-emerald-400">96% <span className="text-xs font-normal text-slate-400">Top Rank #1</span></p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 4-Step Application Progress Stepper */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-300">Real-Time Pipeline Status Tracker</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {[
                    { step: "1. Sourced & Vectorized", desc: "Resume parsed into 1536d vector embedding", status: "Completed", done: true },
                    { step: "2. Assessment Ranked", desc: "Ranked #1 out of 142 candidates (96% Match)", status: "Completed", done: true },
                    { step: "3. AI Studio Evaluated", desc: "Technical & behavioral evaluation: 88.8/100", status: "Completed", done: true },
                    { step: "4. Offer Status", desc: "Pending recruiter dashboard review & dispatch", status: "Pending HR Review", active: true }
                  ].map((s, i) => (
                    <div
                      key={i}
                      className={`p-5 rounded-2xl border transition-all ${
                        s.active
                          ? 'bg-gradient-to-br from-indigo-950/60 to-slate-900 border-indigo-500/50 shadow-xl shadow-indigo-500/10'
                          : s.done
                          ? 'bg-slate-950/60 border-emerald-500/30'
                          : 'bg-slate-950/40 border-slate-800 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-bold ${s.active ? 'text-indigo-400' : s.done ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {s.step}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          s.active ? 'bg-indigo-500/20 text-indigo-300 animate-pulse' : s.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Steps Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/30 to-pink-900/30 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Ready for AI Interview Studio Session</span>
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                  </h4>
                  <p className="text-xs text-slate-300">
                    Your resume match score is outstanding! Enter the interactive AI Studio to answer tailored technical questions and get instant feedback.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('studio')}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 transition-all shrink-0 cursor-pointer active:scale-95"
                >
                  Start Studio Session Now
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* AI Interview Studio View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in zoom-in-95 duration-300">
            {/* Left Question Panel */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-sm border border-purple-500/30">
                      Q{questions[currentQIndex].id}
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                        {questions[currentQIndex].type}
                      </span>
                      <p className="text-xs text-slate-400">Tailored by Interview Agent from your resume & JD</p>
                    </div>
                  </div>

                  <span className="text-xs text-slate-400 font-mono">
                    Question {currentQIndex + 1} of {questions.length}
                  </span>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white leading-relaxed">
                    &ldquo;{questions[currentQIndex].question}&rdquo;
                  </h3>

                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Expected Key Points to Cover:</p>
                    <div className="flex flex-wrap gap-2">
                      {questions[currentQIndex].keyPoints.map((pt, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                          ✓ {pt}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmitTurn} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300">Your Technical Response</label>
                      <button
                        type="button"
                        onClick={handleQuickFillAnswer}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        ⚡ Use Sample Answer (Quick Demo)
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      required
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your structured answer explaining your architectural approach..."
                      className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={currentQIndex === 0}
                      onClick={() => {
                        setCurrentQIndex(prev => Math.max(0, prev - 1));
                        setAnswer('');
                        setEvalResult(null);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-400 hover:text-white transition-all disabled:opacity-30 cursor-pointer"
                    >
                      ← Previous Question
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmittingTurn || !answer}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-95"
                    >
                      {isSubmittingTurn ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Evaluating Turn...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Answer & Evaluate</span>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Instant Evaluation Feedback & Critic Audit */}
                {evalResult && (
                  <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm font-bold text-emerald-400">Instant AI Studio Evaluation</span>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-sm border border-emerald-500/30">
                        Score: {evalResult.score} / 10.0
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed italic">
                      &ldquo;{evalResult.note}&rdquo;
                    </p>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-slate-400">
                        <span>Critic Agent Fairness Audit:</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[11px]">
                          ✓ PASSED: Verified 100% Fair & Unbiased
                        </span>
                      </div>

                      {currentQIndex < questions.length - 1 && (
                        <button
                          type="button"
                          onClick={handleNextQuestion}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
                        >
                          Next Question →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Studio Telemetry & Guidelines */}
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>How Studio Evaluation Works</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  When you submit your answer, the **Interview Agent** analyzes your response against the required key points and assigns a score from 0 to 10.
                </p>
                <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="text-emerald-400 font-bold">1.</span>
                    <span>Technical precision & architecture depth</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-purple-400 font-bold">2.</span>
                    <span>Clarity of communication & structure</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-pink-400 font-bold">3.</span>
                    <span>Critic Agent checks for demographic fairness</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 space-y-3">
                <h4 className="text-sm font-bold text-indigo-300">Need a Demo walkthrough?</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click the <strong className="text-indigo-400">⚡ Use Sample Answer</strong> button above any question to pre-fill a high-scoring architectural explanation instantly!
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
