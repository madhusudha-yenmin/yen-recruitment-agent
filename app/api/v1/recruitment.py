import uuid
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.candidate import Candidate, Resume as ResumeModel
from app.models.interview import AuditLog
from app.graphs.checkpointer import get_checkpointer
from app.graphs.recruitment_flow import create_recruitment_graph

logger = logging.getLogger(__name__)

router = APIRouter()


class StartRecruitmentRequest(BaseModel):
    job_title: str
    job_description: str
    company_id: Optional[str] = None


class ApprovalDecisionRequest(BaseModel):
    decision: str  # approved, rejected, hold
    reviewer_id: Optional[str] = None
    comments: Optional[str] = None


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
