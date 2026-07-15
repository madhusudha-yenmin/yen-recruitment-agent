from sqlalchemy import Column, String, Float, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
try:
    from pgvector.sqlalchemy import Vector  # type: ignore # noqa
except ImportError:
    from sqlalchemy.types import UserDefinedType
    class Vector(UserDefinedType):
        def __init__(self, dim=None):
            self.dim = dim
        def get_col_spec(self, **kw):
            return f"vector({self.dim})" if self.dim else "vector"
from app.db.base_class import Base


class Candidate(Base):
    __tablename__ = "candidates"

    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), index=True, nullable=True)
    linkedin = Column(String(255), index=True, nullable=True)
    github = Column(String(255), nullable=True)
    portfolio = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    experience = Column(Float, nullable=True)  # years of experience
    current_company = Column(String(255), nullable=True)
    notice_period = Column(String(100), nullable=True)
    status = Column(String(50), default="new", nullable=False, index=True)
    proposed_dates = Column(JSONB, nullable=True)

    resumes = relationship("Resume", back_populates="candidate")
    skills = relationship("CandidateSkill", back_populates="candidate")
    embeddings = relationship("Embedding", back_populates="candidate")
    interviews = relationship("Interview", back_populates="candidate")
    evaluations = relationship("Evaluation", back_populates="candidate")
    reports = relationship("Report", back_populates="candidate")


class Embedding(Base):
    __tablename__ = "embeddings"

    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    vector_reference = Column(Vector(1536), nullable=True)  # OpenAI embedding dimension
    model = Column(String(100), default="text-embedding-3-small", nullable=False)

    candidate = relationship("Candidate", back_populates="embeddings")


class Resume(Base):
    __tablename__ = "resumes"

    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    file_url = Column(String(500), nullable=False)
    parsed_text = Column(String, nullable=True)
    embedding_id = Column(UUID(as_uuid=True), ForeignKey("embeddings.id"), nullable=True)
    
    # Structured resume metadata extracted by LLM
    parsed_metadata = Column(JSONB, nullable=True)

    candidate = relationship("Candidate", back_populates="resumes")


class CandidateSkill(Base):
    __tablename__ = "candidate_skills"

    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False, index=True)
    skill_name = Column(String(100), nullable=False, index=True)
    years = Column(Float, nullable=True)
    level = Column(String(50), nullable=True)  # beginner, intermediate, advanced, expert
    verified = Column(Boolean, default=False, nullable=False)

    candidate = relationship("Candidate", back_populates="skills")
