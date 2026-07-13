import uuid
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from app.graphs.checkpointer import get_checkpointer
from app.graphs.interview_flow import create_interview_graph

router = APIRouter()


class StartInterviewRequest(BaseModel):
    candidate_name: str
    candidate_email: str
    job_title: str
    resume_text: Optional[str] = None


class InterviewTurnRequest(BaseModel):
    candidate_answer: str


@router.post("/start", status_code=status.HTTP_201_CREATED)
async def start_interview_session(req: StartInterviewRequest, db=None) -> Dict[str, Any]:
    """Starts a new interactive AI interview session."""
    session_id = str(uuid.uuid4())
    checkpointer = await get_checkpointer()
    graph = create_interview_graph(checkpointer=checkpointer)

    # Check if candidate has unique auto-synthesized questions from their interview scheduling event
    pregenerated_qs = []
    try:
        from app.db.session import async_session_maker
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from app.models.candidate import Candidate
        
        async with async_session_maker() as session:
            stmt = select(Candidate).options(selectinload(Candidate.interviews), selectinload(Candidate.resumes)).where(Candidate.email == req.candidate_email)
            res = await session.execute(stmt)
            cand = res.scalar_one_or_none()
            if cand:
                if cand.interviews:
                    for iv in cand.interviews:
                        if iv.transcript and isinstance(iv.transcript, dict) and "generated_questions" in iv.transcript:
                            pregenerated_qs = iv.transcript["generated_questions"]
                            break
                if not pregenerated_qs and cand.resumes:
                    latest_res = cand.resumes[-1]
                    if latest_res.parsed_metadata and isinstance(latest_res.parsed_metadata, dict) and "generated_questions" in latest_res.parsed_metadata:
                        pregenerated_qs = latest_res.parsed_metadata["generated_questions"]
    except Exception as db_err:
        pass

    title_lower = (req.job_title or "").lower()
    default_skills = ["Python", "FastAPI", "System Design"]
    if any(w in title_lower for w in ["react", "frontend", "ui"]):
        default_skills = ["React", "TypeScript", "Next.js"]
    elif any(w in title_lower for w in ["node", "javascript"]):
        default_skills = ["Node.js", "Express", "MongoDB"]
    elif any(w in title_lower for w in ["java", "spring"]):
        default_skills = ["Java", "Spring Boot", "Microservices"]

    initial_state = {
        "session_id": session_id,
        "job_analysis": {"title": req.job_title, "skills": default_skills},
        "candidate_profile": {"name": req.candidate_name, "email": req.candidate_email},
        "pregenerated_questions": pregenerated_qs,
        "is_complete": False
    }

    config = {"configurable": {"thread_id": session_id}}
    await graph.ainvoke(initial_state, config=config)

    state = await graph.aget_state(config)
    vals = state.values if state else {}
    history = vals.get("conversation_history", [])
    questions = vals.get("questions", [])

    return {
        "session_id": session_id,
        "status": "in_progress",
        "total_questions": len(questions),
        "current_question_index": vals.get("current_question_index", 0),
        "latest_ai_message": history[-1]["content"] if history else "Hello! Let's begin the interview."
    }


@router.post("/{session_id}/turn")
async def submit_interview_turn(session_id: str, turn_req: InterviewTurnRequest) -> Dict[str, Any]:
    """Candidate submits answer to current question, advancing the interview turn."""
    checkpointer = await get_checkpointer()
    graph = create_interview_graph(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": session_id}}

    state = await graph.aget_state(config)
    if not state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")

    vals = state.values
    if vals.get("is_complete"):
        return {
            "session_id": session_id,
            "status": "completed",
            "message": "Interview session is already completed."
        }

    # Append user answer to conversation history in checkpointer state
    history = list(vals.get("conversation_history", []))
    history.append({"role": "user", "content": turn_req.candidate_answer})

    await graph.aupdate_state(config, {"conversation_history": history})
    await graph.ainvoke(None, config=config)

    updated_state = await graph.aget_state(config)
    u_vals = updated_state.values if updated_state else {}
    u_history = u_vals.get("conversation_history", [])
    is_done = u_vals.get("is_complete", False)

    return {
        "session_id": session_id,
        "status": "completed" if is_done else "in_progress",
        "current_question_index": u_vals.get("current_question_index", 0),
        "latest_ai_message": u_history[-1]["content"] if u_history else "",
        "is_complete": is_done
    }


@router.get("/{session_id}/report")
async def get_interview_report(session_id: str) -> Dict[str, Any]:
    """Retrieve final evaluation scores, critic audit, and executive report."""
    checkpointer = await get_checkpointer()
    graph = create_interview_graph(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": session_id}}

    state = await graph.aget_state(config)
    if not state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")

    vals = state.values
    return {
        "session_id": session_id,
        "is_complete": vals.get("is_complete", False),
        "evaluation": vals.get("evaluation", {}),
        "critic_review": vals.get("critic_review", {}),
        "report": vals.get("report", {}),
        "transcript": vals.get("conversation_history", [])
    }
