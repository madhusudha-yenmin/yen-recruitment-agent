import logging
from typing import Dict, Any
from langgraph.graph import StateGraph, END
from app.graphs.state import InterviewState
from app.agents.discovery import JobCriteria, CandidateProfile
from app.agents.interviewer import (
    generate_interview_questions,
    conduct_interview_turn,
    evaluate_interview,
    audit_evaluation_bias,
    generate_final_report,
    QuestionItem,
    EvaluationScores,
    CriticAuditResult
)

logger = logging.getLogger(__name__)


def _dict_to_job_criteria(section: Dict[str, Any]) -> JobCriteria:
    return JobCriteria(
        title=section.get("title", "Software Engineer"),
        required_skills=section.get("skills", section.get("required_skills", ["Python", "FastAPI"])),
        preferred_skills=section.get("preferred_skills", []),
        experience=section.get("experience", "3-5 years"),
        salary=str(section.get("salary_min", section.get("salary", "UNKNOWN"))),
        location=section.get("location", "Remote"),
        notice_period=section.get("notice_period", "30 days"),
        education="Bachelor's degree or equivalent"
    )


def _dict_to_candidate_profile(section: Dict[str, Any]) -> CandidateProfile:
    from app.agents.discovery import PersonalInfo, SkillItem
    skills_raw = section.get("skills", [])
    skills = []
    for s in skills_raw:
        if isinstance(s, dict):
            skills.append(SkillItem(skill_name=s.get("skill_name", "Python"), years=s.get("years", 3.0), level=s.get("level", "intermediate")))
        elif isinstance(s, str):
            skills.append(SkillItem(skill_name=s, years=3.0, level="intermediate"))

    return CandidateProfile(
        personal_info=PersonalInfo(
            name=section.get("name", "Candidate"),
            email=section.get("email", "candidate@example.com"),
            location=section.get("location", "Remote")
        ),
        skills=skills,
        total_experience_years=section.get("experience_years", 3.0)
    )


async def generate_questions_node(state: InterviewState) -> Dict[str, Any]:
    """Node: Interview Agent generates customized interview questions tailored to JD and resume."""
    logger.info("Executing generate_questions_node...")
    job = _dict_to_job_criteria(state.get("job_analysis", {}))
    candidate = _dict_to_candidate_profile(state.get("candidate_profile", {}))

    if state.get("pregenerated_questions"):
        logger.info("Using unique pre-synthesized 15 questions from interview scheduling event.")
        return {
            "questions": state["pregenerated_questions"],
            "current_question_index": 0,
            "conversation_history": [
                {"role": "system", "content": f"AI Interview Studio initialized for {job.title} with {candidate.personal_info.name}."}
            ]
        }

    res = await generate_interview_questions(job, candidate, num_questions=15)
    if res.data:
        questions_dict = [q.model_dump() for q in res.data.questions]
        return {
            "questions": questions_dict,
            "current_question_index": 0,
            "conversation_history": [
                {"role": "system", "content": f"AI Interview Studio initialized for {job.title} with {candidate.personal_info.name}."}
            ]
        }
    return {"questions": [], "current_question_index": 0}


async def conduct_interview_turn_node(state: InterviewState) -> Dict[str, Any]:
    """Node: Interview Agent conducts an interactive interview turn and evaluates candidate answer."""
    logger.info("Executing conduct_interview_turn_node...")
    job = _dict_to_job_criteria(state.get("job_analysis", {}))
    candidate = _dict_to_candidate_profile(state.get("candidate_profile", {}))
    questions = state.get("questions", [])
    idx = state.get("current_question_index", 0)
    history = state.get("conversation_history", [])
    answers = state.get("answers", [])

    if not questions or idx >= len(questions):
        return {"is_complete": True}

    current_q_dict = questions[idx]
    current_q = QuestionItem.model_validate(current_q_dict)

    latest_user_msg = "I have solid experience in this area and have successfully applied these principles in production."
    for msg in reversed(history):
        if msg.get("role") == "user":
            latest_user_msg = msg.get("content", latest_user_msg)
            break

    res = await conduct_interview_turn(job, candidate, current_q, latest_user_msg, history)
    turn_data = res.data

    new_history = list(history)
    if turn_data:
        new_history.append({"role": "assistant", "content": turn_data.next_ai_message})
        
        new_answers = list(answers)
        new_answers.append({
            "question": current_q.question_text,
            "answer": latest_user_msg,
            "score": turn_data.score_for_answer or 8.0,
            "note": turn_data.evaluation_note or ""
        })

        if turn_data.current_question_completed:
            next_idx = idx + 1
            is_done = next_idx >= len(questions)
            return {
                "current_question_index": next_idx,
                "conversation_history": new_history,
                "answers": new_answers,
                "is_complete": is_done
            }
        else:
            return {
                "conversation_history": new_history,
                "answers": new_answers,
                "is_complete": False
            }

    return {"is_complete": True}


