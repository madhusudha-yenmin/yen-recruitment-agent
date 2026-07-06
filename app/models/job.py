from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class Job(Base):
    __tablename__ = "jobs"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(String, nullable=False)
    experience = Column(String(100), nullable=True)
    salary_min = Column(Float, nullable=True)
    salary_max = Column(Float, nullable=True)
    location = Column(String(255), nullable=True)
    employment_type = Column(String(100), default="full-time", nullable=True)
    notice_period = Column(String(100), nullable=True)
    status = Column(String(50), default="open", nullable=False, index=True)
    
    # Flexible AI metadata for structured job analysis (extracted skills, evaluation criteria)
    parsed_requirements = Column(JSONB, nullable=True)

    company = relationship("Company", back_populates="jobs")
    interviews = relationship("Interview", back_populates="job")
    reports = relationship("Report", back_populates="job")
