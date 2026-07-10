"""
Resume Upload & ATS Scoring API
POST /api/v1/resume/parse  — accepts one or more PDF files + job_title + experience
"""
import uuid
import logging
from typing import List

logger = logging.getLogger(__name__)

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.db.session import get_db
from app.models.candidate import Candidate, Resume as ResumeModel, CandidateSkill

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
