from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base, utc_now


class Interview(Base):
    __tablename__ = "interviews"

    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False, index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    mode = Column(String(50), default="ai-chat", nullable=False)  # ai-chat, video, phone, in-person
    status = Column(String(50), default="scheduled", nullable=False, index=True)
    transcript = Column(JSONB, nullable=True)
    video_url = Column(String(500), nullable=True)
    audio_url = Column(String(500), nullable=True)
    duration = Column(Integer, nullable=True)  # in seconds

    candidate = relationship("Candidate", back_populates="interviews")
    job = relationship("Job", back_populates="interviews")
    questions = relationship("Question", back_populates="interview")


class Question(Base):
    __tablename__ = "questions"

    interview_id = Column(UUID(as_uuid=True), ForeignKey("interviews.id"), nullable=False, index=True)
    type = Column(String(100), nullable=True)  # technical, behavioral, situational
    difficulty = Column(String(50), nullable=True)  # easy, medium, hard
    question = Column(String, nullable=False)

    interview = relationship("Interview", back_populates="questions")
    answers = relationship("Answer", back_populates="question")


class Answer(Base):
    __tablename__ = "answers"

    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False, index=True)
    candidate_answer = Column(String, nullable=False)
    evaluation_notes = Column(String, nullable=True)
    score = Column(Float, nullable=True)

    question = relationship("Question", back_populates="answers")


class Evaluation(Base):
    __tablename__ = "evaluations"

    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    technical = Column(Float, nullable=True)
    communication = Column(Float, nullable=True)
    problem_solving = Column(Float, nullable=True)
    leadership = Column(Float, nullable=True)
    behavior = Column(Float, nullable=True)
    overall_score = Column(Float, nullable=True, index=True)
    recommendation = Column(String(100), nullable=True)  # strong-hire, hire, no-hire
    
    # Critic agent review notes and bias check score
    critic_review = Column(JSONB, nullable=True)

    candidate = relationship("Candidate", back_populates="evaluations")


class Report(Base):
    __tablename__ = "reports"

    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False, index=True)
    summary = Column(String, nullable=False)
    pros = Column(JSONB, nullable=True)
    cons = Column(JSONB, nullable=True)
    risks = Column(JSONB, nullable=True)
    recommendation = Column(String(100), nullable=True)
    generated_by = Column(String(100), default="evaluation-agent", nullable=False)

    candidate = relationship("Candidate", back_populates="reports")
    job = relationship("Job", back_populates="reports")


class Notification(Base):
    __tablename__ = "notifications"

    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    type = Column(String(100), nullable=False)
    status = Column(String(50), default="pending", nullable=False)
    channel = Column(String(50), default="email", nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)


class Session(Base):
    __tablename__ = "sessions"

    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True, index=True)
    current_agent = Column(String(100), nullable=True)
    state = Column(JSONB, nullable=True)
    checkpoint = Column(JSONB, nullable=True)
    status = Column(String(50), default="active", nullable=False)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)


class AgentLog(Base):
    __tablename__ = "agent_logs"

    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True, index=True)
    agent_name = Column(String(100), nullable=False, index=True)
    input = Column(JSONB, nullable=True)
    output = Column(JSONB, nullable=True)
    latency = Column(Float, nullable=True)  # in seconds
    token_usage = Column(JSONB, nullable=True)
    cost = Column(Float, nullable=True)
    status = Column(String(50), default="success", nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    ip_address = Column(String(50), nullable=True)
