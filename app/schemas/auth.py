from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.user import UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.CANDIDATE
    company_id: Optional[UUID] = None


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    role: UserRole
    status: str
    company_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
