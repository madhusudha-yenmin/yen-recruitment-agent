/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { User, CandidateTab } from '../../types';
import { getApiUrl } from '../../utils/api';
import { useProctoring } from '../../hooks/useProctoring';
import { ProctoringPanel } from '../interview/ProctoringPanel';

interface CandidateDashboardProps {
  user: User;
  onSignOut: () => void;
}

export const CandidateDashboard: React.FC<CandidateDashboardProps> = ({ user, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<CandidateTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Availability Screen State
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [timezone, setTimezone] = useState<string>(user.availability?.timezone || 'IST (UTC+5:30) - Indian Standard Time');
  const [isAvailabilitySaved, setIsAvailabilitySaved] = useState<boolean>(user.availability?.isConfirmed || false);
  const [isSavingAvailability, setIsSavingAvailability] = useState<boolean>(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
  };

  const [profile, setProfile] = useState<{
    id?: string;
    name: string;
    email: string;
    phone: string;
    experience: number;
    status: string;
    role: string;
    location?: string;
    skills: string[];
    interviewDate?: string;
    scheduledAtISO?: string;
    generatedQuestions?: any[];
    proposedDates?: string[];
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // AI Interview Studio & Mock Interview State
  const [isMockInterviewMode, setIsMockInterviewMode] = useState<boolean>(false);
  const [isForceUnlocked, setIsForceUnlocked] = useState<boolean>(false); // Assessment locked until scheduled interview date & time is met
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

  // Sequential Question Tracking State 
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [answeredQs, setAnsweredQs] = useState<{ [idx: number]: { answer: string; timestamp: string } }>({});
  const [isAssessmentFinished, setIsAssessmentFinished] = useState<boolean>(false);
  const [studioTimerSeconds, setStudioTimerSeconds] = useState<number>(20 * 60); // 20-minute overall timer

  const getMockPracticeQuestions = (role: string = "Software Engineer", skills: string[] = ["Core Stack"]) => {
    return [
      {
        id: "mock-1",
        category: "Mock Practice: Warm-up & Introduction",
        question: `Could you walk me through your career background and recent hands-on projects working with ${skills.slice(0, 2).join(", ") || role}?`,
        targetSkills: ["Communication", "Overview"]
      },
      {
        id: "mock-2",
        category: "Mock Practice: Problem Solving & Debugging",
        question: `Can you describe a challenging technical bottleneck or production bug you encountered while building a ${role} application, and the step-by-step approach you took to resolve it?`,
        targetSkills: ["Problem Solving", "Debugging"]
      },
      {
        id: "mock-3",
        category: "Mock Practice: Architecture & Best Practices",
        question: `When designing scalable features for ${role}, what architectural design patterns and code quality practices do you prioritize most?`,
        targetSkills: ["Architecture", "Code Quality"]
      },
      {
        id: "mock-4",
        category: "Mock Practice: Performance Optimization",
        question: `How do you typically monitor, profile, and optimize performance bottlenecks in applications utilizing ${skills[0] || role}?`,
        targetSkills: ["Performance", "Optimization"]
      },
      {
        id: "mock-5",
        category: "Mock Practice: Team Collaboration & Agile",
        question: `How do you handle technical disagreements or constructive code review feedback when collaborating with cross-functional engineers and product teams?`,
        targetSkills: ["Teamwork", "Agile"]
      }
    ];
  };

  const checkTimeLockStatus = () => {
    if (isForceUnlocked) return { isUnlocked: true, reason: "" };
    if (!profile || !profile.interviewDate || profile.interviewDate === "Awaiting slot") {
      return { isUnlocked: false, reason: "Your interview date & time slot have not been confirmed yet. Please confirm your availability preferences first." };
    }

    const todayDateObj = new Date();
    const currentYear = todayDateObj.getFullYear();
    const currentMonth = todayDateObj.getMonth();
    const currentDay = todayDateObj.getDate();
    const currentHour = todayDateObj.getHours();
    const todayTimestamp = new Date(currentYear, currentMonth, currentDay).getTime();

    // Collect all timestamps corresponding to dates found in profile.interviewDate, scheduledAtISO, or proposedDates
    const targetTimestamps: number[] = [];

    // 1. Check confirmed interview date and ISO scheduled time first
    const confirmedText = `${profile.interviewDate || ''} ${profile.scheduledAtISO || ''}`;
    const hasDigits = /\d{2,4}/.test(confirmedText) && profile.interviewDate !== "Awaiting slot";
    const textToCheck = hasDigits ? confirmedText : `${confirmedText} ${(profile.proposedDates || []).join(' ')}`;
    console.log("[CHECK_TIME_LOCK_LOGIC] checking text:", { textToCheck, proposedDates: profile.proposedDates, hasDigits });

    // 1. Check DD/MM/YY, DD-MM-YYYY, or DD/MM/YYYY (e.g. 20-07-2026, 20/7/26, 21-07-2026)
    const slashRegex = /\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\b/g;
    let match;
    while ((match = slashRegex.exec(textToCheck)) !== null) {
      const dayNum = parseInt(match[1], 10);
      const monthNum = parseInt(match[2], 10) - 1; // 0-indexed
      let yearNum = parseInt(match[3], 10);
      if (yearNum < 100) yearNum += 2000;
      if (!isNaN(dayNum) && !isNaN(monthNum) && !isNaN(yearNum)) {
        targetTimestamps.push(new Date(yearNum, monthNum, dayNum).getTime());
      }
    }

    // 2. Check YYYY-MM-DD or YYYY/MM/DD (e.g. 2026-07-20)
    const isoRegex = /\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/g;
    while ((match = isoRegex.exec(textToCheck)) !== null) {
      const yearNum = parseInt(match[1], 10);
      const monthNum = parseInt(match[2], 10) - 1;
      const dayNum = parseInt(match[3], 10);
      if (!isNaN(dayNum) && !isNaN(monthNum) && !isNaN(yearNum)) {
        targetTimestamps.push(new Date(yearNum, monthNum, dayNum).getTime());
      }
    }

    // 3. Check Jul/July/Aug XX (e.g. Jul 20, July 21)
    const monthNamesRegex = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|July|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})\b/gi;
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, july: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    while ((match = monthNamesRegex.exec(textToCheck)) !== null) {
      const mStr = match[1].toLowerCase();
      const monthNum = monthMap[mStr] ?? 6;
      const dayNum = parseInt(match[2], 10);
      if (!isNaN(dayNum)) {
        targetTimestamps.push(new Date(currentYear, monthNum, dayNum).getTime());
      }
    }

    if (targetTimestamps.length > 0) {
      // Use Math.max so that when multiple date strings/fallback ISOs exist (e.g. 20-07-2026 alongside today's date),
      // the actual scheduled future date takes precedence over any old/default timestamp.
      const primaryTargetTimestamp = Math.max(...targetTimestamps);

      // If today is strictly BEFORE the scheduled date (e.g. today is Jul 15, scheduled is Jul 20)
      if (todayTimestamp < primaryTargetTimestamp) {
        const targetDateObj = new Date(primaryTargetTimestamp);
        const formattedTarget = targetDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        const outcome = {
          isUnlocked: false,
          reason: `Assessment sealed until your scheduled date (${profile.interviewDate && profile.interviewDate !== "Awaiting slot" ? profile.interviewDate : formattedTarget}). Questions will become accessible automatically on your interview day.`
        };
        console.log("[checkTimeLockStatus] LOCKED (future date):", outcome, { primaryTargetTimestamp, todayTimestamp, formattedTarget });
        return outcome;
      }

      // If today IS the target interview day, check if the scheduled hour has arrived yet
      if (todayTimestamp === primaryTargetTimestamp) {
        let requiredHour = 0;
        if (/9:00 AM|Morning/i.test(textToCheck)) requiredHour = 9;
        else if (/2:00 PM|14:00|Afternoon/i.test(textToCheck)) requiredHour = 14;
        else if (/6:00 PM|18:00|Evening/i.test(textToCheck)) requiredHour = 18;
        else {
          const matchTime = textToCheck.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (matchTime) {
            let h = parseInt(matchTime[1], 10);
            if (matchTime[3].toUpperCase() === 'PM' && h < 12) h += 12;
            if (matchTime[3].toUpperCase() === 'AM' && h === 12) h = 0;
            requiredHour = h;
          }
        }

        if (currentHour < requiredHour) {
          const outcome = {
            isUnlocked: false,
            reason: `Today is your interview day (${profile.interviewDate}), but your scheduled time slot has not started yet. Assessment will unlock around ${requiredHour > 12 ? requiredHour - 12 : requiredHour}:00 ${requiredHour >= 12 ? 'PM' : 'AM'}.`
          };
          console.log("[checkTimeLockStatus] LOCKED (same day, earlier hour):", outcome);
          return outcome;
        }
      }
    }

    // Check exact ISO timestamp directly if present
    if (profile.scheduledAtISO) {
      const schedTime = new Date(profile.scheduledAtISO).getTime();
      if (!isNaN(schedTime) && new Date().getTime() < schedTime) {
        const formattedDate = new Date(profile.scheduledAtISO).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
        const outcome = {
          isUnlocked: false,
          reason: `Assessment sealed until your scheduled date & time: ${formattedDate}. The studio questions will unlock automatically once your interview session starts.`
        };
        console.log("[checkTimeLockStatus] LOCKED (ISO timestamp future):", outcome);
        return outcome;
      }
    }

    if (targetTimestamps.length === 0 && !profile.scheduledAtISO) {
      const outcome = {
        isUnlocked: false,
        reason: "Your interview schedule has not been confirmed yet. Assessment remains sealed until HR confirms your scheduled interview date and time."
      };
      console.log("[checkTimeLockStatus] LOCKED (not scheduled yet):", outcome);
      return outcome;
    }

    console.log("[checkTimeLockStatus] UNLOCKED (scheduled time arrived):", { profile });
    return { isUnlocked: true, reason: "" };
  };
  // ── Webcam consent gate — modal shown once when entering the studio tab ──
  const [webcamConsented, setWebcamConsented] = useState(false);

  // Reset consent each time the candidate leaves the studio so modal re-appears
  useEffect(() => {
    if (activeTab !== 'studio') setWebcamConsented(false);
  }, [activeTab]);

  const answeredQsRef = useRef(answeredQs);
  useEffect(() => {
    answeredQsRef.current = answeredQs;
  }, [answeredQs]);

  useEffect(() => {
    if (activeTab === 'studio' && webcamConsented && !isAssessmentFinished) {
      const interval = setInterval(() => {
        setStudioTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsAssessmentFinished(true);
            syncAnswersToBackend(answeredQsRef.current, true);
            showToast("⏳ Time limit expired! Assessment automatically closed and submitted for evaluation.", "success");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else if (activeTab !== 'studio' || !webcamConsented) {
      setStudioTimerSeconds(20 * 60);
    }
  }, [activeTab, webcamConsented, isAssessmentFinished]);

  // ── Proctoring (activates only AFTER webcam consent, inside studio tab) ──
  const proctoring = useProctoring(activeTab === 'studio' && webcamConsented);

  // Handle score reaching 0
  useEffect(() => {
    if (proctoring.integrityScore <= 0 && activeTab === 'studio' && webcamConsented && !isAssessmentFinished) {
      setIsAssessmentFinished(true);
      syncAnswersToBackend(answeredQsRef.current, true);
      showToast("🚫 Proctoring trust score depleted (0%)! Assessment automatically closed and submitted for evaluation.", "error");
    }
  }, [proctoring.integrityScore, activeTab, webcamConsented, isAssessmentFinished]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('yen_access_token');
      const apiUrl = getApiUrl();
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

  useEffect(() => {
    fetchProfile();
  }, [user.name]);

  const defaultDaysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const daysOfWeek = (profile?.proposedDates && profile.proposedDates.length > 0)
    ? profile.proposedDates 
    : defaultDaysOfWeek;

  const timeWindows = [
    '9:00 AM - 12:00 PM',
    '2:00 PM - 5:00 PM',
    '6:00 PM - 10:00 PM'
  ];

  const toggleDay = (day: string) => {
    setIsAvailabilitySaved(false);
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        if (prev.length >= 3) {
          showToast("⚠️ You can select a maximum of 3 preferred days.", "error");
          return prev;
        }
        return [...prev, day];
      }
    });
  };

  const toggleSlot = (slot: string) => {
    setIsAvailabilitySaved(false);
    setSelectedSlots([slot]);
  };

  const handleSaveAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAvailability(true);
    try {
      const token = localStorage.getItem('yen_access_token');
      const apiUrl = getApiUrl();
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
        if (data.profile) {
          setProfile(data.profile);
        } else {
          await fetchProfile();
        }
        showToast("✓ Availability Preferences Saved! Your slot is confirmed & synced with HR.", "success");
      } else {
        showToast(data.detail || "Failed to save availability preferences.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Connection error — could not sync availability with server.", "error");
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const syncAnswersToBackend = async (answersMap: { [key: number]: { answer: string; timestamp: string } }, isFinal: boolean) => {
    if (isMockInterviewMode) return; // Do not sync mock interview answers (`mock interview questionuhm hr la jegenrate akira questions onna irukka kutathu`)
    try {
      const activeList = profile?.generatedQuestions || [];
      const payloadAnswers: { [key: string]: any } = {};
      Object.keys(answersMap).forEach((key) => {
        const idx = Number(key);
        const qObj = activeList[idx];
        payloadAnswers[key] = {
          question: qObj?.question || `Question #${idx + 1}`,
          category: qObj?.category || "Technical Assessment",
          answer: answersMap[idx]?.answer || "",
          timestamp: answersMap[idx]?.timestamp || new Date().toLocaleTimeString()
        };
      });

      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/api/v1/interview/submit-answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_email: user.email,
          answered_qs: payloadAnswers,
          is_final: isFinal
        })
      });
    } catch (err) {
      console.error("Failed to sync assessment answers to backend:", err);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || isSynthesizing) return;

    // Clean out any prompt prefix (`remove this and keep my response`)
    let submittedAnswer = currentInput.trim();
    submittedAnswer = submittedAnswer.replace(/^Answering[\s\S]*?My Response:\s*/i, '').trim();
    if (!submittedAnswer) submittedAnswer = currentInput.trim();

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newCandMsg = {
      sender: 'candidate' as const,
      text: submittedAnswer,
      timestamp: timeStr
    };
    setMessages(prev => [...prev, newCandMsg]);
    setAnsweredQs(prev => {
      const nextAnswers = { ...prev, [currentQuestionIdx]: { answer: submittedAnswer, timestamp: timeStr } };
      syncAnswersToBackend(nextAnswers, false);
      return nextAnswers;
    });
    setCurrentInput("");
    setIsSynthesizing(true);

    setTimeout(() => {
      const activeList = isMockInterviewMode ? getMockPracticeQuestions(profile?.role || "Engineer", profile?.skills || []) : (profile?.generatedQuestions || []);
      const totalCount = activeList.length || 1;
      const isFinal = currentQuestionIdx >= totalCount - 1;

      const aiResponseText = isFinal
        ? "✅ Final answer logged. Please click '⚡ Finalize Assessment 🎉' above to complete."
        : `✅ Answer #${currentQuestionIdx + 1} recorded. Automatically transitioning to Question #${currentQuestionIdx + 2}...`;

      const aiResponse = {
        sender: 'ai' as const,
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsSynthesizing(false);
      if (isFinal) {
        showToast("🎉 Final answer submitted! Click '⚡ Finalize Assessment 🎉' above.", "success");
      } else {
        showToast("✅ Answer submitted! Automatically loading next question...", "success");
        const nextIdx = currentQuestionIdx + 1;
        setCurrentQuestionIdx(nextIdx);
        setCurrentInput("");
      }
    }, 1500);
  };

  const timeLockOutcome = checkTimeLockStatus();

  const sidebarItems: { id: CandidateTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'My Profile & Applications', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'availability', label: 'Availability Screen', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { 
      id: 'studio' as CandidateTab, 
      label: 'AI Interview Panel', 
      icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z'
    }
  ];

  const currentTabInfo = sidebarItems.find(item => item.id === activeTab) || {
    id: activeTab,
    label: activeTab === 'studio' ? 'AI Interview Panel (Sealed)' : activeTab === 'availability' ? 'Availability Screen' : 'My Profile & Applications'
  };

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
                onClick={() => {
                  setActiveTab(item.id);
                }}
                className={`w-full px-3.5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer group ${isActive
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
            {timeLockOutcome.isUnlocked && (
              <button
                onClick={() => setActiveTab('studio')}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-600/20 transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>Enter AI Studio</span>
              </button>
            )}
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
                      <span>📍 {profile?.location || "Chennai, India"}</span>
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
                    onClick={() => {
                      if (!timeLockOutcome.isUnlocked && !isMockInterviewMode) {
                        showToast("Session Locked! Accessible only when the interview date and time is met.", "warning");
                      } else {
                        setActiveTab('studio');
                      }
                    }}
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
                        className={`py-2.5 px-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${step.state === 'active'
                          ? 'bg-gradient-to-r from-purple-900/30 to-slate-900/90 border-purple-500/50 shadow-sm shadow-purple-500/10'
                          : step.state === 'completed'
                            ? 'bg-slate-950/40 border-emerald-500/30'
                            : 'bg-slate-950/20 border-slate-800/60 opacity-60'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 border ${step.state === 'active'
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
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${step.state === 'active'
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
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isAvailabilitySaved ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
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
                            onClick={() => !isAvailabilitySaved && toggleDay(day)}
                            disabled={isAvailabilitySaved}
                            className={`p-4 rounded-2xl border text-xs font-bold transition-all ${isAvailabilitySaved ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'} flex items-center justify-between ${isSelected
                              ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md shadow-purple-500/10'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                          >
                            <span>{day}</span>
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isSelected ? 'bg-purple-500 text-white' : 'bg-slate-800 text-transparent'
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
                            onClick={() => !isAvailabilitySaved && toggleSlot(slot)}
                            disabled={isAvailabilitySaved}
                            className={`p-4 rounded-2xl border text-xs font-bold transition-all ${isAvailabilitySaved ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'} flex items-center justify-between ${isSelected
                              ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/10'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                          >
                            <span>{slot}</span>
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-transparent'
                              }`}>
                              ✓
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>


                  <div className="pt-6 border-t border-slate-800 flex justify-end gap-3">
                    {!isAvailabilitySaved ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDays([]);
                            setSelectedSlots([]);
                            setIsAvailabilitySaved(false);
                          }}
                          className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition-all cursor-pointer"
                        >
                          Clear Selections
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingAvailability}
                          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-purple-600/25 transition-all cursor-pointer active:scale-95 disabled:opacity-60 flex items-center justify-center space-x-2"
                        >
                          {isSavingAvailability && (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          )}
                          <span>{isSavingAvailability ? 'Confirming with HR...' : 'Save Availability & Confirm AI Studio Slot'}</span>
                        </button>
                      </>
                    ) : (
                      <div className="px-6 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold w-full text-center">
                        ✅ Availability Confirmed. Your selections are locked. The AI Interview Panel will unlock automatically on your scheduled date & time.
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* VIEW 3: AI INTERVIEW PANEL (CASE 1: OFFICIAL ASSESSMENT TIME-LOCKED & SEALED) */}
          {activeTab === 'studio' && !checkTimeLockStatus().isUnlocked && !isMockInterviewMode && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="p-10 rounded-3xl bg-slate-900/95 border-2 border-red-500/50 shadow-2xl space-y-6 text-center max-w-3xl mx-auto my-6">
                <div className="w-20 h-20 rounded-3xl bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto text-4xl shadow-xl animate-pulse">
                  🔒
                </div>
                <div className="space-y-3 max-w-xl mx-auto">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 font-extrabold text-xs uppercase tracking-wider animate-bounce">
                    <span>⚠️ Session Locked</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">AI Interview Session is Currently Locked</h2>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                    Per HR security protocol, your official technical assessment is strictly sealed and cannot be accessed before your scheduled interview date & time.
                  </p>
                </div>
                <div className="p-6 rounded-2xl bg-slate-950/90 border border-slate-800 max-w-lg mx-auto space-y-3.5 text-left shadow-inner">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold">Scheduled Date & Time:</span>
                    <span className="font-mono font-bold text-purple-300 bg-purple-500/15 px-3.5 py-1.5 rounded-xl border border-purple-500/30">
                      {profile?.interviewDate || "Awaiting slot"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-900">
                    <span className="text-slate-400 font-semibold">Access Status:</span>
                    <span className="text-red-400 font-black flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      <span>LOCKED — Access Denied</span>
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 pt-3 border-t border-slate-900 leading-normal bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
                    💡 <strong className="text-amber-300">Lock Details:</strong> {checkTimeLockStatus().reason}
                  </div>
                  <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-900">
                    <span className="text-slate-400 font-semibold">Demo Control:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForceUnlocked(true);
                        showToast("Unlocked AI Interview Panel! It is now visible in the left sidebar menu.", "success");
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-bold text-xs border border-purple-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>⚡ [Demo] Force Unlock & Show in Menu</span>
                    </button>
                  </div>
                </div>

                {/* Practice Banner */}
                <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/80 via-indigo-950/80 to-slate-900 border border-purple-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 max-w-2xl mx-auto text-left">
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span className="text-lg">🎯</span>
                      <span>Want to Practice While You Wait?</span>
                    </h3>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Try our interactive <strong className="text-purple-300">Mock Interview Studio</strong>. Practice warm-up and behavioral questions right now.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMockInterviewMode(true);
                      setMessages([
                        {
                          sender: 'ai',
                          text: `Welcome to your practice Mock Interview for the ${profile?.role || 'Technical'} role! Here you can practice warm-up and behavioral questions while waiting for your official session. Select any Mock Practice question below to begin!`,
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                      ]);
                      showToast("Started Mock Interview Studio! Practice questions loaded.", "success");
                    }}
                    className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <span>⚡ Start Mock Interview</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: AI INTERVIEW PANEL (SUPER INTUITIVE SEQUENTIAL ASSESSMENT STUDIO (`proper ah easy understandable ah`)) */}
          {activeTab === 'studio' && (checkTimeLockStatus().isUnlocked || isMockInterviewMode) && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {(() => {
                const activeList = isMockInterviewMode ? getMockPracticeQuestions(profile?.role || "Engineer", profile?.skills || []) : (profile?.generatedQuestions || []);
                const totalQs = activeList.length || 1;
                const currentQ = activeList[currentQuestionIdx] || activeList[0];
                const isCurrentAnswered = !!answeredQs[currentQuestionIdx];

                if (isAssessmentFinished) {
                  return (
                    <div className="p-10 rounded-3xl bg-slate-900/95 border border-emerald-500/40 shadow-2xl text-center space-y-6 max-w-3xl mx-auto my-4 animate-in zoom-in-95 duration-500">
                      <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-4xl shadow-xl animate-bounce">
                        🎉
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                          {isMockInterviewMode ? 'Mock Practice Studio Completed!' : 'Official Technical Assessment Finalized!'}
                        </h2>
                        <p className="text-xs md:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                          Congratulations! You have successfully answered all <strong className="text-emerald-300">{totalQs} questions</strong> in strict step-by-step sequence. Your answers have been logged into the HR evaluation engine.
                        </p>
                      </div>
                      <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 max-w-md mx-auto text-left space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-semibold">Total Questions Answered:</span>
                          <span className="font-mono font-bold text-emerald-400">{Object.keys(answeredQs).length} / {totalQs} Completed</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-900">
                          <span className="text-slate-400 font-semibold">Assessment Protocol:</span>
                          <span className="text-purple-300 font-bold">Unidirectional & Verified </span>
                        </div>
                      </div>
                      <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                        {isMockInterviewMode && (
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentQuestionIdx(0);
                              setAnsweredQs({});
                              setIsAssessmentFinished(false);
                              showToast("Restarted session from Question 1.", "success");
                            }}
                            className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer shadow-lg"
                          >
                            <span>🔄 Practice Again From Question 1</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* Top Studio Header Bar (Super Intuitive Status) */}
                    <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/90 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3 h-3 rounded-full animate-pulse ${isMockInterviewMode ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                          <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
                            {isMockInterviewMode ? '🎯 Mock Interview Practice Workspace' : '⚡ Official HR Technical Assessment Workspace'}
                          </h2>
                        </div>
                        <p className="text-xs text-slate-400">
                          {isMockInterviewMode
                            ? 'Warm-up studio to test your communication skills (`Distinct from official HR questions`).'
                            : 'Live step-by-step evaluation. Answer each question carefully before proceeding.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                        <div className={`px-4 py-2 rounded-xl font-mono font-black text-xs flex items-center gap-2 border shadow-lg ${
                          studioTimerSeconds <= 300 
                            ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' 
                            : 'bg-slate-950/90 text-emerald-400 border-slate-800'
                        }`}>
                          <span>⏱️ Time Remaining:</span>
                          <span className="text-sm">
                            {Math.floor(studioTimerSeconds / 60).toString().padStart(2, '0')}:
                            {(studioTimerSeconds % 60).toString().padStart(2, '0')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans font-medium">/ 20:00</span>
                        </div>
                        {isMockInterviewMode ? (
                          <button
                            type="button"
                            onClick={() => setIsMockInterviewMode(false)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <span>← Return to Official Status Screen</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setIsForceUnlocked(false);
                              showToast("Locked official questions.", "success");
                            }}
                            className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <span>🔒 [Demo] Lock Official Assessment Again</span>
                          </button>
                        )}
                        <span className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs border flex items-center gap-1.5 shadow-md ${isMockInterviewMode
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}>
                          <span>{isMockInterviewMode ? '🎯 Mock Mode Active' : '🟢 Official Assessment Live'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Step-by-Step Progress & Navigation Control (`Easy & Understandable`) */}
                    <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="px-3.5 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-300 font-mono font-black text-xs flex items-center gap-1.5">
                          <span>📍 Step {currentQuestionIdx + 1} of {totalQs}</span>
                        </span>

                        <div className="w-32 sm:w-44 h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                            style={{ width: `${Math.round(((currentQuestionIdx + (isCurrentAnswered ? 1 : 0)) / totalQs) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-300">
                          {Math.round(((currentQuestionIdx + (isCurrentAnswered ? 1 : 0)) / totalQs) * 100)}% Complete
                        </span>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Only show Finalize button on the last question */}
                        {currentQuestionIdx >= totalQs - 1 && (
                          <button
                            type="button"
                            disabled={!isCurrentAnswered || isSynthesizing}
                            onClick={() => {
                              setIsAssessmentFinished(true);
                              syncAnswersToBackend(answeredQs, true);
                              showToast("🎉 All assessment questions completed and finalized! Responses evaluated & synced to HR Dashboard.", "success");
                            }}
                            className={`px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg ${isCurrentAnswered
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/25 cursor-pointer animate-pulse'
                              : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                              }`}
                          >
                            <span>⚡ Finalize Assessment 🎉</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                      {/* LEFT: Single Active Question Box (High Contrast, Easy to Understand) */}
                      <div className="lg:col-span-2 p-7 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 border-purple-500/40 shadow-2xl space-y-5 relative overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-2xl bg-purple-500 text-white font-black text-base flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30">
                            #{currentQuestionIdx + 1}
                          </span>
                          <div>
                            <h3 className="text-sm md:text-base font-extrabold text-white flex items-center gap-2">
                              <span>{currentQ ? (currentQ.category || 'Technical Assessment') : 'Dynamic Assessment Question'}</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {isCurrentAnswered
                                ? '✅ Answer Submitted — Click "Next Question ➔" above to continue'
                                : '⏳ Active Evaluation Question — Please submit your response in the box below'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 ${isCurrentAnswered
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md shadow-emerald-500/10'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          }`}>
                          {isCurrentAnswered ? 'Status: Completed ✅' : 'Status: Awaiting Answer ⏳'}
                        </span>
                      </div>

                      {/* Question Text Box */}
                      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/90 shadow-inner">
                        <p className="text-base md:text-lg font-bold text-slate-100 leading-relaxed font-sans">
                          {currentQ ? (currentQ.question || currentQ.question_text) : 'Please answer the prompt displayed in the console below.'}
                        </p>
                      </div>

                      {/* Clean Answer Submission Box (`Super Easy & Intuitive`) */}
                      <div className="pt-2 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span>💬 Your Detailed Response for Question #{currentQuestionIdx + 1}:</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setCurrentInput("When an agent node crashes in LangGraph, the PostgreSQL checkpointer restores the exact state dictionary from the last checkpoint. This allows retry handlers or fallback nodes to resume execution without re-running previous LLM calls or losing candidate context.")}
                            className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold underline cursor-pointer transition-colors"
                          >
                            ⚡ Auto-Fill Sample Technical Answer (Demo)
                          </button>
                        </div>

                        <form onSubmit={handleSendMessage} className="space-y-3">
                          <textarea
                            rows={4}
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            placeholder={isCurrentAnswered ? "Answer already recorded for this question. Click Next Question above to advance!" : "Type your detailed technical explanation here..."}
                            disabled={isSynthesizing || isCurrentAnswered}
                            className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/60 disabled:opacity-50 transition-all font-mono leading-relaxed"
                          />
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-xs text-slate-400">
                              {isCurrentAnswered
                                ? '💡 Answer saved! Click the green Next Question ➔ button on top right to proceed.'
                                : '💡 Tip: Explain architectural decisions clearly. Once submitted, your response is locked per exam rules.'}
                            </span>
                            {!isCurrentAnswered && (
                              <button
                                type="submit"
                                disabled={!currentInput.trim() || isSynthesizing}
                                className="px-8 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-xl shadow-purple-600/30 transition-all disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center gap-2"
                              >
                                <span>🚀 Submit & Record Answer</span>
                              </button>
                            )}
                          </div>
                        </form>
                      </div>
                    </div>
                    {/* RIGHT: Proctoring Panel */}
                    <div className="w-full shrink-0 sticky top-4">
                      <ProctoringPanel
                        videoRef={proctoring.videoRef}
                        violations={proctoring.violations}
                        integrityScore={proctoring.integrityScore}
                        isWebcamActive={proctoring.isWebcamActive}
                        faceStatus={proctoring.faceStatus}
                        gazeZone={proctoring.gazeZone}
                        permissionDenied={proctoring.permissionDenied}
                      />
                    </div>
                  </div>

                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </main>

      {/* Dynamic Toast Notification Panel */}
      {toast.visible && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-6 duration-300 pointer-events-none">
          <div className={`p-4 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center space-x-3.5 max-w-sm ${toast.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
            : 'bg-red-950/80 border-red-500/30 text-red-200'
            }`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
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

      {/* ── Webcam Consent Modal ───────────────────────────────────────────── */}
      {activeTab === 'studio' && checkTimeLockStatus().isUnlocked && !webcamConsented && !isMockInterviewMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(2,6,23,0.85)' }}>
          {/* Glow blobs */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/3 right-1/3 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative w-full max-w-md bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl shadow-indigo-500/10 overflow-hidden">
            {/* Top gradient bar */}
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <div className="p-8 space-y-6">
              {/* Icon + title */}
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shadow-xl shadow-indigo-500/10">
                    <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15 10l4.553-2.07A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                    </svg>
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 border-2 border-slate-900 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white tracking-tight">Webcam Required</h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    This interview is proctored by YEN AI. Your webcam must be enabled before you can begin.
                  </p>
                </div>
              </div>

              {/* What is monitored */}
              <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-2.5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">Monitoring in this session</p>
                {[
                  { icon: '📷', label: 'Webcam feed & face presence detection' },
                  { icon: '👁', label: 'Eye movement & gaze direction tracking' },
                  { icon: '🖥',  label: 'Tab switches & window focus changes' },
                  { icon: '📋', label: 'Clipboard — copy, paste & cut blocked' },
                  { icon: '⌨️', label: 'Keyboard shortcuts (Ctrl+C/V, F12, etc.)' },
                  { icon: '🖱',  label: 'Right-click context menu blocked' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-base shrink-0">{item.icon}</span>
                    <span className="text-[11px] text-slate-300 font-medium">{item.label}</span>
                    <span className="ml-auto text-[10px] text-red-400 font-bold shrink-0">ACTIVE</span>
                  </div>
                ))}
              </div>

              {/* Consent note */}
              <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                By clicking <strong className="text-slate-300">Enable Webcam &amp; Start</strong>, you acknowledge that this session is
                monitored. Violations are recorded and reviewed by the HR team.
              </p>

              {/* Action buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setWebcamConsented(true)}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 10l4.553-2.07A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                  Enable Webcam &amp; Start Interview
                </button>
                <button
                  onClick={() => setActiveTab('overview')}
                  className="w-full py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs transition-all cursor-pointer"
                >
                  ← Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
