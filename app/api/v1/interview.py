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
async def start_interview_session(req: StartInterviewRequest) -> Dict[str, Any]:
    """Starts a new interactive AI interview session."""
    session_id = str(uuid.uuid4())
    checkpointer = await get_checkpointer()
    graph = create_interview_graph(checkpointer=checkpointer)

    initial_state = {
        "session_id": session_id,
        "job_analysis": {"title": req.job_title, "skills": ["Python", "FastAPI", "System Design"]},
        "candidate_profile": {"name": req.candidate_name, "email": req.candidate_email},
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
