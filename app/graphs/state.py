from typing import TypedDict, List, Dict, Any, Optional


class RecruiterStateSection(TypedDict, total=False):
    recruiter_id: Optional[str]
    company_id: Optional[str]
    permissions: List[str]
    organization: Optional[str]


class JobStateSection(TypedDict, total=False):
    job_id: Optional[str]
    title: Optional[str]
    description: Optional[str]
    skills: List[str]
    experience: Optional[str]
    salary_min: Optional[float]
    salary_max: Optional[float]
    notice_period: Optional[str]
    location: Optional[str]
    responsibilities: List[str]
    required_skills: List[str]
    preferred_skills: List[str]
    salary: Optional[str]
    education: Optional[str]


class DiscoveryStateSection(TypedDict, total=False):
    linkedin_boolean_query: Optional[str]
    total_sourced: int
    normalized_profiles: List[Dict[str, Any]]
    vector_embeddings_computed: bool


class CandidateStateSection(TypedDict, total=False):
    candidate_id: Optional[str]
    name: Optional[str]
    email: Optional[str]
    resume_url: Optional[str]
    raw_resume_text: Optional[str]
    parsed_profile: Dict[str, Any]
    skills: List[Dict[str, Any]]
    education: List[Dict[str, Any]]
    projects: List[Dict[str, Any]]
    certifications: List[str]
    experience_years: Optional[float]
    match_score: Optional[float]
    ranking: Optional[int]
    score_details: Dict[str, Any]
    skill_gap: List[str]
    recommendation: Optional[str]
    embedding_vector: Optional[List[float]]


class InterviewStateSection(TypedDict, total=False):
    interview_id: Optional[str]
    status: Optional[str]
    scheduled_at: Optional[str]
    scheduling_details: Dict[str, Any]
    mode: str
    questions: List[Dict[str, Any]]
    answers: List[Dict[str, Any]]
    transcript: List[Dict[str, Any]]
    audio_url: Optional[str]
    video_url: Optional[str]
    duration: Optional[int]
    current_question_index: int


class EvaluationStateSection(TypedDict, total=False):
    technical_score: Optional[float]
    communication_score: Optional[float]
    problem_solving_score: Optional[float]
    confidence_score: Optional[float]
    behavioral_score: Optional[float]
    overall_score: Optional[float]
    recommendation: Optional[str]
    critic_review: Dict[str, Any]


class ReportStateSection(TypedDict, total=False):
    summary: Optional[str]
    pros: List[str]
    cons: List[str]
    risks: List[str]
    recommendation: Optional[str]
    generated_by: Optional[str]


class DecisionStateSection(TypedDict, total=False):
    status: Optional[str]
    comparison_report: Dict[str, Any]
    selected_candidate: Optional[str]
    comments: Optional[str]


class ApprovalStateSection(TypedDict, total=False):
    status: str  # pending, approved, rejected, hold
    reviewer_id: Optional[str]
    comments: Optional[str]
    reviewed_at: Optional[str]


class NotificationStateSection(TypedDict, total=False):
    status: str  # pending, sent, failed, waiting
    sent_to: Optional[str]
    channel: str  # email, sms, dashboard
    sent_at: Optional[str]
    message: Optional[str]


class AgentLogSection(TypedDict, total=False):
    timestamp: str
    agent_name: str
    input: Any
    output: Any
    latency: float
    token_usage: Dict[str, int]
    cost: float
    errors: Optional[str]
    action: Optional[str]
    status: Optional[str]


class MetadataSection(TypedDict, total=False):
    session_id: str
    job_id: Optional[str]
    current_stage: str
    retry_count: int
    last_checkpoint: Optional[str]
    is_completed: bool


class RecruitmentState(TypedDict, total=False):
    """Global shared state for the end-to-end recruitment workflow (5-Agent Architecture)."""
    session_id: str
    recruiter: RecruiterStateSection
    job: JobStateSection
    discovery: DiscoveryStateSection
    candidates: List[CandidateStateSection]
    selected_candidate: Optional[CandidateStateSection]
    interview: InterviewStateSection
    evaluation: EvaluationStateSection
    report: ReportStateSection
    decision: DecisionStateSection
    approval: ApprovalStateSection
    notification: NotificationStateSection
    logs: List[AgentLogSection]
    metadata: MetadataSection


class InterviewState(TypedDict, total=False):
    """Dedicated state schema for real-time interactive AI interview sessions."""
    session_id: str
    interview_id: str
    candidate_id: str
    job_id: str
    job_analysis: JobStateSection
    candidate_profile: CandidateStateSection
    conversation_history: List[Dict[str, str]]
    current_question_index: int
    questions: List[Dict[str, Any]]
    answers: List[Dict[str, Any]]
    evaluation: EvaluationStateSection
    critic_review: Dict[str, Any]
    report: ReportStateSection
    is_complete: bool
    logs: List[AgentLogSection]
