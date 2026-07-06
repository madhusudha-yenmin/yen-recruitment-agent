import logging
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import openai
import instructor
from app.core.config import settings
from app.agents.base import AgentResponse
from app.services.notifications import send_notification

logger = logging.getLogger(__name__)


# --- Data Models ---

class CandidateComparisonItem(BaseModel):
    candidate_name: str
    email: str
    ranking: int
    match_score: float
    interview_score: Optional[float] = None
    recommendation: str
    key_strengths: List[str]
    potential_risks: List[str]


class CandidateComparisonReport(BaseModel):
    job_title: str
    total_evaluated: int
    top_candidate: CandidateComparisonItem
    all_candidates: List[CandidateComparisonItem]
    executive_summary: str
    generated_by: str = "hiring-decision-agent"


class HiringDecisionResult(BaseModel):
    job_title: str
    decision_status: str  # pending_hitl, offer_sent, rejection_sent, hold
    selected_candidate_name: Optional[str] = None
    selected_candidate_email: Optional[str] = None
    comparison_report: CandidateComparisonReport
    notification_result: Optional[Dict[str, Any]] = None


# --- Unified Hiring Decision Agent Tools & Methods ---

async def generate_candidate_comparison(job_title: str, candidates: List[Dict[str, Any]]) -> AgentResponse[CandidateComparisonReport]:
    """Hiring Decision Agent Tool: Generates comparative analytics across all evaluated candidates."""
    logger.info("Hiring Decision Agent: Generating candidate comparison report...")
    
    items: List[CandidateComparisonItem] = []
    for idx, cand in enumerate(candidates, start=1):
        name = cand.get("name", "Unknown")
        email = cand.get("email", "unknown@example.com")
        score = cand.get("match_score", 0.0)
        rank = cand.get("ranking", idx)
        
        # Check if interview evaluation exists
        int_eval = cand.get("interview_evaluation", {})
        int_score = int_eval.get("overall_score")
        rec = int_eval.get("recommendation") or ("strong-hire" if score >= 85 else ("hire" if score >= 70 else "no-hire"))
        
        skills = [s.get("skill_name", s) if isinstance(s, dict) else s for s in cand.get("skills", [])]
        
        items.append(CandidateComparisonItem(
            candidate_name=name,
            email=email,
            ranking=rank,
            match_score=score,
            interview_score=int_score,
            recommendation=rec,
            key_strengths=skills[:4] if skills else ["Strong technical background"],
            potential_risks=["Notice period confirmation needed"] if rank == 1 else ["Skill gaps identified in required domain"]
        ))

    items.sort(key=lambda x: (x.ranking, -x.match_score))
    top_cand = items[0] if items else CandidateComparisonItem(candidate_name="None", email="none@example.com", ranking=1, match_score=0, recommendation="no-hire", key_strengths=[], potential_risks=[])

    report = CandidateComparisonReport(
        job_title=job_title,
        total_evaluated=len(items),
        top_candidate=top_cand,
        all_candidates=items,
        executive_summary=f"Evaluated {len(items)} candidates for '{job_title}'. Top ranked candidate is {top_cand.candidate_name} with an overall match score of {top_cand.match_score}% ({top_cand.recommendation.upper()})."
    )

    return AgentResponse(
        status="success",
        confidence=98,
        reasoning_summary=f"Synthesized comparative analytics for {len(items)} candidates.",
        data=report
    )


async def process_hiring_decisions(
    job_title: str,
    candidates: List[Dict[str, Any]],
    approval_status: str = "pending",
    reviewer_id: Optional[str] = None,
    comments: Optional[str] = None
) -> AgentResponse[HiringDecisionResult]:
    """Hiring Decision Agent:
    
    Unified agent responsible for:
    1. Receiving interview reports & generating candidate comparison
    2. Waiting for HR approval (HITL interrupt state)
    3. Sending Offer mail / Rejection mail upon decision
    4. Updating dashboard state
    """
    logger.info(f"Hiring Decision Agent: Processing decisions for '{job_title}' (Approval Status: {approval_status})...")
    
    # 1. Generate Comparison
    comp_res = await generate_candidate_comparison(job_title, candidates)
    report = comp_res.data
    
    top_cand = report.top_candidate if report else None
    cand_name = top_cand.candidate_name if top_cand else "Candidate"
    cand_email = top_cand.email if top_cand else "candidate@example.com"

    # 2. Check Approval Status
    if approval_status == "pending":
        # Waiting for HR approval!
        res = HiringDecisionResult(
            job_title=job_title,
            decision_status="pending_hitl",
            selected_candidate_name=cand_name,
            selected_candidate_email=cand_email,
            comparison_report=report,
            notification_result={"status": "waiting", "message": "Execution paused waiting for HR dashboard approval."}
        )
        return AgentResponse(
            status="success",
            confidence=100,
            reasoning_summary="Comparative report generated. Waiting for HR approval (HITL Checkpoint).",
            data=res
        )

    # 3. Handle Approved / Rejected / Hold Decisions
    notif_res = {}
    if approval_status == "approved":
        notif_type = "offer_email"
        decision_stat = "offer_sent"
        logger.info(f"Hiring Decision Agent: HR APPROVED! Sending Offer Email to {cand_email}...")
        notif_res = await send_notification(cand_name, cand_email, notif_type, job_title)
    elif approval_status == "rejected":
        notif_type = "rejection_email"
        decision_stat = "rejection_sent"
        logger.info(f"Hiring Decision Agent: HR REJECTED! Sending Rejection Email to {cand_email}...")
        notif_res = await send_notification(cand_name, cand_email, notif_type, job_title)
    else:
        notif_type = "followup_email"
        decision_stat = "hold"
        logger.info(f"Hiring Decision Agent: HR ON HOLD! Sending Follow-up Email to {cand_email}...")
        notif_res = await send_notification(cand_name, cand_email, notif_type, job_title)

    res = HiringDecisionResult(
        job_title=job_title,
        decision_status=decision_stat,
        selected_candidate_name=cand_name,
        selected_candidate_email=cand_email,
        comparison_report=report,
        notification_result=notif_res
    )

    return AgentResponse(
        status="success",
        confidence=100,
        reasoning_summary=f"Hiring decision processed: {decision_stat.upper()}. Notification dispatched to {cand_email}.",
        data=res
    )