async def evaluate_interview_node(state: InterviewState) -> Dict[str, Any]:
    """Node: Interview Agent evaluates completed interview across all competencies."""
    logger.info("Executing evaluate_interview_node...")
    job = _dict_to_job_criteria(state.get("job_analysis", {}))
    candidate = _dict_to_candidate_profile(state.get("candidate_profile", {}))
    answers = state.get("answers", [])
    history = state.get("conversation_history", [])

    res = await evaluate_interview(job, candidate, history, answers)
    if res.data:
        return {"evaluation": res.data.model_dump()}
    return {}


async def critic_review_node(state: InterviewState) -> Dict[str, Any]:
    """Node: Interview Agent (Critic Pattern) audits evaluation for bias and fairness."""
    logger.info("Executing critic_review_node...")
    job = _dict_to_job_criteria(state.get("job_analysis", {}))
    candidate = _dict_to_candidate_profile(state.get("candidate_profile", {}))
    eval_dict = state.get("evaluation", {})
    answers = state.get("answers", [])

    if not eval_dict:
        return {}

    eval_scores = EvaluationScores.model_validate(eval_dict)
    res = await audit_evaluation_bias(job, candidate, eval_scores, answers)
    if res.data:
        audit_dict = res.data.model_dump()
        if res.data.adjusted_scores:
            return {
                "critic_review": audit_dict,
                "evaluation": res.data.adjusted_scores.model_dump()
            }
        return {"critic_review": audit_dict}
    return {}


async def generate_report_node(state: InterviewState) -> Dict[str, Any]:
    """Node: Interview Agent synthesizes final executive report and hiring recommendation."""
    logger.info("Executing generate_report_node...")
    job = _dict_to_job_criteria(state.get("job_analysis", {}))
    candidate = _dict_to_candidate_profile(state.get("candidate_profile", {}))
    eval_dict = state.get("evaluation", {})
    critic_dict = state.get("critic_review", {})

    if not eval_dict:
        return {"is_complete": True}

    eval_scores = EvaluationScores.model_validate(eval_dict)
    critic_audit = CriticAuditResult.model_validate(critic_dict) if critic_dict else CriticAuditResult()

    res = await generate_final_report(job, candidate, eval_scores, critic_audit)
    if res.data:
        return {
            "report": res.data.model_dump(),
            "is_complete": True
        }
    return {"is_complete": True}


def should_continue_interview(state: InterviewState) -> str:
    """Conditional edge: checks if interview session has completed all questions."""
    if state.get("is_complete", False):
        return "evaluate"
    idx = state.get("current_question_index", 0)
    questions = state.get("questions", [])
    if not questions or idx >= len(questions):
        return "evaluate"
    return "turn"


def create_interview_graph(checkpointer: Any = None) -> Any:
    """Creates and compiles the LangGraph state machine for interactive AI interviews."""
    workflow = StateGraph(InterviewState)

    workflow.add_node("generate_questions", generate_questions_node)
    workflow.add_node("conduct_turn", conduct_interview_turn_node)
    workflow.add_node("evaluate", evaluate_interview_node)
    workflow.add_node("critic", critic_review_node)
    workflow.add_node("report", generate_report_node)

    workflow.set_entry_point("generate_questions")
    workflow.add_edge("generate_questions", "conduct_turn")
    
    workflow.add_conditional_edges(
        "conduct_turn",
        should_continue_interview,
        {
            "turn": "conduct_turn",
            "evaluate": "evaluate"
        }
    )
    
    workflow.add_edge("evaluate", "critic")
    workflow.add_edge("critic", "report")
    workflow.add_edge("report", END)

    return workflow.compile(checkpointer=checkpointer)
