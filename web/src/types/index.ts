export type UserRole = 'hr' | 'candidate';

export type HRTab = 'overview' | 'upload-jd' | 'ranking' | 'interviews' | 'questionnaire' | 'approvals' | 'score-definition';
export type CandidateTab = 'overview' | 'availability' | 'studio';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company?: string;
  department?: string;
  techStack?: string[];
  experienceYears?: number;
  avatarUrl?: string;
  availability?: {
    days: string[];
    timeSlots: string[];
    timezone: string;
    isConfirmed?: boolean;
  };
  interviewStatus?: 'Scheduled' | 'Pending';
}

export type AuthView = 'signin' | 'signup' | 'forgot-password' | 'reset-password';

export interface AgentLog {
  id: string;
  timestamp: string;
  agentName: string;
  action: string;
  latency: string;
  tokens: number;
  cost: string;
  status: 'success' | 'warning' | 'error';
}

export interface CandidateMatch {
  id: string;
  name: string;
  email: string;
  matchScore: number;
  ranking: number;
  skills: string[];
  experience: string;
  salary: string;
  location: string;
  status: 'Pending HR Review' | 'Offer Sent' | 'Rejected' | 'Hold';
  recommendation: 'strong-hire' | 'hire' | 'no-hire';
  interviewStatus: 'Scheduled' | 'Pending';
  interviewDate?: string;
  interviewMode?: 'AI Chat Studio' | 'AI Voice Studio';
  evaluationDetails?: {
    technical: number;
    communication: number;
    problemSolving: number;
    overall: number;
    criticPassed: boolean;
  };
}
