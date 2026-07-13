"""
Resume Upload & ATS Scoring API
POST /api/v1/resume/parse  — accepts one or more PDF files + job_title + experience
"""
import uuid
import logging
from typing import List

logger = logging.getLogger(__name__)

import random
import string
import random
import string
from pydantic import BaseModel
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.db.session import get_db
from app.models.candidate import Candidate, Resume as ResumeModel, CandidateSkill
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from app.services.notifications import send_scheduling_email

from app.agents.resume_parser import parse_and_score_resume, ATSResult

router = APIRouter()


@router.post("/parse", response_model=List[ATSResult], status_code=status.HTTP_200_OK)
async def parse_resumes(
    files: List[UploadFile] = File(..., description="One or more PDF resume files"),
    job_title: str = Form(default="Software Engineer", description="Active job title for ATS matching"),
    experience: str = Form(default="1+ years", description="Required experience e.g. '3+ years'"),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload one or more PDF resumes.
    Returns ATS score and parsed fields for each resume, sorted high-to-low by ATS score.
    Saves parsed profiles and skills to the database.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    results: List[ATSResult] = []

    for file in files:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail=f"Only PDF files are supported. Got: {file.filename}"
            )

        pdf_bytes = await file.read()

        if len(pdf_bytes) == 0:
            raise HTTPException(status_code=400, detail=f"File '{file.filename}' is empty.")

        candidate_id = f"resume-{uuid.uuid4().hex[:8]}"

        result = parse_and_score_resume(
            pdf_bytes=pdf_bytes,
            filename=file.filename,
            candidate_id=candidate_id,
            job_title=job_title,
            experience_req=experience,
        )
        
        # Save to DB
        try:
            cand_email = result.parsed.email or f"{result.parsed.name.lower().replace(' ', '.')}@example.com"
            
            # 1. Upsert Candidate
            stmt = select(Candidate).where(Candidate.email == cand_email)
            res = await db.execute(stmt)
            candidate = res.scalar_one_or_none()
            
            if not candidate:
                candidate = Candidate(
                    email=cand_email,
                    name=result.parsed.name,
                    phone=result.parsed.phone,
                    linkedin=result.parsed.linkedin,
                    github=result.parsed.github,
                    experience=result.parsed.experience_years,
                    status="new"
                )
                db.add(candidate)
                await db.flush()  # Generate UUID
            else:
                candidate.name = result.parsed.name or candidate.name
                candidate.phone = result.parsed.phone or candidate.phone
                candidate.linkedin = result.parsed.linkedin or candidate.linkedin
                candidate.github = result.parsed.github or candidate.github
                candidate.experience = result.parsed.experience_years or candidate.experience

            # Skip auto-creation of user account and sending email during parsing.
            # This is now triggered manually via the 'Schedule Interview' button.
            pass
            
            # 2. Upsert Resume Model
            stmt_res = select(ResumeModel).where(ResumeModel.candidate_id == candidate.id)
            res_m = await db.execute(stmt_res)
            db_resume = res_m.scalar_one_or_none()
            
            if not db_resume:
                db_resume = ResumeModel(
                    candidate_id=candidate.id,
                    file_url=file.filename,
                    parsed_text=result.parsed.raw_text_preview,
                    parsed_metadata=result.parsed.model_dump()
                )
                db.add(db_resume)
            else:
                db_resume.file_url = file.filename
                db_resume.parsed_text = result.parsed.raw_text_preview
                db_resume.parsed_metadata = result.parsed.model_dump()
                
            # 3. Re-save Candidate Skills
            await db.execute(delete(CandidateSkill).where(CandidateSkill.candidate_id == candidate.id))
            for skill in result.parsed.skills:
                cand_skill = CandidateSkill(
                    candidate_id=candidate.id,
                    skill_name=skill,
                    level="intermediate"
                )
                db.add(cand_skill)
                
            await db.commit()
            logger.info(f"Successfully saved parsed candidate '{candidate.name}' and resume metadata to database.")
        except Exception as db_exc:
            await db.rollback()
            logger.error(f"Failed to save candidate to DB: {db_exc}")

        # Print results directly in the terminal console
        print(f"\n========== RESUME PARSED & SCORED ==========")
        print(f"File:           {file.filename}")
        print(f"Candidate Name: {result.parsed.name}")
        print(f"Email:          {result.parsed.email or 'N/A'}")
        print(f"Phone:          {result.parsed.phone or 'N/A'}")
        print(f"Exp Years:      {result.parsed.experience_years:.1f}")
        print(f"ATS Score:      {result.ats_score}%")
        print(f"Recommendation: {result.recommendation.upper()}")
        print(f"Skills Found:   {', '.join(result.parsed.skills[:10])}{'...' if len(result.parsed.skills) > 10 else ''}")
        print(f"============================================\n")

        results.append(result)

    # Sort by ATS score descending
    results.sort(key=lambda r: r.ats_score, reverse=True)

    return results


class ScheduleRequest(BaseModel):
    email: str
    name: str
    job_title: str


@router.post("/schedule-interview", status_code=status.HTTP_200_OK)
async def schedule_interview_api(
    req: ScheduleRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Manually schedule an interview for a candidate.
    Creates user account, generates temporary OTP password, updates candidate status,
    and sends the interview invitation email via fastapi-mail.
    """
    try:
        # 1. Upsert User Account
        stmt_user = select(User).where(User.email == req.email)
        res_user = await db.execute(stmt_user)
        db_user = res_user.scalar_one_or_none()
        
        otp_password = "".join(random.choice(string.digits) for _ in range(8))
        
        if not db_user:
            db_user = User(
                email=req.email,
                password_hash=get_password_hash(otp_password),
                name=req.name,
                role=UserRole.CANDIDATE,
                status="active"
            )
            db.add(db_user)
        else:
            db_user.password_hash = get_password_hash(otp_password)
            db_user.name = req.name or db_user.name
            
        # 2. Update Candidate status to 'shortlisted' / 'Scheduled' and map applied job role
        stmt_cand = select(Candidate).where(Candidate.email == req.email)
        res_cand = await db.execute(stmt_cand)
        candidate = res_cand.scalar_one_or_none()
        if candidate:
            candidate.status = "shortlisted"
            candidate.current_company = req.job_title
            
        # 3. Send scheduling email to candidate
        from app.core.config import settings
        await send_scheduling_email(
            candidate_name=req.name,
            candidate_email=req.email,
            job_role=req.job_title,
            otp_password=otp_password,
            interview_link=f"{settings.CANDIDATE_PORTAL_URL}?email={req.email}"
        )
        
        await db.commit()

        # Broadcast WebSocket notification for real-time candidate updates
        try:
            from app.api.v1.recruitment import manager
            await manager.broadcast({"event": "candidates_updated"})
        except Exception as ws_err:
            logger.error(f"WebSocket broadcast from resume module failed: {ws_err}")

        return {"status": "success", "message": f"Interview scheduled and email sent to {req.email}"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to manually schedule interview: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to schedule interview: {str(e)}"
        )
