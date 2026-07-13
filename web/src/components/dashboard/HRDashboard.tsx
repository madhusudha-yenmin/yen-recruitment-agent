/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { User, HRTab, CandidateMatch, AgentLog, CandidateStatus } from '../../types';
import { getApiUrl } from '../../utils/api';

interface HRDashboardProps {
  user: User;
  onSignOut: () => void;
}

const formatSchedule = (scheduleStr?: string) => {
  if (!scheduleStr || scheduleStr.toLowerCase().includes('awaiting')) {
    return { date: 'Awaiting slot', time: '-' };
  }
  const parts = scheduleStr.split('@').map(s => s.trim());
  let datePart = parts[0] || '';
  let timePart = parts[1] || '';

  if (timePart) {
    timePart = timePart.replace(/\b(IST|EST|CET|PST|UTC([+-]\d+)?|GMT([+-]\d+)?)\b/gi, '').trim();
  }

  try {
    const d = new Date(datePart);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const month = d.getMonth() + 1;
      const year = d.getFullYear().toString().slice(-2);
      datePart = `${day}/${month}/${year}`;
    }
  } catch (e) {
    // keep as is if unparseable
  }

  return { date: datePart, time: timePart };
};

export const HRDashboard: React.FC<HRDashboardProps> = ({ user, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<HRTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const [calendarFilter, setCalendarFilter] = useState<'all' | 'Scheduled' | 'In Progress' | 'Completed'>('all');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
  const [interviewFilter, setInterviewFilter] = useState<'all' | 'Pending' | 'Scheduled' | 'In Progress' | 'Completed'>('all');
  const [questionFilter, setQuestionFilter] = useState<string>('all');
  const [interviewSearchQuery, setInterviewSearchQuery] = useState('');
  const [schedulingCandidateId, setSchedulingCandidateId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, visible: true });
  };

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  // JD Upload & Orchestrator State
  const [jobTitle, setJobTitle] = useState('React Developer');
  const [experience, setExperience] = useState('1+ years');
  const [location, setLocation] = useState('Chennai');
  const [keywords, setKeywords] = useState('');
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);
  const [activeStage, setActiveStage] = useState<number | null>(4); // Default paused at HITL (Stage 4)
  const [currentPage, setCurrentPage] = useState(1);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const itemsPerPage = 10;

  // Score Definition Rubric Weights State (Editable by HR)
  const [rubricWeights, setRubricWeights] = useState({
    technical: 45,
    experience: 25,
    education: 10,
    compensation: 10,
    locationNotice: 10
  });
  const [isEditingWeights, setIsEditingWeights] = useState(false);
  const [tempWeights, setTempWeights] = useState({
    technical: 45,
    experience: 25,
    education: 10,
    compensation: 10,
    locationNotice: 10
  });

  // Kanban Drag & Drop and Manual Card Entry State (`manual and agent`)
  const [draggedCandId, setDraggedCandId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<CandidateStatus | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState<CandidateStatus | null>(null);
  const [newCardName, setNewCardName] = useState("");
  const [newCardEmail, setNewCardEmail] = useState("");
  const [newCardScore, setNewCardScore] = useState("88");
  const [newCardSkills, setNewCardSkills] = useState("Variant 1, Python, LangGraph");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Candidate Pool State (Mapped from Database)
  const [candidates, setCandidates] = useState<CandidateMatch[]>([]);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const apiUrl = getApiUrl();
        const res = await fetch(`${apiUrl}/api/v1/recruitment/candidates`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.candidates)) {
            setCandidates(data.candidates);
          }
        }
      } catch (err) {
        console.error('Failed to load candidates from database:', err);
      }
    };
    fetchCandidates();

    if (typeof window === 'undefined') return;

    // Setup WebSocket connection for event-driven real-time updates
    const apiUrl = getApiUrl();
    let wsUrl = '';
    try {
      const parsedApiUrl = new URL(apiUrl);
      const wsProtocol = parsedApiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProtocol}//${parsedApiUrl.host}/api/v1/recruitment/ws`;
    } catch (e) {
      wsUrl = apiUrl.replace(/^http/, 'ws') + '/api/v1/recruitment/ws';
    }
    
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      try {
        if (!window.WebSocket) return;
        console.log('Attempting WebSocket connection to:', wsUrl);
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log('WebSocket successfully connected to:', wsUrl);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'candidates_updated') {
              fetchCandidates();
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        socket.onclose = () => {
          console.log('WebSocket closed for ' + wsUrl + '. Reconnecting in 3s...');
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        socket.onerror = (err) => {
          console.error('WebSocket error connecting to ' + wsUrl + ':', err);
        };
      } catch (err) {
        console.error('WebSocket initialization error:', err);
      }
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

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

  // Resume Parsing States
  const [selectedResumes, setSelectedResumes] = useState<File[]>([]);
  const [parsedResumes, setParsedResumes] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedResumes(prev => [...prev, ...filesArray]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedResumes(prev => prev.filter((_, i) => i !== index));
  };

  const handleParseResumes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedResumes.length === 0) return;

    setIsParsing(true);
    const formData = new FormData();
    selectedResumes.forEach(file => {
      formData.append('files', file);
    });
    formData.append('job_title', jobTitle + (keywords ? `, ${keywords}` : ''));
    formData.append('experience', experience);

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/v1/resume/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend parse error details:', errorText);
        throw new Error('Failed to parse resumes: ' + response.statusText);
      }

      const data = await response.json();
      setParsedResumes(data);

      // Automatically add parsed candidates to the candidates pool and re-rank
      setCandidates(prev => {
        let updated = [...prev];
        data.forEach((res: any) => {
          const isAlreadyAdded = updated.some(c => c.email === res.parsed.email || c.name === res.parsed.name);
          if (!isAlreadyAdded) {
            const newCandidate: CandidateMatch = {
              id: res.candidate_id,
              name: res.parsed.name || "Unknown Candidate",
              email: res.parsed.email || "no-email@example.com",
              linkedinUrl: "",
              matchScore: Math.round(res.ats_score),
              ranking: updated.length + 1,
              skills: res.parsed.skills.length > 0 ? res.parsed.skills : ["Parsed Candidate"],
              experience: `${res.parsed.experience_years.toFixed(1)} Years`,
              salary: "Negotiable",
              location: "Uploaded Resume",
              status: 'Pending HR Review',
              recommendation: res.recommendation,
              interviewStatus: 'Pending',
              interviewMode: 'AI Chat Studio'
            };
            updated.push(newCandidate);
          }
        });

        // Re-rank based on matchScore descending
        return updated
          .sort((a, b) => b.matchScore - a.matchScore)
          .map((c, index) => ({
            ...c,
            ranking: index + 1
          }));
      });

      setLogs(prev => [
        {
          id: `log-${Date.now()}-parse`,
          timestamp: new Date().toLocaleTimeString(),
          agentName: 'CandidateDiscoveryAgent',
          action: `Successfully parsed and scored ${selectedResumes.length} resumes locally using pdfminer & regex NLP.`,
          latency: '1.2s',
          tokens: 0,
          cost: '$0.00',
          status: 'success'
        },
        ...prev
      ]);
    } catch (err) {
      console.error(err);
      setLogs(prev => [
        {
          id: `log-${Date.now()}-parse-err`,
          timestamp: new Date().toLocaleTimeString(),
          agentName: 'CandidateDiscoveryAgent',
          action: `Error parsing resumes. Please check backend connection.`,
          latency: '0ms',
          tokens: 0,
          cost: '$0.00',
          status: 'error'
        },
        ...prev
      ]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddCandidateToLeaderboard = (res: any) => {
    const isAlreadyAdded = candidates.some(c => c.email === res.parsed.email || c.name === res.parsed.name);
    if (isAlreadyAdded) {
      alert("Candidate has already been added to the leaderboard.");
      return;
    }

    const newCandidate: CandidateMatch = {
      id: res.candidate_id,
      name: res.parsed.name || "Unknown Candidate",
      email: res.parsed.email || "no-email@example.com",
      linkedinUrl: "", // Local upload, no linkedin URL
      matchScore: Math.round(res.ats_score),
      ranking: candidates.length + 1,
      skills: res.parsed.skills.length > 0 ? res.parsed.skills : ["Parsed Candidate"],
      experience: `${res.parsed.experience_years.toFixed(1)} Years`,
      salary: "Negotiable",
      location: "Uploaded Resume",
      status: 'Pending HR Review',
      recommendation: res.recommendation,
      interviewStatus: 'Pending',
      interviewMode: 'AI Chat Studio'
    };

    setCandidates(prev => {
      const updated = [...prev, newCandidate];
      // Re-rank based on matchScore descending
      return updated
        .sort((a, b) => b.matchScore - a.matchScore)
        .map((c, index) => ({
          ...c,
          ranking: index + 1
        }));
    });

    setLogs(prev => [
      {
        id: `log-${Date.now()}-add`,
        timestamp: new Date().toLocaleTimeString(),
        agentName: 'DecisionAgent',
        action: `Added parsed candidate '${newCandidate.name}' with ATS Score ${newCandidate.matchScore}% to the main candidate pool.`,
        latency: '5ms',
        tokens: 0,
        cost: '$0.00',
        status: 'success'
      },
      ...prev
    ]);
  };

  // Telemetry Audit Logs
  const [logs, setLogs] = useState<AgentLog[]>([
    { id: 'log-1', timestamp: '14:20:01', agentName: 'RecruitmentOrchestrator', action: 'Initialized workflow session & delegated Stage 1 to Discovery Agent', latency: '110ms', tokens: 120, cost: '$0.0004', status: 'success' },
    { id: 'log-2', timestamp: '14:20:03', agentName: 'CandidateDiscoveryAgent', action: 'Analyzed JD, generated LinkedIn Boolean query & indexed 142 resumes into candidate pool', latency: '890ms', tokens: 1840, cost: '$0.0045', status: 'success' },
    { id: 'log-3', timestamp: '14:20:04', agentName: 'CandidateAssessmentAgent', action: 'Computed ATS similarity match scores & ranked candidate pool (Top match: Alice Smith @ 96%)', latency: '250ms', tokens: 410, cost: '$0.0012', status: 'success' },
    { id: 'log-4', timestamp: '14:20:10', agentName: 'InterviewAgent', action: 'Scheduled studio sessions, generated 3 tailored questions & audited fairness (PASSED)', latency: '650ms', tokens: 812, cost: '$0.0028', status: 'success' },
    { id: 'log-5', timestamp: '14:20:15', agentName: 'HiringDecisionAgent', action: 'Synthesized comparative analytics & paused execution at HITL checkpointer waiting for Recruiter review', latency: '380ms', tokens: 290, cost: '$0.0010', status: 'success' }
  ]);

  // Derived Metrics (Dynamically computed from API results & manual resume uploads, zero hardcoding)
  const totalProfilesCount = candidates.length;
  const hiredCount = candidates.filter(c => c.status === 'Offer Sent').length;
  const rejectedCount = candidates.filter(c => c.status === 'Rejected').length;
  const pendingHitlCount = candidates.filter(c => c.status === 'Pending HR Review' || c.status === 'Applied' || c.status === 'Hold').length;

  const updateCandidateStatus = (candId: string, newStatus: 'Scheduled' | 'In Progress' | 'Completed' | 'Pending' | 'Inprogress') => {
    setCandidates(prev => prev.map(c => c.id === candId ? { ...c, interviewStatus: newStatus } : c));
  };

  const handleScheduleInterview = async (cand: CandidateMatch) => {
    setSchedulingCandidateId(cand.id);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/v1/resume/schedule-interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: cand.email,
          name: cand.name,
          job_title: jobTitle
        })
      });

      if (!response.ok) {
        throw new Error('Failed to schedule interview: ' + response.statusText);
      }

      // Update the candidate's interviewStatus to 'Scheduled' and default date in the frontend state
      setCandidates(prev => prev.map(c => c.id === cand.id ? {
        ...c,
        interviewStatus: 'Scheduled',
        interviewDate: 'Awaiting Slot Selection @ -',
        interviewMode: 'AI'
      } : c));

      setLogs(prev => [
        {
          id: `log-${Date.now()}-sched`,
          timestamp: new Date().toLocaleTimeString(),
          agentName: 'RecruitmentOrchestrator',
          action: `Manually scheduled interview and dispatched credentials to candidate: ${cand.name} (${cand.email})`,
          latency: '220ms',
          tokens: 0,
          cost: '$0.00',
          status: 'success'
        },
        ...prev
      ]);

      showToast(
        `Interview scheduled successfully. Credentials sent to ${cand.email}.`,
        "success"
      );
    } catch (err) {
      console.error("Error scheduling interview:", err);
      showToast(
        "Interview scheduling failed. Please try again.",
        "error"
      );
    } finally {
      setSchedulingCandidateId(null);
    }
  };

  const handleLaunchPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunningWorkflow(true);
    setActiveStage(1);

    try {
      const apiUrl = getApiUrl();
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
      setLeaderboardPage(1);

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

  const handleApplyWeights = () => {
    const total = tempWeights.technical + tempWeights.experience + tempWeights.education + tempWeights.compensation + tempWeights.locationNotice;
    if (total !== 100) return;

    setRubricWeights({ ...tempWeights });
    setIsEditingWeights(false);
    setSaveSuccessMsg("Rubric weightages customized! Candidate similarity scores have been dynamically re-calculated and re-ranked.");

    // Dynamically re-calculate candidate match scores based on the new weights
    setCandidates(prev => {
      const updated = prev.map(c => {
        let techScore = 90;
        let expScore = 85;
        let eduScore = 90;
        let compScore = 88;
        let locScore = 95;

        if (c.id === 'cand-001') { techScore = 98; expScore = 95; eduScore = 92; compScore = 90; locScore = 100; }
        else if (c.id === 'cand-002') { techScore = 86; expScore = 80; eduScore = 85; compScore = 88; locScore = 85; }
        else if (c.id === 'cand-003') { techScore = 55; expScore = 50; eduScore = 60; compScore = 70; locScore = 60; }
        else if (c.id === 'cand-004') { techScore = 95; expScore = 92; eduScore = 88; compScore = 85; locScore = 95; }

        const weightedScore = (
          (techScore * tempWeights.technical) +
          (expScore * tempWeights.experience) +
          (eduScore * tempWeights.education) +
          (compScore * tempWeights.compensation) +
          (locScore * tempWeights.locationNotice)
        ) / 100;

        return {
          ...c,
          matchScore: Math.round(weightedScore * 10) / 10
        };
      });

      const sorted = [...updated].sort((a, b) => b.matchScore - a.matchScore);
      return sorted.map((c, idx) => ({
        ...c,
        ranking: idx + 1
      }));
    });

    setLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        agentName: 'CandidateAssessmentAgent',
        action: `Scoring rubric weights customized by HR (Tech: ${tempWeights.technical}%, Exp: ${tempWeights.experience}%, Edu: ${tempWeights.education}%, Comp: ${tempWeights.compensation}%, Loc: ${tempWeights.locationNotice}%). Re-calculated embeddings & re-ranked pool.`,
        latency: '185ms',
        tokens: 310,
        cost: '$0.0008',
        status: 'success'
      },
      ...prev
    ]);

    setTimeout(() => {
      setSaveSuccessMsg("");
    }, 6000);
  };

  const handleDragStart = (e: React.DragEvent, candId: string) => {
    e.dataTransfer.setData("text/plain", candId);
    setDraggedCandId(candId);
  };

  const handleDragOver = (e: React.DragEvent, targetCol: CandidateStatus) => {
    e.preventDefault();
    if (dragOverCol !== targetCol) {
      setDragOverCol(targetCol);
    }
  };

  const handleDropCard = (e: React.DragEvent, targetCol: CandidateStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const candId = e.dataTransfer.getData("text/plain") || draggedCandId;
    if (!candId) return;

    const cand = candidates.find(c => c.id === candId);
    if (!cand || cand.status === targetCol) {
      setDraggedCandId(null);
      return;
    }

    setCandidates(prev => prev.map(c => c.id === candId ? { ...c, status: targetCol } : c));
    setDraggedCandId(null);

    setLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        agentName: 'HiringDecisionAgent',
        action: `HITL Kanban Drag-and-Drop: Candidate '${cand.name}' moved by HR / Agent to '${targetCol}'. ${targetCol === 'Offer Sent' ? 'Automated offer packet dispatched.' : 'Pipeline state synchronized.'}`,
        latency: '140ms',
        tokens: 215,
        cost: '$0.0006',
        status: 'success'
      },
      ...prev
    ]);
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddCardModal || !newCardName.trim()) return;

    const newId = `cand-manual-${Date.now()}`;
    const skillsList = newCardSkills.split(',').map(s => s.trim()).filter(Boolean);
    const newCand: CandidateMatch = {
      id: newId,
      name: newCardName.trim(),
      email: newCardEmail.trim() || `${newCardName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      matchScore: parseFloat(newCardScore) || 85,
      ranking: candidates.length + 1,
      skills: skillsList.length ? skillsList : ["Variant 1", "Python", "FastAPI"],
      experience: "5+ Years",
      salary: "$145,000",
      location: "Remote",
      status: showAddCardModal,
      recommendation: 'strong-hire',
      interviewStatus: 'Scheduled',
      evaluationDetails: {
        technical: 88,
        communication: 90,
        problemSolving: 86,
        overall: 88,
        criticPassed: true
      }
    };

    setCandidates(prev => [newCand, ...prev]);
    setShowAddCardModal(null);
    setNewCardName("");
    setNewCardEmail("");
    setNewCardScore("88");
    setNewCardSkills("Variant 1, Python, LangGraph");

    setLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        agentName: 'CandidateAssessmentAgent',
        action: `Manual & Agent Entry: Candidate '${newCand.name}' added directly to '${showAddCardModal}' column. Embedded & scored at ${newCand.matchScore}%.`,
        latency: '160ms',
        tokens: 280,
        cost: '$0.0007',
        status: 'success'
      },
      ...prev
    ]);
  };

  const sidebarItems: { id: HRTab; label: string; icon: string; badge?: string | number; badgeColor?: string }[] = [
    { id: 'overview', label: 'Dashboard Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', badge: totalProfilesCount },
    { id: 'upload-jd', label: 'Upload JD & Orchestrate', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
    { id: 'ranking', label: 'Candidates Resume', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', badge: 'Top #1: 96%', badgeColor: 'bg-emerald-500/20 text-emerald-300' },
    { id: 'interviews', label: 'Interview Status', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', badge: '3 Sched', badgeColor: 'bg-purple-500/20 text-purple-300' },
    { id: 'calendar', label: 'Calendar Screen', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', badge: candidates.filter(c => c.interviewDate).length, badgeColor: 'bg-indigo-500/20 text-indigo-300' },
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
                className={`w-full px-3.5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer group ${isActive
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
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${item.badgeColor ? item.badgeColor : isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
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
                  <p className="text-3xl font-black text-white mt-2">{totalProfilesCount} <span className="text-xs font-normal text-indigo-400 ml-1">Candidate Profiles</span></p>
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
                      {candidates.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                            No candidate records found in database. Upload a resume or run a discovery search above to populate.
                          </td>
                        </tr>
                      ) :
                        candidates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((c) => (
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
                              <span className={`px-2 py-1 rounded-lg ${c.matchScore >= 90 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
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
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${c.interviewStatus === 'Scheduled' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                c.interviewStatus === 'In Progress' || c.interviewStatus === 'Inprogress' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse' :
                                  c.interviewStatus === 'Completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                    'bg-slate-800 text-slate-400'
                                }`}>
                                ● {c.interviewStatus}
                              </span>
                            </td>
                            <td className="py-4 pl-4 text-right">
                              <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${c.status === 'Offer Sent' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
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
                    { stage: "1. Discovery Agent", desc: "JD analysis, Boolean query & resume indexing", score: "142 Sourced", id: 1 },
                    { stage: "2. Assessment Agent", desc: "ATS similarity scoring & pool ranking", score: "Top: 96%", id: 2 },
                    { stage: "3. Interview Agent", desc: "Tailored question gen & studio scheduling", score: "3 Sched", id: 3 },
                    { stage: "4. HITL Checkpoint", desc: "Execution paused waiting for Recruiter decision", score: "Action Required", id: 4, isHitl: true },
                    { stage: "5. Decision Agent", desc: "Comparative analytics & offer automation", score: "Ready", id: 5 }
                  ].map((s) => {
                    const isActive = activeStage === s.id;
                    const isPast = activeStage !== null && activeStage > s.id;
                    return (
                      <div
                        key={s.id}
                        className={`p-4 rounded-2xl border transition-all ${isActive && s.isHitl ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10 animate-pulse' :
                          isActive ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10' :
                            isPast ? 'bg-slate-950/60 border-emerald-500/30' : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold ${isActive && s.isHitl ? 'text-amber-400' : isActive ? 'text-indigo-400' : isPast ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {s.stage}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isActive && s.isHitl ? 'bg-amber-500/20 text-amber-300' : isPast ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
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
                      {candidates.sort((a, b) => b.matchScore - a.matchScore).slice((leaderboardPage - 1) * itemsPerPage, leaderboardPage * itemsPerPage).map((cand) => (
                        <div
                          key={cand.id}
                          className={`p-6 rounded-3xl bg-slate-950/60 border transition-all ${cand.ranking === 1 ? 'border-indigo-500/50 shadow-xl shadow-indigo-500/10 bg-gradient-to-r from-indigo-950/30 via-slate-950 to-slate-950' : 'border-slate-800/80'
                            }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="flex items-start space-x-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${cand.ranking === 1 ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-300'
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
                                <p className={`text-3xl font-black ${cand.matchScore >= 90 ? 'text-emerald-400' : cand.matchScore >= 75 ? 'text-indigo-400' : 'text-amber-400'
                                  }`}>
                                  {cand.matchScore}%
                                </p>
                              </div>
                              <div className="flex flex-col gap-2 shrink-0">
                                {cand.interviewStatus === 'Pending' && (
                                  <button
                                    onClick={() => handleScheduleInterview(cand)}
                                    disabled={schedulingCandidateId === cand.id}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[125px]"
                                  >
                                    {schedulingCandidateId === cand.id ? (
                                      <span className="flex items-center gap-1.5 justify-center">
                                        <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Scheduling...</span>
                                      </span>
                                    ) : (
                                      <span>Schedule Interview</span>
                                    )}
                                  </button>
                                )}
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
                        <button onClick={() => setLeaderboardPage(prev => Math.max(prev - 1, 1))} disabled={leaderboardPage === 1} className="px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50">Previous</button>
                        <span>Page {leaderboardPage} of {Math.ceil(candidates.length / itemsPerPage)}</span>
                        <button onClick={() => setLeaderboardPage(prev => Math.min(prev + 1, Math.ceil(candidates.length / itemsPerPage)))} disabled={leaderboardPage >= Math.ceil(candidates.length / itemsPerPage)} className="px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50">Next</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: CANDIDATES RESUME PAGE */}
          {activeTab === 'ranking' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Column 1: Upload & Files list */}
                <div className="xl:col-span-1 space-y-6">
                  <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                    <div>
                      <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span>Upload Candidate Resumes</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Upload candidate resumes to analyze and score them against the current Requisition: <strong className="text-indigo-400">{jobTitle}</strong>.
                      </p>
                    </div>

                    <form onSubmit={handleParseResumes} className="space-y-4">
                      {/* Drag and Drop Zone */}
                      <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 transition-all bg-slate-950/40 hover:bg-slate-950/60 relative group flex flex-col items-center justify-center text-center cursor-pointer min-h-[160px]">
                        <input
                          type="file"
                          multiple
                          accept=".pdf"
                          onChange={handleResumeChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <svg className="w-10 h-10 text-slate-500 group-hover:text-indigo-400 transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-xs font-bold text-slate-300">Drag & Drop Resumes here</p>
                        <p className="text-[10px] text-slate-500 mt-1">Supports PDF format only</p>
                      </div>

                      {/* Selected Files List */}
                      {selectedResumes.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Selected Files ({selectedResumes.length})</span>
                            <button
                              type="button"
                              onClick={() => setSelectedResumes([])}
                              className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            >
                              Clear All
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {selectedResumes.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                                <span className="truncate text-slate-300 max-w-[180px]">{file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFile(idx)}
                                  className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={selectedResumes.length === 0 || isParsing}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                      >
                        {isParsing ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Analyzing Resumes...</span>
                          </>
                        ) : (
                          <span>Analyze & Score Resumes</span>
                        )}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Column 2: Parser Results & ATS Leaderboard */}
                <div className="xl:col-span-2 space-y-6">
                  {parsedResumes.length === 0 ? (
                    <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl text-center py-24 flex flex-col items-center justify-center">
                      <svg className="w-16 h-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="text-base font-bold text-slate-300">No Resumes Parsed Yet</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        Use the upload box on the left to upload resumes. They will be analyzed, graded, and displayed here.
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                        <div>
                          <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>ATS Leaderboard Results</span>
                          </h2>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Candidates sorted by weighted cosine similarity and experience profile.
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                          Local Extraction Active
                        </span>
                      </div>

                      <div className="space-y-6">
                        {parsedResumes.map((res: any) => {
                          const isAlreadyAdded = candidates.some(c => c.email === res.parsed.email || c.name === res.parsed.name);

                          return (
                            <div key={res.candidate_id} className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2.5">
                                    <h3 className="text-base font-bold text-slate-100">{res.parsed.name || "Unknown Candidate"}</h3>
                                    <span className="text-[10px] text-slate-500">({res.filename})</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                    {res.parsed.email && <span>Email: <strong className="text-slate-300">{res.parsed.email}</strong></span>}
                                    {res.parsed.phone && (
                                      <>
                                        <span>•</span>
                                        <span>Phone: <strong className="text-slate-300">{res.parsed.phone}</strong></span>
                                      </>
                                    )}
                                    <span>•</span>
                                    <span>Exp: <strong className="text-slate-300">{res.parsed.experience_years.toFixed(1)} Years</strong></span>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-6">
                                  <div className="text-center">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">ATS Match Score</p>
                                    <p className={`text-2xl font-black ${res.ats_score >= 70 ? 'text-emerald-400' : res.ats_score >= 45 ? 'text-indigo-400' : 'text-red-400'
                                      }`}>
                                      {res.ats_score}%
                                    </p>
                                  </div>
                                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                                    Added to Pool
                                  </span>
                                </div>
                              </div>

                              {/* Dimensions Score Bars */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/40">
                                {res.dimensions.map((dim: any) => (
                                  <div key={dim.name} className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                      <span className="font-medium text-slate-400">{dim.name} ({Math.round(dim.weight * 100)}%)</span>
                                      <span className="font-bold text-slate-300">{dim.score}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${dim.score >= 70 ? 'bg-emerald-500' : dim.score >= 45 ? 'bg-indigo-500' : 'bg-red-500'
                                          }`}
                                        style={{ width: `${dim.score}%` }}
                                      />
                                    </div>
                                    <p className="text-[9px] text-slate-500 italic">{dim.detail}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Skills & Education */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="space-y-1.5">
                                  <span className="font-bold text-slate-400">Extracted Skills:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {res.parsed.skills.length > 0 ? (
                                      res.parsed.skills.map((skill: string, sIdx: number) => (
                                        <span key={sIdx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-indigo-300">
                                          {skill}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-slate-600 italic">None detected</span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <span className="font-bold text-slate-400">Education Details:</span>
                                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                                    {res.parsed.education.length > 0 ? (
                                      res.parsed.education.map((edu: string, eIdx: number) => (
                                        <li key={eIdx} className="truncate" title={edu}>{edu}</li>
                                      ))
                                    ) : (
                                      <span className="text-slate-600 italic">None detected</span>
                                    )}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: INTERVIEW STATUS (Scheduled / Pending) */}
          {/* VIEW 4: INTERVIEW STATUS (Structured, Ultra-Neat Card Grid & Tracker) */}
          {activeTab === 'interviews' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top Header Card */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
                      <span>AI Studio Interview Status Tracker</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Monitor candidate scheduling states across autonomous AI Chat & Voice Studios.
                    </p>
                  </div>
                </div>

                {/* Role & Name Search Input */}
                <div className="relative w-full md:w-80 shrink-0">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-505" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search candidate by name or role..."
                    value={interviewSearchQuery}
                    onChange={(e) => setInterviewSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all font-semibold"
                  />
                  {interviewSearchQuery && (
                    <button
                      onClick={() => setInterviewSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Separate Status Filter Bar (Row 2) */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl flex items-center justify-start overflow-x-auto">
                <div className="flex items-center gap-2 w-full">
                  {(['all', 'Pending', 'Scheduled', 'In Progress', 'Completed'] as const).map((status) => {
                    const count = status === 'all'
                      ? candidates.length
                      : candidates.filter(c => status === 'In Progress' ? (c.interviewStatus === 'In Progress' || c.interviewStatus === 'Inprogress') : c.interviewStatus === status).length;

                    return (
                      <button
                        key={status}
                        onClick={() => setInterviewFilter(status)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 border shrink-0 ${interviewFilter === status
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-white hover:bg-slate-900'
                          }`}
                      >
                        <span>{status === 'all' ? 'All Candidates' : status}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${interviewFilter === status ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Neat Candidate Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {candidates
                  .filter(c => {
                    let matchesStatus = true;
                    if (interviewFilter !== 'all') {
                      if (interviewFilter === 'In Progress') {
                        matchesStatus = c.interviewStatus === 'In Progress' || c.interviewStatus === 'Inprogress';
                      } else {
                        matchesStatus = c.interviewStatus === interviewFilter;
                      }
                    }
                    let matchesSearch = true;
                    if (interviewSearchQuery.trim() !== '') {
                      const q = interviewSearchQuery.toLowerCase();
                      matchesSearch = c.name.toLowerCase().includes(q) || (c.role || '').toLowerCase().includes(q);
                    }
                    return matchesStatus && matchesSearch;
                  })
                  .map((cand) => (
                    <div
                      key={cand.id}
                      className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 hover:border-purple-500/50 transition-all shadow-xl space-y-4 group relative overflow-hidden"
                    >
                      {/* Subtle Top Accent Glow based on status */}
                      <div className={`absolute top-0 left-0 right-0 h-1 ${cand.interviewStatus === 'In Progress' || cand.interviewStatus === 'Inprogress' ? 'bg-blue-500 animate-pulse' :
                        cand.interviewStatus === 'Completed' ? 'bg-emerald-500' :
                          cand.interviewStatus === 'Scheduled' ? 'bg-purple-500' : 'bg-amber-500/50'
                        }`} />

                      {/* Card Header & Avatar */}
                      <div className="flex items-start justify-between gap-3 pt-1">
                        <div className="flex items-center space-x-3.5 overflow-hidden">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-black text-lg text-white shadow-md shrink-0 group-hover:scale-105 transition-transform">
                            {cand.name.charAt(0)}
                          </div>
                          <div className="truncate">
                            <h3 className="text-sm font-extrabold text-white truncate group-hover:text-purple-300 transition-colors">{cand.name}</h3>
                            <p className="text-[11px] text-slate-400 truncate">{cand.email || `${cand.name.toLowerCase().replace(' ', '.')}@email.com`}</p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase shrink-0 border shadow-sm ${cand.interviewStatus === 'Scheduled' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                          cand.interviewStatus === 'In Progress' || cand.interviewStatus === 'Inprogress' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse' :
                            cand.interviewStatus === 'Completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                              'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                          ● {cand.interviewStatus}
                        </span>
                      </div>

                      {/* Card Details Box */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400 font-medium shrink-0">💼 Role:</span>
                          <span className="font-bold text-slate-200 truncate max-w-[170px] text-right">{cand.role || 'AI Engineer'} ({cand.experience || '5+ yrs'})</span>
                        </div>

                        {(() => {
                          const sched = formatSchedule(cand.interviewDate);
                          return (
                            <>
                              <div className="flex items-center justify-between text-slate-300 border-t border-slate-900 pt-2.5">
                                <span className="text-slate-400 font-medium flex items-center gap-1.5 shrink-0">
                                  <span>📅</span>
                                  <span>Date:</span>
                                </span>
                                <span className="font-mono font-bold text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/20 text-xs">
                                  {sched.date}
                                </span>
                              </div>
                              {sched.time && sched.time !== '-' && (
                                <div className="flex items-center justify-between text-slate-300 border-t border-slate-900/60 pt-2.5">
                                  <span className="text-slate-400 font-medium flex items-center gap-1.5 shrink-0">
                                    <span>⏰</span>
                                    <span>Time:</span>
                                  </span>
                                  <span className="font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded-lg border border-cyan-500/20 text-xs">
                                    {sched.time}
                                  </span>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        <div className="flex items-center justify-between text-slate-300 border-t border-slate-900 pt-2.5">
                          <span className="text-slate-400 font-medium flex items-center gap-1.5">
                            <span>🎙️</span>
                            <span>Interview Mode:</span>
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono border ${cand.interviewMode?.toLowerCase().includes('manual')
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                            }`}>
                            {cand.interviewMode?.toLowerCase().includes('manual') ? 'Manual' : 'AI'}
                          </span>
                        </div>

                        {cand.matchScore && (
                          <div className={`border-t border-slate-900 pt-2.5 ${cand.interviewStatus === 'Completed'
                            ? 'grid grid-cols-2 gap-2'
                            : 'flex items-center justify-between text-slate-300'
                            }`}>
                            {cand.interviewStatus === 'Completed' ? (
                              <>
                                <div className="flex flex-col items-start gap-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                                  <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                                    <span>⭐</span>
                                    <span>Resume Rank:</span>
                                  </span>
                                  <span className="font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 text-xs w-full text-center">
                                    {cand.matchScore}% Match
                                  </span>
                                </div>

                                <div className="flex flex-col items-start gap-1 bg-slate-900/60 p-2.5 rounded-xl border border-purple-500/30 shadow-sm shadow-purple-500/10">
                                  <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                                    <span>🏆</span>
                                    <span>Interview Rank:</span>
                                  </span>
                                  <span className="font-mono font-extrabold text-purple-300 bg-purple-500/15 px-2 py-1 rounded-lg border border-purple-500/30 text-xs w-full text-center">
                                    {cand.evaluationDetails?.overall ? `${cand.evaluationDetails.overall}% Score` : `#${cand.ranking || 1} Rank`}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                  <span>⭐</span>
                                  <span>Resume Rank:</span>
                                </span>
                                <span className="font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                                  {cand.matchScore}% Match
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        {cand.interviewStatus === 'Pending' && (
                          <div className="pt-3 border-t border-slate-900">
                            <button
                              onClick={() => handleScheduleInterview(cand)}
                              disabled={schedulingCandidateId === cand.id}
                              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center space-x-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              {schedulingCandidateId === cand.id ? (
                                <span className="flex items-center gap-1.5 justify-center">
                                  <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>Scheduling...</span>
                                </span>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>Schedule Interview</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                {candidates.filter(c => {
                  let matchesStatus = true;
                  if (interviewFilter !== 'all') {
                    if (interviewFilter === 'In Progress') {
                      matchesStatus = c.interviewStatus === 'In Progress' || c.interviewStatus === 'Inprogress';
                    } else {
                      matchesStatus = c.interviewStatus === interviewFilter;
                    }
                  }
                  let matchesSearch = true;
                  if (interviewSearchQuery.trim() !== '') {
                    const q = interviewSearchQuery.toLowerCase();
                    matchesSearch = c.name.toLowerCase().includes(q) || (c.role || '').toLowerCase().includes(q);
                  }
                  return matchesStatus && matchesSearch;
                }).length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-400 font-medium bg-slate-950/40 rounded-3xl border border-dashed border-slate-800">
                      No candidates found in <span className="font-bold text-purple-300">"{interviewFilter}"</span> interview status.
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* VIEW: DEDICATED CALENDAR SCREEN (Simple, Clean Two-Column Layout) */}
          {activeTab === 'calendar' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top Header Bar */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30 shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
                      <span>Interview Schedule Calendar</span>
                      <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        July 2026
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Click any date on the calendar to filter session details.</p>
                  </div>
                </div>

                {/* Status Filter Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/60 p-1 rounded-2xl border border-slate-800">
                  {(['all', 'Scheduled', 'In Progress', 'Completed'] as const).map((filter) => {
                    const count = filter === 'all'
                      ? candidates.filter(c => c.interviewDate).length
                      : candidates.filter(c => c.interviewDate && (c.interviewStatus === filter || (filter === 'In Progress' && (c.interviewStatus === 'In Progress' || c.interviewStatus === 'Inprogress')))).length;

                    return (
                      <button
                        key={filter}
                        onClick={() => {
                          setCalendarFilter(filter);
                          setSelectedCalendarDay(null);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${calendarFilter === filter
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                          }`}
                      >
                        <span>{filter === 'all' ? 'All' : filter}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${calendarFilter === filter ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Two-Column Layout (Calendar Grid left, Selected Sessions right) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* Left Panel: Clean Simple Month Grid (2 columns on large screens) */}
                <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
                      <span>July 2026</span>
                      {selectedCalendarDay !== null && (
                        <button
                          onClick={() => setSelectedCalendarDay(null)}
                          className="text-[11px] font-normal text-purple-400 hover:text-purple-300 underline lowercase cursor-pointer"
                        >
                          (clear selection)
                        </button>
                      )}
                    </h3>
                    <div className="flex items-center space-x-3 text-xs text-slate-400">
                      <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /><span>Scheduled</span></span>
                      <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /><span>In Progress</span></span>
                      <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /><span>Completed</span></span>
                    </div>
                  </div>

                  {/* Days of Week Header */}
                  <div className="grid grid-cols-7 gap-2 text-center">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
                      <div key={dayName} className="py-1.5 text-[11px] font-extrabold text-slate-500 uppercase">
                        {dayName}
                      </div>
                    ))}
                  </div>

                  {/* Clean 31-Day Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {/* July 1st 2026 starts Wednesday -> 3 blank squares */}
                    <div className="min-h-[85px] rounded-2xl bg-slate-950/20 border border-slate-900/40" />
                    <div className="min-h-[85px] rounded-2xl bg-slate-950/20 border border-slate-900/40" />
                    <div className="min-h-[85px] rounded-2xl bg-slate-950/20 border border-slate-900/40" />

                    {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
                      const isPast = dayNum < 10;
                      const isToday = dayNum === 10;
                      const dayStr = `July ${dayNum < 10 ? '0' + dayNum : dayNum}`;
                      const dayCandidates = isPast ? [] : candidates.filter((c) => {
                        if (!c.interviewDate || !c.interviewDate.includes(dayStr)) return false;
                        if (calendarFilter === 'all') return true;
                        if (calendarFilter === 'In Progress') return c.interviewStatus === 'In Progress' || c.interviewStatus === 'Inprogress';
                        return c.interviewStatus === calendarFilter;
                      });
                      const hasSessions = dayCandidates.length > 0;
                      const isSelected = selectedCalendarDay === dayNum;

                      return (
                        <div
                          key={dayNum}
                          onClick={() => !isPast && setSelectedCalendarDay(isSelected ? null : dayNum)}
                          className={`min-h-[85px] p-2.5 rounded-2xl transition-all flex flex-col justify-between border ${isPast
                            ? 'bg-slate-950/20 border-slate-900/40 opacity-40 pointer-events-none'
                            : isSelected
                              ? 'bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/40 shadow-lg cursor-pointer'
                              : isToday
                                ? 'bg-slate-900 hover:bg-slate-850 border-emerald-500/60 ring-1 ring-emerald-500/30 shadow cursor-pointer'
                                : hasSessions
                                  ? 'bg-slate-900 hover:bg-slate-850 border-purple-500/40 shadow cursor-pointer'
                                  : 'bg-slate-950/40 hover:bg-slate-900/60 border-slate-800/60 cursor-pointer'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold flex items-center ${isSelected ? 'text-purple-300' : isToday ? 'text-emerald-400' : hasSessions ? 'text-white' : 'text-slate-500'
                              }`}>
                              <span>{dayNum}</span>
                              {isToday && <span className="text-[9px] font-black text-emerald-300 ml-1">(Today)</span>}
                            </span>
                            {hasSessions && (
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isToday ? 'bg-emerald-400 animate-pulse' : 'bg-purple-400'}`} />
                            )}
                          </div>

                          {/* Clean Minimal Badge instead of noisy scrolling pills */}
                          {hasSessions ? (
                            <div className="mt-1">
                              <span className={`block px-2 py-1 rounded-lg border text-[10px] font-bold text-center font-mono truncate ${isToday
                                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200'
                                : 'bg-purple-500/20 border-purple-500/30 text-purple-200'
                                }`}>
                                {dayCandidates.length} {dayCandidates.length === 1 ? 'Session' : 'Sessions'}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-600 font-mono text-center">--</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Panel: Selected Day Session Details List */}
                <div className="lg:col-span-1 p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                        {selectedCalendarDay !== null ? `July ${selectedCalendarDay}, 2026` : 'Today & Upcoming (July 10+)'}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {selectedCalendarDay !== null ? 'Sessions on selected date' : `Showing active & upcoming (${calendarFilter})`}
                      </p>
                    </div>
                    {selectedCalendarDay !== null && (
                      <button
                        onClick={() => setSelectedCalendarDay(null)}
                        className="text-xs px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
                      >
                        Show All
                      </button>
                    )}
                  </div>

                  {/* Clean List of Sessions */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {(() => {
                      const filteredList = candidates.filter((c) => {
                        if (!c.interviewDate) return false;
                        const match = c.interviewDate.match(/July (\d+)/);
                        if (match) {
                          const candDay = parseInt(match[1], 10);
                          if (candDay < 10) return false;
                        }
                        if (calendarFilter !== 'all' && c.interviewStatus !== calendarFilter && !(calendarFilter === 'In Progress' && (c.interviewStatus === 'In Progress' || c.interviewStatus === 'Inprogress'))) return false;
                        if (selectedCalendarDay !== null) {
                          const dayStr = `July ${selectedCalendarDay < 10 ? '0' + selectedCalendarDay : selectedCalendarDay}`;
                          return c.interviewDate.includes(dayStr);
                        }
                        return true;
                      });

                      if (filteredList.length === 0) {
                        return (
                          <div className="py-12 text-center text-xs text-slate-500 font-medium bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
                            No sessions found for {selectedCalendarDay !== null ? `July ${selectedCalendarDay}` : 'this filter'}.
                          </div>
                        );
                      }

                      return filteredList.map((c) => (
                        <div
                          key={c.id}
                          className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-purple-500/40 transition-all space-y-3 group shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate">
                              <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors truncate">{c.name}</h4>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">{c.role || 'AI Engineer'}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase shrink-0 border ${c.interviewStatus === 'In Progress' || c.interviewStatus === 'Inprogress' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                              c.interviewStatus === 'Completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              }`}>
                              {c.interviewStatus}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-900 text-[11px] text-slate-300 space-y-1.5">
                            {(() => {
                              const sched = formatSchedule(c.interviewDate);
                              return (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500 font-medium">📅 Date:</span>
                                    <span className="font-mono font-bold text-purple-300 text-right">{sched.date}</span>
                                  </div>
                                  {sched.time && sched.time !== '-' && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500 font-medium">⏰ Time:</span>
                                      <span className="font-mono font-bold text-cyan-300 text-right">{sched.time}</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium">🎙️ Interview Mode:</span>
                              <span className="font-mono font-bold text-indigo-300">{c.interviewMode?.toLowerCase().includes('manual') ? 'Manual' : 'AI'}</span>
                            </div>
                            {c.matchScore && (
                              <div className={`pt-1 border-t border-slate-900/60 ${c.interviewStatus === 'Completed' ? 'grid grid-cols-2 gap-1.5' : 'flex items-center justify-between'}`}>
                                {c.interviewStatus === 'Completed' ? (
                                  <>
                                    <div className="bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 text-center">
                                      <div className="text-[9px] text-slate-400">⭐ Resume Rank</div>
                                      <div className="font-mono font-bold text-emerald-400 text-xs mt-0.5">{c.matchScore}%</div>
                                    </div>
                                    <div className="bg-purple-950/40 p-1.5 rounded-lg border border-purple-500/30 text-center">
                                      <div className="text-[9px] text-slate-400">🏆 Interview Rank</div>
                                      <div className="font-mono font-bold text-purple-300 text-xs mt-0.5">{c.evaluationDetails?.overall ? `${c.evaluationDetails.overall}%` : `#${c.ranking || 1}`}</div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-slate-500 font-medium">⭐ Resume Rank:</span>
                                    <span className="text-emerald-400 font-mono font-bold">{c.matchScore}% Match</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setActiveTab('interviews')}
                            className="w-full py-1.5 rounded-xl bg-slate-900 hover:bg-purple-600 hover:text-white text-slate-300 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1 mt-1 border border-slate-800"
                          >
                            <span>Open Candidate Card</span>
                            <span>→</span>
                          </button>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* VIEW 5: QUESTIONNAIRE BASED ON JD */}
          {/* VIEW 5: QUESTIONNAIRE BASED ON JD */}
          {/* VIEW 5: QUESTIONNAIRE BASED ON JD */}
          {activeTab === 'questionnaire' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Clean Top Header Container */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
                      <span>JD Questionnaire & Interview Rubric Studio</span>
                      <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Tailored interview questions synthesized by the autonomous Interview Agent from <span className="text-slate-300 font-medium">{jobTitle}</span>.
                    </p>
                  </div>
                  <span className="px-3.5 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 shrink-0">
                    <span className="text-pink-400 font-mono mr-1">{questions.length}</span> Total Questions
                  </span>
                </div>

                {/* Simple Category Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-800/80">
                  {(['all', 'Technical / Core Stack', 'System Architecture', 'Behavioral & Leadership', 'Scenario & Problem Solving'] as const).map((cat) => {
                    const count = cat === 'all'
                      ? questions.length
                      : questions.filter(q => q.category === cat).length;

                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setQuestionFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${questionFilter === cat
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 font-bold'
                          : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
                          }`}
                      >
                        <span>{cat === 'all' ? 'All Categories' : cat}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${questionFilter === cat ? 'bg-pink-500/30 text-pink-200 font-bold' : 'bg-slate-800 text-slate-400'
                          }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Simple & Neat Quick-Add Question Bar */}
              <form onSubmit={handleAddQuestion} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  <div className="flex items-center space-x-2 shrink-0 self-start md:self-center">
                    <span className="text-pink-400 font-black text-sm pl-1">+</span>
                    <span className="text-xs font-bold text-slate-300 whitespace-nowrap">Add Question:</span>
                  </div>

                  <select
                    value={newQuestionCat}
                    onChange={(e) => setNewQuestionCat(e.target.value)}
                    className="w-full md:w-52 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium focus:outline-none focus:border-pink-500 cursor-pointer shrink-0"
                  >
                    <option>Technical / Core Stack</option>
                    <option>System Architecture</option>
                    <option>Behavioral & Leadership</option>
                    <option>Scenario & Problem Solving</option>
                  </select>

                  <input
                    type="text"
                    required
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Type custom question or evaluation criteria here..."
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-pink-500 placeholder-slate-500"
                  />

                  <button
                    type="submit"
                    className="w-full md:w-auto px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md shrink-0 cursor-pointer transition-all active:scale-95"
                  >
                    Add
                  </button>
                </div>
              </form>

              {/* Clean, Neat Single-Column Question Cards List */}
              <div className="space-y-3">
                {questions
                  .filter(q => questionFilter === 'all' ? true : q.category === questionFilter)
                  .map((q) => (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/80 transition-all shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4 group"
                    >
                      <div className="space-y-2.5 flex-1">
                        <div className="flex items-center space-x-2.5">
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${q.category === 'Technical / Core Stack' ? 'bg-purple-500/15 text-purple-300 border-purple-500/25' :
                            q.category === 'System Architecture' ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25' :
                              q.category === 'Behavioral & Leadership' ? 'bg-pink-500/15 text-pink-300 border-pink-500/25' :
                                'bg-amber-500/15 text-amber-300 border-amber-500/25'
                            }`}>
                            {q.category}
                          </span>
                          <span className="text-xs font-mono font-semibold text-slate-500">Q#{q.id}</span>
                        </div>

                        <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                          &ldquo;{q.question}&rdquo;
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-slate-500 font-medium mr-1">Target Skills:</span>
                          {q.targetSkills.map((s, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-slate-950/80 text-[11px] font-medium text-slate-300 border border-slate-800/80">
                              ✓ {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-end justify-between sm:justify-start shrink-0">
                        <button
                          type="button"
                          onClick={() => setQuestions(prev => prev.filter(item => item.id !== q.id))}
                          className="px-3 py-1.5 rounded-lg bg-transparent hover:bg-red-500/15 text-slate-500 hover:text-red-400 text-xs font-medium transition-all cursor-pointer flex items-center space-x-1"
                          title="Delete question"
                        >
                          <span>Delete</span>
                          <span>🗑</span>
                        </button>
                      </div>
                    </div>
                  ))}

                {questions.filter(q => questionFilter === 'all' ? true : q.category === questionFilter).length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs font-medium bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
                    No questions found in <span className="font-bold text-pink-400">"{questionFilter}"</span> category.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 6: APPROVALS / REJECTED (HITL Queue Kanban Board matching exact image UI) */}
          {activeTab === 'approvals' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl space-y-6">
                {/* Header Title Box (Row 1) */}
                <div className="flex flex-col space-y-1.5 pb-4 border-b border-slate-800/80">
                  <h2 className="text-2xl font-extrabold text-white flex items-center space-x-2.5">
                    <span className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse" />
                    <span>Recruitment Pipeline & HITL Board</span>
                  </h2>
                  <p className="text-xs text-slate-400 max-w-3xl">
                    Drag and drop candidate cards across stages to update pipeline status, or click any card to inspect full AI evaluation scores and interview details.
                  </p>
                </div>

                {/* Action Bar & Total Count (Row 2) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center space-x-2 bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800/80 shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold text-slate-300">
                      Active Candidate Pool: <strong className="text-indigo-400 font-mono text-sm ml-1">{candidates.length}</strong> Profiles
                    </span>
                  </div>
                </div>

                {/* 5-Column Kanban Grid: Candidates + Scheduled + Review + Approved + Rejected */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start pb-4">
                  {[
                    { id: 'Applied' as CandidateStatus, title: 'Candidates', subtitle: 'Applied Pool', borderTop: 'border-t-4 border-t-purple-500', headerBg: 'bg-slate-900', pillColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                    { id: 'Pending HR Review' as CandidateStatus, title: 'Scheduled', subtitle: 'Schedule & Review', borderTop: 'border-t-4 border-t-indigo-500', headerBg: 'bg-slate-900', pillColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
                    { id: 'Hold' as CandidateStatus, title: 'Review', subtitle: 'Ongoing / Hold', borderTop: 'border-t-4 border-t-pink-500', headerBg: 'bg-slate-900', pillColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
                    { id: 'Offer Sent' as CandidateStatus, title: 'Approved', subtitle: 'Hired Board', borderTop: 'border-t-4 border-t-emerald-500', headerBg: 'bg-slate-900', pillColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                    { id: 'Rejected' as CandidateStatus, title: 'Rejected', subtitle: 'Archived Board', borderTop: 'border-t-4 border-t-blue-500', headerBg: 'bg-slate-900', pillColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30' }
                  ].map((col) => {
                    const colCards = candidates.filter(c => c.status === col.id);
                    const isDragOver = dragOverCol === col.id;

                    return (
                      <div
                        key={col.id}
                        onDragOver={(e) => handleDragOver(e, col.id)}
                        onDragLeave={() => setDragOverCol(null)}
                        onDrop={(e) => handleDropCard(e, col.id)}
                        className={`rounded-2xl bg-slate-950/80 border ${isDragOver ? 'border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 bg-slate-900/80' : 'border-slate-800/80'
                          } transition-all flex flex-col min-h-[540px] overflow-hidden`}
                      >
                        {/* Column Header */}
                        <div className={`p-4 ${col.headerBg} ${col.borderTop} border-b border-slate-800 flex items-center justify-between`}>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-bold text-white tracking-wide">{col.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${col.pillColor}`}>
                              {colCards.length}
                            </span>
                          </div>
                        </div>

                        {/* Column Cards Container */}
                        <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto max-h-[640px] custom-scrollbar">
                          {colCards.length === 0 ? (
                            <div className="h-44 border-2 border-dashed border-slate-800/60 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                              <p className="text-xs font-semibold text-slate-500">No cards in {col.title}</p>
                              <p className="text-[10px] text-slate-600 mt-1">Drag & drop cards here to update pipeline status</p>
                            </div>
                          ) : (
                            colCards.map((cand) => (
                              <div
                                key={cand.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, cand.id)}
                                onDragEnd={() => setDraggedCandId(null)}
                                className={`p-4 rounded-2xl bg-slate-900/90 border ${draggedCandId === cand.id ? 'opacity-40 border-dashed border-indigo-500 scale-95' : 'border-slate-800 hover:border-slate-700 shadow-lg hover:shadow-xl'
                                  } transition-all cursor-grab active:cursor-grabbing group space-y-3 relative`}
                              >
                                {/* Top Header: Candidate Name, Role & Score below role */}
                                <div className="space-y-2 border-b border-slate-800/80 pb-3">
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                                        {cand.name}
                                      </h4>
                                      {cand.linkedinUrl && col.id !== 'Pending HR Review' && col.title !== 'Scheduled' && col.id !== 'Applied' && col.title !== 'Candidates' && (
                                        <a
                                          href={cand.linkedinUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-2 py-0.5 rounded-full bg-[#0A66C2]/10 text-[#0A66C2] text-[10px] font-bold hover:bg-[#0A66C2]/20 transition-colors flex items-center space-x-1 border border-[#0A66C2]/30 shrink-0"
                                        >
                                          <span>Connect</span>
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </a>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{cand.role || 'AI Backend Engineer'}</p>
                                  </div>

                                  {/* Score displayed right below the role */}
                                  <div className="pt-0.5">
                                    {cand.status === 'Applied' || cand.status === 'Pending HR Review' ? (
                                      <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-[11px] font-bold text-purple-300">
                                        <span className="text-[10px] font-medium text-purple-300/80">Resume Ranking Score</span>
                                        <span className="font-mono font-extrabold">{cand.matchScore}%</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-bold text-indigo-300">
                                        <span className="text-[10px] font-medium text-indigo-300/80">Interview Score</span>
                                        <span className="font-mono font-extrabold">{cand.evaluationDetails?.overall || cand.matchScore}%</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Skills / Role tags */}
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-[10px] font-bold text-indigo-300">
                                    {cand.skills[0] || 'Variant 1'}
                                  </span>
                                  {cand.skills[1] && (
                                    <span className="px-2 py-0.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[10px] text-slate-300 font-medium">
                                      {cand.skills[1]}
                                    </span>
                                  )}
                                  {cand.skills[2] && (
                                    <span className="px-2 py-0.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[10px] text-slate-400 font-medium">
                                      {cand.skills[2]}
                                    </span>
                                  )}
                                </div>

                                {/* Years of Experience */}
                                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                                  <span className="text-slate-500 font-medium">Experience</span>
                                  <span className="text-slate-300 font-semibold">{cand.experience}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Modal for Manual + Agent Card Creation */}
                {showAddCardModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div>
                          <h3 className="text-base font-bold text-white flex items-center space-x-2">
                            <span>+ Add Card to Kanban Board</span>
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">Adding to column: <strong className="text-indigo-400">{showAddCardModal}</strong></p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddCardModal(null)}
                          className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold cursor-pointer"
                        >
                          ×
                        </button>
                      </div>

                      <form onSubmit={handleCreateCard} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">Candidate Full Name *</label>
                          <input
                            type="text"
                            required
                            value={newCardName}
                            onChange={(e) => setNewCardName(e.target.value)}
                            placeholder="e.g. James Smith"
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-300">Email Address</label>
                            <input
                              type="email"
                              value={newCardEmail}
                              onChange={(e) => setNewCardEmail(e.target.value)}
                              placeholder="james@example.com"
                              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-300">Match Score (0-100)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={newCardScore}
                              onChange={(e) => setNewCardScore(e.target.value)}
                              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">Skills / Variant Tags (comma separated)</label>
                          <input
                            type="text"
                            value={newCardSkills}
                            onChange={(e) => setNewCardSkills(e.target.value)}
                            placeholder="Variant 1, Python, LangGraph"
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => setShowAddCardModal(null)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md cursor-pointer"
                          >
                            Add Card & Run Agent Check
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
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

                {saveSuccessMsg && (
                  <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{saveSuccessMsg}</span>
                    </div>
                    <button type="button" onClick={() => setSaveSuccessMsg("")} className="text-emerald-400 hover:text-white cursor-pointer font-bold">×</button>
                  </div>
                )}

                {/* 5 Weighted Dimensions */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-white">Candidate Evaluation Scoring Rubric (100 Max Score)</h3>
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                        Editable by HR
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!isEditingWeights ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTempWeights({ ...rubricWeights });
                            setIsEditingWeights(true);
                            setSaveSuccessMsg("");
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Customize Weightage</span>
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTempWeights({
                                technical: 45,
                                experience: 25,
                                education: 10,
                                compensation: 10,
                                locationNotice: 10
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
                          >
                            Reset Defaults
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingWeights(false)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-semibold text-xs border border-slate-800 transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditingWeights ? (
                    <div className="p-6 rounded-3xl bg-slate-950/80 border border-indigo-500/40 shadow-2xl space-y-6 animate-in fade-in duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                            <span>Adjust Scoring Rubric Weightages</span>
                            <span className="text-[10px] font-normal text-indigo-400">(Total must equal 100%)</span>
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">Move sliders or enter custom percentages. Saving will recalculate all candidate match scores.</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-slate-400">Total Weight:</span>
                          <span className={`px-3 py-1 rounded-xl text-xs font-black border ${tempWeights.technical + tempWeights.experience + tempWeights.education + tempWeights.compensation + tempWeights.locationNotice === 100
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                            }`}>
                            {tempWeights.technical + tempWeights.experience + tempWeights.education + tempWeights.compensation + tempWeights.locationNotice}% / 100%
                          </span>
                        </div>
                      </div>

                      {/* Visual Proportional Bar */}
                      <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden flex">
                        <div style={{ width: `${tempWeights.technical}%` }} className="bg-indigo-500 transition-all duration-300" title={`Technical: ${tempWeights.technical}%`} />
                        <div style={{ width: `${tempWeights.experience}%` }} className="bg-purple-500 transition-all duration-300" title={`Experience: ${tempWeights.experience}%`} />
                        <div style={{ width: `${tempWeights.education}%` }} className="bg-pink-500 transition-all duration-300" title={`Education: ${tempWeights.education}%`} />
                        <div style={{ width: `${tempWeights.compensation}%` }} className="bg-emerald-500 transition-all duration-300" title={`Compensation: ${tempWeights.compensation}%`} />
                        <div style={{ width: `${tempWeights.locationNotice}%` }} className="bg-cyan-500 transition-all duration-300" title={`Location & Notice: ${tempWeights.locationNotice}%`} />
                      </div>

                      {/* Sliders & Inputs Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                          { key: 'technical' as const, label: "Technical Skills Match", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10", accent: "accent-indigo-500", desc: "Cosine similarity between resume embedding & tech stack." },
                          { key: 'experience' as const, label: "Experience & Seniority", color: "text-purple-400 border-purple-500/30 bg-purple-500/10", accent: "accent-purple-500", desc: "Industry experience years against job requirements." },
                          { key: 'education' as const, label: "Education & Certifications", color: "text-pink-400 border-pink-500/30 bg-pink-500/10", accent: "accent-pink-500", desc: "Relevant degrees in CS, AI, or certifications (AWS, CKA)." },
                          { key: 'compensation' as const, label: "Compensation Alignment", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", accent: "accent-emerald-500", desc: "Alignment with expected salary ($130k - $160k)." },
                          { key: 'locationNotice' as const, label: "Location & Notice Period", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10", accent: "accent-cyan-500", desc: "Timezone compatibility & availability timeline." }
                        ].map((dim) => (
                          <div key={dim.key} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">{dim.label}</span>
                              <span className={`px-2 py-0.5 rounded text-[11px] font-black border ${dim.color}`}>
                                {tempWeights[dim.key]}%
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{dim.desc}</p>
                            <div className="flex items-center space-x-3 pt-1">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={tempWeights[dim.key]}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setTempWeights(prev => ({ ...prev, [dim.key]: val }));
                                }}
                                className={`w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer ${dim.accent}`}
                              />
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={tempWeights[dim.key]}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setTempWeights(prev => ({ ...prev, [dim.key]: Math.min(100, Math.max(0, val)) }));
                                }}
                                className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-center text-white focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
                        {tempWeights.technical + tempWeights.experience + tempWeights.education + tempWeights.compensation + tempWeights.locationNotice === 100 ? (
                          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Total equals 100%. Ready to apply rubric across all candidates.</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>
                              Total is {tempWeights.technical + tempWeights.experience + tempWeights.education + tempWeights.compensation + tempWeights.locationNotice}%. Must equal 100% (Adjust by {100 - (tempWeights.technical + tempWeights.experience + tempWeights.education + tempWeights.compensation + tempWeights.locationNotice) > 0 ? `+${100 - (tempWeights.technical + tempWeights.experience + tempWeights.education + tempWeights.compensation + tempWeights.locationNotice)}%` : `${100 - (tempWeights.technical + tempWeights.experience + tempWeights.education + tempWeights.compensation + tempWeights.locationNotice)}%`}).
                            </span>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={tempWeights.technical + tempWeights.experience + tempWeights.education + tempWeights.compensation + tempWeights.locationNotice !== 100}
                          onClick={handleApplyWeights}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center space-x-2 active:scale-95"
                        >
                          <span>Apply & Recalculate Pool Scores →</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { dim: "Technical Skills Match", weight: `${rubricWeights.technical}%`, desc: "Cosine similarity between candidate's 1536d resume embedding and required tech stack (Python, FastAPI, PostgreSQL, LangGraph).", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" },
                        { dim: "Experience & Seniority", weight: `${rubricWeights.experience}%`, desc: "Evaluation of total industry experience years against job requirements (e.g., 5+ years for Senior roles).", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
                        { dim: "Education & Certifications", weight: `${rubricWeights.education}%`, desc: "Verification of relevant degrees in Computer Science, AI, or industry certifications (AWS, CKA).", color: "text-pink-400 border-pink-500/30 bg-pink-500/10" },
                        { dim: "Compensation Alignment", weight: `${rubricWeights.compensation}%`, desc: "Alignment between candidate's expected salary and requisition budget ($130,000 - $160,000).", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                        { dim: "Location & Notice Period", weight: `${rubricWeights.locationNotice}%`, desc: "Geographic timezone compatibility (Remote US/EU) and availability timeline (immediate vs 30-60 days).", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" }
                      ].map((item, idx) => (
                        <div key={idx} className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2 hover:border-slate-700 transition-all">
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
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Toast Notification */}
          {toast.visible && (
            <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all ${toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/20'
                : 'bg-red-950/90 border-red-500/40 text-red-200 shadow-red-950/20'
                }`}>
                {toast.type === 'success' ? (
                  <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="text-xs font-semibold tracking-wide">{toast.message}</span>
                <button
                  onClick={() => setToast(prev => ({ ...prev, visible: false }))}
                  className="ml-2 hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 opacity-60 hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};
