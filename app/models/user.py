import enum
from sqlalchemy import Column, String, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    RECRUITER = "recruiter"
    CANDIDATE = "candidate"


class Company(Base):
    __tablename__ = "companies"

    name = Column(String(255), nullable=False, index=True)
    industry = Column(String(100), nullable=True)
    website = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)

    users = relationship("User", back_populates="company")
    jobs = relationship("Job", back_populates="company")


class User(Base):
    __tablename__ = "users"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CANDIDATE, nullable=False, index=True)
    status = Column(String(50), default="active", nullable=False)

    company = relationship("Company", back_populates="users")
