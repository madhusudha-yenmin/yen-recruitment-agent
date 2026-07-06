import logging
from typing import Dict, Any
from langgraph.graph import StateGraph, END
from app.graphs.state import RecruitmentState
from app.agents.orchestrator import RecruitmentOrchestrator

logger = logging.getLogger(__name__)


async def discovery_node(state: RecruitmentState) -> Dict[str, Any]:
    """Stage 1: Candidate Discovery Agent (JD Analysis, Boolean Query, Search, Resume Parse)."""
    logger.info("Executing Stage 1: Candidate Discovery Agent...")
    orchestrator = RecruitmentOrchestrator(state.get("session_id"))
    return await orchestrator.execute_discovery_stage(state)


async def assessment_node(state: RecruitmentState) -> Dict[str, Any]:
    """Stage 2: Candidate Assessment Agent (JD vs Resume Match Scoring & Ranking)."""
    logger.info("Executing Stage 2: Candidate Assessment Agent...")
    orchestrator = RecruitmentOrchestrator(state.get("session_id"))
    return await orchestrator.execute_assessment_stage(state)


async def interview_setup_node(state: RecruitmentState) -> Dict[str, Any]:
    """Stage 3: Interview Agent (Tailored Question Generation & Studio Setup)."""
    logger.info("Executing Stage 3: Interview Agent Setup...")
    orchestrator = RecruitmentOrchestrator(state.get("session_id"))
    return await orchestrator.execute_interview_stage(state)


async def human_approval_node(state: RecruitmentState) -> Dict[str, Any]:
    """Stage 4: Human-in-the-Loop Review Checkpoint.

    When compiled with interrupt_before=['human_approval'], graph execution pauses automatically
    before entering this node. When the recruiter submits their decision on the dashboard,
    the state is updated with approval.status = 'approved' | 'rejected' | 'hold' and execution resumes!
    """
    logger.info("Executing Stage 4: Human-in-the-Loop Review Checkpoint...")
    approval = state.get("approval", {})
    status = approval.get("status", "pending")
    logger.info(f"Human approval status: {status}")
    return {}


async def hiring_decision_node(state: RecruitmentState) -> Dict[str, Any]:
    """Stage 5: Hiring Decision Agent (Comparative Analytics & Offer/Rejection Automation)."""
    logger.info("Executing Stage 5: Hiring Decision Agent...")
    orchestrator = RecruitmentOrchestrator(state.get("session_id"))
    return await orchestrator.execute_hiring_decision_stage(state)


def route_after_approval(state: RecruitmentState) -> str:
    """Conditional edge: routes execution after human approval node."""
    approval = state.get("approval", {})
    status = approval.get("status", "pending")
    if status in ("approved", "rejected", "hold"):
        return "decision"
    return "decision"


def create_recruitment_graph(checkpointer: Any = None) -> Any:
    """Creates and compiles the end-to-end recruitment LangGraph with 5-Agent Architecture and HITL interrupts."""
    workflow = StateGraph(RecruitmentState)

    workflow.add_node("discovery", discovery_node)
    workflow.add_node("assessment", assessment_node)
    workflow.add_node("interview_setup", interview_setup_node)
    workflow.add_node("human_approval", human_approval_node)
    workflow.add_node("hiring_decision", hiring_decision_node)

    workflow.set_entry_point("discovery")
    workflow.add_edge("discovery", "assessment")
    workflow.add_edge("assessment", "interview_setup")
    workflow.add_edge("interview_setup", "human_approval")
    
    workflow.add_conditional_edges(
        "human_approval",
        route_after_approval,
        {
            "decision": "hiring_decision"
        }
    )
    workflow.add_edge("hiring_decision", END)

    # Compile with Human-in-the-Loop interrupt before human_approval node!
    return workflow.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_approval"]
    )
