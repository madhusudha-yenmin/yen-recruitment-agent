import uuid
import re
import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.candidate import Candidate, Resume as ResumeModel, CandidateSkill
from app.models.interview import AuditLog, Interview
from app.graphs.checkpointer import get_checkpointer
from app.graphs.recruitment_flow import create_recruitment_graph


class ConfirmAvailabilityRequest(BaseModel):
    days: List[str]
    time_slots: List[str]
    timezone: str

logger = logging.getLogger(__name__)

router = APIRouter()


class StartRecruitmentRequest(BaseModel):
    job_title: str
    job_description: str
    company_id: Optional[str] = None


class ApprovalDecisionRequest(BaseModel):
    decision: str  # approved, rejected, hold
    reviewer_id: Optional[str] = None
class CandidateStatusUpdateRequest(BaseModel):
    status: str
    email: Optional[str] = None
    name: Optional[str] = None
    job_title: Optional[str] = None


class SerperSearchRequest(BaseModel):
    job_title: str
    experience: str
    location: str
    keywords: Optional[str] = ""


from app.agents.discovery import discover_candidates

@router.post("/serper-search", status_code=status.HTTP_200_OK)
async def perform_serper_search(
    req: SerperSearchRequest,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Performs LinkedIn Serper Search, saves candidates and logs the search in the DB."""
    # 1. Discover
    discovery_res = await discover_candidates(
        job_title=req.job_title, 
        experience=req.experience,
        location=req.location,
        custom_keywords=req.keywords
    )
    if discovery_res.status == "error":
        raise HTTPException(status_code=500, detail=discovery_res.reasoning_summary)
    
    job_criteria = discovery_res.data.job_criteria
    candidates_list = discovery_res.data.parsed_candidates  # Contains raw candidates now
    
    # Save search audit and candidate list to DB
    try:
        # Create Search Audit Log
        audit = AuditLog(
            action="serper_search",
            entity="candidates",
            ip_address="127.0.0.1"
        )
        db.add(audit)
        
        # Save Sourced Candidates
        for cand in candidates_list:
            stmt = select(Candidate).where(Candidate.email == cand["email"])
            res = await db.execute(stmt)
            candidate = res.scalar_one_or_none()
            
            if not candidate:
                candidate = Candidate(
                    email=cand["email"],
                    name=cand["name"],
                    linkedin=cand["resume_url"],
                    location=req.location,
                    status="sourced"
                )
                db.add(candidate)
            else:
                candidate.linkedin = cand["resume_url"] or candidate.linkedin
                candidate.status = "sourced"
                
        await db.commit()
        logger.info(f"Successfully saved {len(candidates_list)} sourced candidates and search audit log to DB.")
    except Exception as db_exc:
        await db.rollback()
        logger.error(f"Failed to save search results to DB: {db_exc}")

    return {
        "status": "success",
        "query_used": discovery_res.data.linkedin_boolean_query,
        "job_criteria": job_criteria.model_dump(),
        "candidates": candidates_list
    }



@router.get("/candidates", status_code=status.HTTP_200_OK)
async def get_all_candidates(
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieves all candidates from the database for the HR Dashboard."""
    try:
        stmt = select(Candidate).options(
            selectinload(Candidate.skills), 
            selectinload(Candidate.interviews),
            selectinload(Candidate.resumes)
        ).order_by(Candidate.created_at.desc())
        res = await db.execute(stmt)
        candidates = res.scalars().all()
        
        candidates_list = []
        for idx, cand in enumerate(candidates):
            skills = [s.skill_name for s in cand.skills] if cand.skills else ["Python", "FastAPI", "SQLAlchemy", "Docker"]
            
            # Check if candidate has actually selected/confirmed an interview date & time slot
            has_scheduled_interview = False
            interview_date_str = "Awaiting slot"
            if hasattr(cand, "interviews") and cand.interviews:
                for iv in cand.interviews:
                    if iv.scheduled_at is not None:
                        has_scheduled_interview = True
                        if iv.transcript and isinstance(iv.transcript, dict) and (iv.transcript.get("resolved_dates") or iv.transcript.get("preferred_days")):
                            p_days = iv.transcript.get("preferred_days", [])
                            r_dates = iv.transcript.get("resolved_dates", [])
                            slots = iv.transcript.get("preferred_slots", [])
                            dates_list = r_dates if r_dates else p_days
                            dates_str = ", ".join([str(d) for d in dates_list]) if dates_list else iv.scheduled_at.strftime("%Y-%m-%d")
                            slots_str = ", ".join(slots) if slots else iv.scheduled_at.strftime("%I:%M %p UTC")
                            interview_date_str = f"{dates_str} @ {slots_str}"
                        else:
                            interview_date_str = iv.scheduled_at.strftime("%Y-%m-%d @ %I:%M %p UTC")
                        break
            
            # Per strict user requirement: candidate must stay in "Applied" (Candidates column of Kanban board)
            # until they select an actual interview date (`scheduled_at is not None`).
            # Once an interview date is selected, list under "Pending HR Review" (Scheduled column).
            if has_scheduled_interview:
                cand_status = "Pending HR Review"
                interview_status = "Scheduled"
            else:
                # If they have not selected an interview date yet, keep strictly in "Applied" (Candidates list)
                # unless they have been explicitly hired/rejected/held
                status_map = {
                    "Offer Sent": "Offer Sent",
                    "Rejected": "Rejected",
                    "Hold": "Hold"
                }
                cand_status = status_map.get(cand.status, "Applied")
                interview_status = "Pending"
            
            # Retrieve actual ATS score from parsed resume metadata if available
            score = None
            if cand.resumes:
                latest_resume = cand.resumes[-1]
                if latest_resume.parsed_metadata and "ats_score" in latest_resume.parsed_metadata:
                    try:
                        score = float(latest_resume.parsed_metadata["ats_score"])
                    except Exception:
                        pass
            
            if score is None:
                # Fallback to estimated score only for sourced/LinkedIn search profiles that don't have resumes
                score = float(int(min(98, max(65, 95 - idx * 3))))
            
            # Extract automatically synthesized questions if this candidate has an interview scheduled or resume parsed
            gen_qs = []
            if hasattr(cand, "interviews") and cand.interviews:
                for iv in cand.interviews:
                    if iv.transcript and isinstance(iv.transcript, dict) and "generated_questions" in iv.transcript:
                        gen_qs = iv.transcript["generated_questions"]
                        break
            if not gen_qs and cand.resumes:
                latest_res = cand.resumes[-1]
                if latest_res.parsed_metadata and isinstance(latest_res.parsed_metadata, dict) and "generated_questions" in latest_res.parsed_metadata:
                    gen_qs = latest_res.parsed_metadata["generated_questions"]

            # AUTOMATIC SYNTHESIS FOR EVERY CANDIDATE (if not yet generated)
            if not gen_qs:
                try:
                    from app.agents.interviewer import _get_fallback_questions
                    from app.agents.discovery import JobCriteria, CandidateProfile, PersonalInfo, SkillItem
                    
                    cand_role = cand.current_company or "Software Engineer"
                    sk_items = [SkillItem(skill_name=s.strip(), years=3.0, level="intermediate") for s in skills if isinstance(s, str)]
                    job_crit = JobCriteria(title=cand_role, required_skills=skills, experience="3+ years")
                    cand_prof = CandidateProfile(
                        personal_info=PersonalInfo(name=cand.name or "Candidate", email=cand.email or "cand@example.com"),
                        skills=sk_items,
                        total_experience_years=cand.experience if cand.experience else 3.0
                    )
                    q_plan = _get_fallback_questions(job_crit, cand_prof, num_questions=15)
                    if q_plan and q_plan.questions:
                        auto_qs = []
                        for q_idx, q in enumerate(q_plan.questions, 1):
                            auto_qs.append({
                                "id": str(q_idx),
                                "category": f"{q.type.capitalize() if q.type else 'Technical'} ({q.difficulty.capitalize() if q.difficulty else 'Medium'})",
                                "question": q.question_text,
                                "targetSkills": q.expected_key_points
                            })
                        gen_qs = auto_qs
                        if cand.resumes:
                            latest_r = cand.resumes[-1]
                            latest_r.parsed_metadata = (latest_r.parsed_metadata or {}) | {"generated_questions": auto_qs, "scheduled_role": cand_role}
                            db.add(latest_r)
                except Exception as auto_gen_err:
                    logger.warning(f"Auto-synthesis during get_all_candidates fallback error for {cand.email}: {auto_gen_err}")

            # Check if candidate has submitted answers / evaluations stored in transcript or parsed_metadata
            sub_ans = {}
            eval_det = {}
            syn_rep = ""
            if hasattr(cand, "interviews") and cand.interviews:
                for iv in cand.interviews:
                    if iv.transcript and isinstance(iv.transcript, dict) and "submitted_answers" in iv.transcript:
                        sub_ans = iv.transcript["submitted_answers"]
                        eval_det = iv.transcript.get("evaluation_details", {})
                        syn_rep = iv.transcript.get("synthesis_report", "")
                        break
            if not sub_ans and cand.resumes:
                latest_res = cand.resumes[-1]
                if latest_res.parsed_metadata and isinstance(latest_res.parsed_metadata, dict) and "submitted_answers" in latest_res.parsed_metadata:
                    sub_ans = latest_res.parsed_metadata["submitted_answers"]
                    eval_det = latest_res.parsed_metadata.get("evaluation_details", {})
                    syn_rep = latest_res.parsed_metadata.get("synthesis_report", "")

            if cand.status in ["Approved", "Rejected", "Offer Sent"]:
                cand_status = cand.status
                interview_status = "Completed"
            elif cand.status in ["Hold", "Evaluated"] or len(sub_ans) > 0 or any(getattr(iv, "status", "") == "Completed" for iv in getattr(cand, "interviews", [])):
                cand_status = "Hold" # Directs to Review column under Approval/Reject on HR screen
                interview_status = "Completed"

            candidates_list.append({
                "id": str(cand.id),
                "name": cand.name or "Unknown Candidate",
                "email": cand.email or "no-email@example.com",
                "linkedinUrl": cand.linkedin or "",
                "role": cand.current_company or "AI Engineer",
                "matchScore": score,
                "ranking": idx + 1,
                "skills": skills,
                "experience": f"{cand.experience if cand.experience else 4.0} Years",
                "salary": "$140,000 / yr",
                "location": cand.location or "Remote",
                "status": cand_status,
                "recommendation": "strong-hire" if score >= 85 else ("hire" if score >= 75 else "no-hire"),
                "interviewStatus": interview_status,
                "interviewDate": interview_date_str,
                "interviewMode": "AI Chat Studio",
                "generatedQuestions": gen_qs,
                "submittedAnswers": sub_ans,
                "evaluationDetails": eval_det if eval_det else None,
                "synthesisReport": syn_rep
            })
            
        try:
            await db.commit()
        except Exception:
            pass

        return {
            "status": "success",
            "candidates": candidates_list
        }
    except Exception as exc:
        logger.error(f"Error fetching candidates from DB: {exc}")
        return {
            "status": "error",
            "candidates": []
        }


@router.post("/candidates/{candidate_id}/status")
async def update_candidate_status_and_notify(
    candidate_id: str,
    req: CandidateStatusUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Updates candidate status in DB and sends actual approval/rejection email via FastMail."""
    cand = None
    try:
        cand_uuid = uuid.UUID(candidate_id)
        stmt = select(Candidate).where(Candidate.id == cand_uuid)
        res = await db.execute(stmt)
        cand = res.scalar_one_or_none()
        if cand:
            cand.status = req.status
            await db.commit()
    except Exception as e:
        logger.warning(f"Could not update DB candidate {candidate_id} status: {e}")

    # Determine recipient details
    name = req.name or (cand.name if cand else f"Candidate {candidate_id}")
    email = req.email or (cand.email if cand else "candidate@yen.ai")
    job_title = req.job_title or "AI Engineer"

    notif_type = None
    if req.status in ["Approved", "Offer Sent"]:
        notif_type = "offer_email"
    elif req.status in ["Rejected"]:
        notif_type = "rejection_email"

    email_res = None
    if notif_type:
        from app.services.notifications import send_notification
        email_res = await send_notification(
            candidate_name=name,
            candidate_email=email,
            notif_type=notif_type,
            job_title=job_title,
            extra_data={"company_name": "YEN AI", "salary": "Competitive Package"}
        )

    return {
        "status": "success",
        "updated_status": req.status,
        "candidate_id": candidate_id,
        "notification": email_res
    }


@router.post("/start", status_code=status.HTTP_202_ACCEPTED)
async def start_recruitment_pipeline(req: StartRecruitmentRequest) -> Dict[str, Any]:
    """Starts a new end-to-end recruitment multi-agent workflow."""
    session_id = str(uuid.uuid4())
    checkpointer = await get_checkpointer()
    graph = create_recruitment_graph(checkpointer=checkpointer)

    initial_state = {
        "session_id": session_id,
        "job": {
            "title": req.job_title,
            "description": req.job_description
        },
        "candidates": [],
        "approval": {"status": "pending"}
    }

    config = {"configurable": {"thread_id": session_id}}
    
    # Run graph until it pauses at human_approval interrupt!
    await graph.ainvoke(initial_state, config=config)
    
    current_state = await graph.aget_state(config)
    
    return {
        "session_id": session_id,
        "status": "waiting_for_human_approval" if current_state and current_state.next else "completed",
        "next_step": current_state.next if current_state else [],
        "state_preview": current_state.values if current_state else {}
    }


@router.get("/{session_id}/status")
async def get_recruitment_status(session_id: str) -> Dict[str, Any]:
    """Get current status and state of a recruitment workflow session."""
    checkpointer = await get_checkpointer()
    graph = create_recruitment_graph(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": session_id}}

    current_state = await graph.aget_state(config)
    if not current_state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    return {
        "session_id": session_id,
        "status": "waiting_for_human_approval" if current_state.next else "completed",
        "next_step": current_state.next,
        "state": current_state.values
    }


@router.post("/{session_id}/approve")
async def submit_recruiter_approval(session_id: str, decision: ApprovalDecisionRequest) -> Dict[str, Any]:
    """Human-in-the-Loop endpoint: Recruiter submits approval decision, resuming graph execution."""
    if decision.decision not in ("approved", "rejected", "hold"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid decision. Must be approved, rejected, or hold.")

    checkpointer = await get_checkpointer()
    graph = create_recruitment_graph(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": session_id}}

    current_state = await graph.aget_state(config)
    if not current_state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    # Update approval state in checkpointer
    new_approval = {
        "status": decision.decision,
        "reviewer_id": decision.reviewer_id or "recruiter-001",
        "comments": decision.comments or f"Decision submitted: {decision.decision}"
    }
    
    await graph.aupdate_state(config, {"approval": new_approval})

    # Resume graph execution from interrupted point
    await graph.ainvoke(None, config=config)

    updated_state = await graph.aget_state(config)

    return {
        "session_id": session_id,
        "status": "completed",
        "decision_applied": decision.decision,
        "final_state": updated_state.values if updated_state else {}
    }


from app.api.v1.auth import get_current_active_user
from app.models.user import User

@router.get("/candidate/profile", status_code=status.HTTP_200_OK)
async def get_candidate_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Retrieves the candidate profile details matching the logged-in candidate user's email."""
    try:
        stmt = select(Candidate).options(
            selectinload(Candidate.skills),
            selectinload(Candidate.resumes),
            selectinload(Candidate.interviews)
        ).where(Candidate.email == current_user.email)
        res = await db.execute(stmt)
        candidate = res.scalar_one_or_none()
        
        if not candidate:
            # Fallback mock if they registered directly but have no parsed candidate record
            return {
                "status": "success",
                "profile": {
                    "name": current_user.name,
                    "email": current_user.email,
                    "phone": "",
                    "experience": 0.0,
                    "status": "new",
                    "role": "AI Specialist",
                    "skills": ["Python", "FastAPI"],
                    "interviewDate": "Awaiting slot"
                }
            }
            
        skills = [s.skill_name for s in candidate.skills] if candidate.skills else ["Python", "FastAPI"]
        role = candidate.current_company or "AI Specialist"
        
        interview_date_str = "Awaiting slot"
        scheduled_at_iso = None
        gen_qs = []
        if candidate.interviews:
            for iv in candidate.interviews:
                if iv.scheduled_at is not None:
                    scheduled_at_iso = iv.scheduled_at.isoformat() if hasattr(iv.scheduled_at, "isoformat") else str(iv.scheduled_at)
                    if iv.transcript and isinstance(iv.transcript, dict):
                        if iv.transcript.get("resolved_dates"):
                            dates_str = ", ".join(iv.transcript["resolved_dates"])
                            slots_str = ", ".join(iv.transcript.get("preferred_slots", []))
                            interview_date_str = f"{dates_str} @ {slots_str}"
                        elif iv.transcript.get("preferred_days"):
                            days_str = ", ".join(iv.transcript["preferred_days"])
                            slots_str = ", ".join(iv.transcript.get("preferred_slots", []))
                            interview_date_str = f"{days_str} @ {slots_str}"
                        else:
                            interview_date_str = iv.scheduled_at.strftime("%Y-%m-%d @ %I:%M %p UTC")
                        gen_qs = iv.transcript.get("generated_questions", [])
                    break
        if not gen_qs and candidate.resumes:
            latest_res = candidate.resumes[-1]
            if latest_res.parsed_metadata and isinstance(latest_res.parsed_metadata, dict):
                gen_qs = latest_res.parsed_metadata.get("generated_questions", [])

        if not gen_qs:
            try:
                from app.agents.interviewer import _get_fallback_questions
                from app.agents.discovery import JobCriteria, CandidateProfile, PersonalInfo, SkillItem
                sk_items = [SkillItem(skill_name=s.strip(), years=3.0, level="intermediate") for s in skills if isinstance(s, str)]
                job_crit = JobCriteria(title=role, required_skills=skills, experience="3+ years")
                cand_prof = CandidateProfile(
                    personal_info=PersonalInfo(name=candidate.name or current_user.name, email=candidate.email),
                    skills=sk_items,
                    total_experience_years=candidate.experience if candidate.experience else 3.0
                )
                q_plan = _get_fallback_questions(job_crit, cand_prof, num_questions=15)
                if q_plan and q_plan.questions:
                    auto_qs = []
                    for q_idx, q in enumerate(q_plan.questions, 1):
                        auto_qs.append({
                            "id": str(q_idx),
                            "category": f"{q.type.capitalize() if q.type else 'Technical'} ({q.difficulty.capitalize() if q.difficulty else 'Medium'})",
                            "question": q.question_text,
                            "targetSkills": q.expected_key_points
                        })
                    gen_qs = auto_qs
                    if candidate.resumes:
                        latest_r = candidate.resumes[-1]
                        latest_r.parsed_metadata = (latest_r.parsed_metadata or {}) | {"generated_questions": auto_qs, "scheduled_role": role}
                        db.add(latest_r)
                        try:
                            await db.commit()
                        except Exception:
                            pass
            except Exception as auto_gen_err:
                logger.warning(f"Auto-synthesis during get_candidate_profile error: {auto_gen_err}")

        print(f"\n========================================================")
        print(f"[TERMINAL DATE CHECK LOGIC for {current_user.email}]")
        print(f"  -> status:         {candidate.status}")
        print(f"  -> proposed_dates: {candidate.proposed_dates}")
        print(f"  -> interviewDate:  {interview_date_str}")
        print(f"  -> scheduledAtISO: {scheduled_at_iso}")
        print(f"========================================================\n")

        return {
            "status": "success",
            "profile": {
                "id": str(candidate.id),
                "name": candidate.name or current_user.name,
                "email": candidate.email,
                "phone": candidate.phone or "",
                "experience": candidate.experience or 0.0,
                "status": candidate.status,
                "role": role,
                "skills": skills,
                "interviewDate": interview_date_str,
                "scheduledAtISO": scheduled_at_iso,
                "generatedQuestions": gen_qs,
                "proposedDates": candidate.proposed_dates or []
            }
        }
    except Exception as exc:
        logger.error(f"Error fetching candidate profile: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load candidate profile.")


from datetime import datetime, timedelta, timezone as dt_timezone
from app.models.job import Job
from app.models.user import Company

@router.post("/candidate/availability", status_code=status.HTTP_200_OK)
async def confirm_candidate_availability(
    req: ConfirmAvailabilityRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Saves candidate availability preferences, schedules/updates their Interview record, and marks status as Pending HR Review (Scheduled column)."""
    try:
        stmt = select(Candidate).options(
            selectinload(Candidate.interviews)
        ).where(Candidate.email == current_user.email)
        res = await db.execute(stmt)
        candidate = res.scalar_one_or_none()
        
        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate record not found.")

        # Find first job to link the interview to
        stmt_job = select(Job)
        res_job = await db.execute(stmt_job)
        job = res_job.scalars().first()
        if not job:
            # Create a default company and job to satisfy foreign keys
            stmt_comp = select(Company)
            res_comp = await db.execute(stmt_comp)
            comp = res_comp.scalars().first()
            if not comp:
                comp = Company(name="YEN AI")
                db.add(comp)
                await db.flush()
            job = Job(
                company_id=comp.id,
                title="AI Specialist",
                description="AI Specialist role",
                status="open"
            )
            db.add(job)
            await db.flush()

        # Parse preferred days and calculate nearest date
        DAY_MAP = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6}
        now = datetime.now(dt_timezone.utc)
        
        resolved_dates = []
        min_delta = 1
        
        if req.days:
            today_idx = now.weekday()
            for d in req.days:
                d_str = str(d).strip()
                if d_str in DAY_MAP:
                    day_idx = DAY_MAP[d_str]
                    delta = (day_idx - today_idx) % 7
                    if delta == 0:  # If selected day is today, schedule for next week
                        delta = 7
                    item_date = now + timedelta(days=delta)
                    resolved_dates.append(item_date.strftime("%Y-%m-%d"))
                else:
                    # Check DD-MM-YYYY or DD/MM/YYYY
                    m_ddmmyy = re.match(r'^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$', d_str)
                    if m_ddmmyy:
                        day_val = int(m_ddmmyy.group(1))
                        month_val = int(m_ddmmyy.group(2))
                        year_val = int(m_ddmmyy.group(3))
                        resolved_dates.append(f"{year_val:04d}-{month_val:02d}-{day_val:02d}")
                    else:
                        # Check YYYY-MM-DD or YYYY/MM/DD
                        m_yyyymmdd = re.match(r'^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$', d_str)
                        if m_yyyymmdd:
                            year_val = int(m_yyyymmdd.group(1))
                            month_val = int(m_yyyymmdd.group(2))
                            day_val = int(m_yyyymmdd.group(3))
                            resolved_dates.append(f"{year_val:04d}-{month_val:02d}-{day_val:02d}")
                        else:
                            # Check Jul 20, July 21
                            m_name = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|July|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-]+(\d{1,2})', d_str, re.IGNORECASE)
                            if m_name:
                                m_map = {"jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,"jul":7,"july":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12}
                                month_num = m_map.get(m_name.group(1).lower(), 7)
                                day_num = int(m_name.group(2))
                                resolved_dates.append(f"2026-{month_num:02d}-{day_num:02d}")
            
            # Sort resolved dates chronologically
            resolved_dates = sorted(list(set(resolved_dates)))
            
            # Use the earliest date as the primary scheduled date
            day_indices = [DAY_MAP[d] for d in req.days if d in DAY_MAP]
            if day_indices:
                deltas = [(idx - today_idx) % 7 for idx in day_indices]
                min_delta = min(deltas)
                if min_delta == 0:
                    min_delta = 7

        hour = 9
        if req.time_slots:
            first_slot = req.time_slots[0].lower()
            if "afternoon" in first_slot:
                hour = 13
            elif "evening" in first_slot:
                hour = 18

        if resolved_dates:
            earliest_date_str = resolved_dates[0]
            try:
                parts = [int(p) for p in re.split(r'[-/]', earliest_date_str.strip())]
                if parts[0] >= 2024:
                    year_val, month_val, day_val = parts[0], parts[1], parts[2]
                elif len(parts) == 3 and parts[2] >= 2024:
                    day_val, month_val, year_val = parts[0], parts[1], parts[2]
                elif len(parts) == 3 and parts[2] < 100:
                    day_val, month_val, year_val = parts[0], parts[1], 2000 + parts[2]
                else:
                    year_val, month_val, day_val = parts[0], parts[1], parts[2]

                scheduled_at = datetime(
                    year=year_val,
                    month=month_val,
                    day=day_val,
                    hour=hour,
                    minute=0,
                    second=0,
                    tzinfo=dt_timezone.utc
                )
            except Exception as e:
                logger.error(f"Error parsing date {earliest_date_str}: {e}")
                scheduled_date = now + timedelta(days=min_delta)
                scheduled_at = datetime(
                    year=scheduled_date.year,
                    month=scheduled_date.month,
                    day=scheduled_date.day,
                    hour=hour,
                    minute=0,
                    second=0,
                    tzinfo=dt_timezone.utc
                )
        else:
            scheduled_date = now + timedelta(days=min_delta)
            scheduled_at = datetime(
                year=scheduled_date.year,
                month=scheduled_date.month,
                day=scheduled_date.day,
                hour=hour,
                minute=0,
                second=0,
                tzinfo=dt_timezone.utc
            )

        # Upsert interview record
        interview = None
        if candidate.interviews:
            interview = candidate.interviews[0]
            interview.scheduled_at = scheduled_at
            interview.job_id = job.id
            interview.status = "scheduled"
            interview.transcript = {
                "preferred_days": req.days,
                "preferred_slots": req.time_slots,
                "timezone": req.timezone,
                "resolved_dates": resolved_dates
            }
        else:
            interview = Interview(
                candidate_id=candidate.id,
                job_id=job.id,
                scheduled_at=scheduled_at,
                mode="ai-chat",
                status="scheduled",
                transcript={
                    "preferred_days": req.days,
                    "preferred_slots": req.time_slots,
                    "timezone": req.timezone,
                    "resolved_dates": resolved_dates
                }
            )
            db.add(interview)

        # Per strict user requirement: candidate is listed under "Pending HR Review" (Scheduled column)
        # once their interview date is selected (scheduled_at is not None).
        candidate.status = "shortlisted"
        
        # Automatically synthesize unique 15 questions if not already synthesized for this candidate
        try:
            if not (interview.transcript and isinstance(interview.transcript, dict) and "generated_questions" in interview.transcript):
                from app.agents.interviewer import generate_interview_questions
                from app.agents.discovery import JobCriteria, CandidateProfile, PersonalInfo, SkillItem
                
                cand_skills = [s.skill_name for s in candidate.skills] if candidate.skills else []
                title_lower = (job.title or "Software Engineer").lower()
                if not cand_skills:
                    if any(w in title_lower for w in ["react", "frontend", "ui", "next"]):
                        cand_skills = ["React", "TypeScript", "Next.js", "Redux Toolkit", "Tailwind CSS"]
                    elif any(w in title_lower for w in ["node", "express", "javascript"]):
                        cand_skills = ["Node.js", "Express", "TypeScript", "MongoDB", "REST APIs"]
                    elif any(w in title_lower for w in ["java", "spring"]):
                        cand_skills = ["Java", "Spring Boot", "Microservices", "PostgreSQL", "Docker"]
                    elif any(w in title_lower for w in ["devops", "cloud", "sre"]):
                        cand_skills = ["Kubernetes", "Docker", "AWS/GCP", "Terraform", "CI/CD Pipelines"]
                    else:
                        cand_skills = ["Python", "FastAPI", "Docker", "PostgreSQL", "System Design"]

                sk_list = [SkillItem(skill_name=s.strip(), years=3.0, level="intermediate") for s in cand_skills if isinstance(s, str)]
                job_crit = JobCriteria(title=job.title or "Software Engineer", required_skills=cand_skills, experience="3+ years")
                cand_prof = CandidateProfile(
                    personal_info=PersonalInfo(name=candidate.name or "Candidate", email=candidate.email),
                    skills=sk_list,
                    total_experience_years=candidate.experience if candidate.experience else 3.0
                )
                q_res = await generate_interview_questions(job_crit, cand_prof, num_questions=15)
                questions_data = []
                if q_res.data and q_res.data.questions:
                    for idx, q in enumerate(q_res.data.questions, 1):
                        questions_data.append({
                            "id": str(idx),
                            "category": f"{q.type.capitalize() if q.type else 'Technical'} ({q.difficulty.capitalize() if q.difficulty else 'Medium'})",
                            "question": q.question_text,
                            "targetSkills": q.expected_key_points
                        })
                interview.transcript = (interview.transcript or {}) | {"generated_questions": questions_data, "job_title": job.title}
                if candidate.resumes:
                    latest_res = candidate.resumes[-1]
                    latest_res.parsed_metadata = (latest_res.parsed_metadata or {}) | {"generated_questions": questions_data, "scheduled_role": job.title}
                logger.info(f"Auto-synthesized {len(questions_data)} questions via availability endpoint for {candidate.email}")
        except Exception as q_gen_err:
            logger.error(f"Availability auto question generation warning: {q_gen_err}")

        await db.commit()
        
        # Broadcast candidates update event to notify all connected HR dashboards in real-time
        try:
            await manager.broadcast({"event": "candidates_updated"})
        except Exception as ws_err:
            logger.error(f"WebSocket broadcast failed: {ws_err}")
        
        return {
            "status": "success",
            "message": "Availability preferences successfully saved and interview slot confirmed.",
            "scheduledAt": scheduled_at.strftime("%Y-%m-%d @ %I:%M %p UTC"),
            "scheduledAtISO": scheduled_at.isoformat() if hasattr(scheduled_at, "isoformat") else str(scheduled_at),
            "interviewDate": f"{', '.join(resolved_dates if resolved_dates else req.days)} @ {', '.join(req.time_slots if req.time_slots else ['9:00 AM UTC'])}"
        }
    except Exception as exc:
        await db.rollback()
        logger.error(f"Error saving candidate availability: {exc}")
        raise HTTPException(status_code=500, detail="Failed to save availability preferences.")


class GenerateJDQuestionsRequest(BaseModel):
    job_title: str
    skills: Optional[List[str]] = None
    experience: Optional[str] = "3 years"
    num_questions: Optional[int] = 15


@router.post("/jd/generate-questions", status_code=status.HTTP_200_OK)
async def generate_jd_questions_endpoint(req: GenerateJDQuestionsRequest) -> Dict[str, Any]:
    """Uses Question Generation Agent (Ollama / Fallback) to dynamically generate tailored interview questions for JD Questionnaire."""
    from app.agents.interviewer import generate_interview_questions
    from app.agents.discovery import JobCriteria, CandidateProfile, PersonalInfo, SkillItem
    
    sk_list = req.skills or []
    title_lower = (req.job_title or "Backend Engineer").lower()
    default_python = {"python", "fastapi", "docker", "postgresql", "langgraph"}
    is_default_or_empty = not sk_list or set(s.lower().strip() for s in sk_list).issubset(default_python)
    
    if is_default_or_empty:
        if any(w in title_lower for w in ["wordpress", "php", "woocommerce", "cms"]):
            sk_list = ["WordPress Core & PHP 8", "Custom Plugin & Theme Development", "WooCommerce & REST API", "MySQL & Query Performance", "Security & Vulnerability Hardening"]
        elif any(w in title_lower for w in ["react", "frontend", "ui", "next", "angular", "vue"]):
            sk_list = ["React", "TypeScript", "Next.js", "Redux Toolkit", "Tailwind CSS", "HTML5/CSS3"]
        elif any(w in title_lower for w in ["node", "express", "javascript", "js"]):
            sk_list = ["Node.js", "Express", "TypeScript", "MongoDB", "REST APIs", "Docker"]
        elif any(w in title_lower for w in ["java", "spring"]):
            sk_list = ["Java", "Spring Boot", "Microservices", "PostgreSQL", "Kafka", "Docker"]
        elif any(w in title_lower for w in ["devops", "cloud", "sre", "infra"]):
            sk_list = ["Kubernetes", "Docker", "AWS/GCP", "Terraform", "CI/CD Pipelines", "Prometheus"]
        elif any(w in title_lower for w in ["data", "ml", "ai", "scientist", "engineer"]):
            sk_list = ["Python", "PyTorch/TensorFlow", "LangChain", "Vector DBs", "FastAPI", "Data Pipelines"]
        else:
            sk_list = ["Python", "FastAPI", "Docker", "PostgreSQL", "Redis"]

    job_crit = JobCriteria(title=req.job_title or "Backend Engineer", required_skills=sk_list, experience=req.experience or "3+ years")
    cand_prof = CandidateProfile(
        personal_info=PersonalInfo(name="Synthetic Candidate", email="candidate@yen.ai"),
        skills=[SkillItem(skill_name=s.strip(), years=3.0, level="intermediate") for s in sk_list if isinstance(s, str)],
        total_experience_years=3.0
    )
    
    q_res = await generate_interview_questions(job_crit, cand_prof, num_questions=req.num_questions or 15)
    questions_data = []
    if q_res.data and q_res.data.questions:
        for idx, q in enumerate(q_res.data.questions, 1):
            category = "Technical / Core Stack"
            if q.type == "architecture": category = "System Architecture"
            elif q.type == "behavioral": category = "Behavioral & Leadership"
            elif q.type == "scenario": category = "Scenario & Problem Solving"
            elif q.type == "coding": category = "Technical / Core Stack"
            
            questions_data.append({
                "id": idx,
                "category": category,
                "question": q.question_text,
                "targetSkills": q.expected_key_points or sk_list[:3]
            })
    return {"status": "success", "questions": questions_data, "total": len(questions_data)}


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    def connect(self, websocket: WebSocket):
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@router.websocket("/ws")
@router.websocket("/ws/")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for broadcasting real-time candidate status updates to HR Dashboards."""
    await websocket.accept()
    manager.connect(websocket)
    try:
        while True:
            # Keep the socket connection open and listen for client heartbeats
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
