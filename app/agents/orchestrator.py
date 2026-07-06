import logging
import uuid
from typing import Dict, Any, Optional, List
from app.agents.discovery import discover_candidates
from app.agents.assessment import assess_and_rank_candidates
from app.agents.interviewer import simulate_interview_scheduling, generate_interview_questions
from app.agents.hiring_decision import process_hiring_decisions

logger = logging.getLogger(__name__)


class RecruitmentOrchestrator:
    """Recruitment Orchestrator Agent (Main Agent):
    
    This is the brain of the platform.
    Responsibilities:
    - Receives JD
    - Starts workflow
    - Calls other agents (Discovery, Assessment, Interview, Hiring Decision)
    - Stores state & checkpoints
    - Waits for HR approval
    - Continues execution
    
    Rule: It never performs business logic itself. It only coordinates!
    """

    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        logger.info(f"Recruitment Orchestrator initialized (Session ID: {self.session_id})")

    async def execute_discovery_stage(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Stage 1: Coordinates Candidate Discovery Agent."""
        logger.info(f"[{self.session_id}] Orchestrator -> Delegating to Candidate Discovery Agent...")
        
        job_sec = state.get("job", {})
        raw_desc = job_sec.get("description", "")
        if not raw_desc:
            raw_desc = f"Seeking a {job_sec.get('title', 'Senior AI Backend Engineer')} with experience in {', '.join(job_sec.get('skills', ['Python']))}."

        existing_cands = state.get("candidates", [])
        
        res = await discover_candidates(raw_desc, existing_cands if existing_cands else None)
        
        if res.data:
            discovery_data = res.data
            new_job = dict(job_sec)
            new_job.update(discovery_data.job_criteria.model_dump())
            
            # Log telemetry
            self._log_action(state, "CandidateDiscoveryAgent", f"Sourced & parsed {discovery_data.total_sourced} candidates.")
            
            return {
                "job": new_job,
                "discovery": {
                    "linkedin_boolean_query": discovery_data.linkedin_boolean_query,
                    "total_sourced": discovery_data.total_sourced
                },
                "candidates": discovery_data.parsed_candidates
            }
        return {}

    async def execute_assessment_stage(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Stage 2: Coordinates Candidate Assessment Agent."""
        logger.info(f"[{self.session_id}] Orchestrator -> Delegating to Candidate Assessment Agent...")
        
        job_sec = state.get("job", {})
        candidates = state.get("candidates", [])
        
        from app.agents.discovery import JobCriteria
        criteria = JobCriteria.model_validate(job_sec) if job_sec else JobCriteria(title="Software Engineer", required_skills=["Python"], experience="3+ years")

        res = await assess_and_rank_candidates(criteria, candidates)
        
        if res.data:
            batch_res = res.data
            ranked_cands = []
            selected_cand = None
            
            for idx, match in enumerate(batch_res.ranked_candidates, start=1):
                for cand in candidates:
                    if cand.get("name") == match.candidate_name or cand.get("email") == match.candidate_id:
                        new_cand = dict(cand)
                        new_cand["match_score"] = match.overall_score
                        new_cand["ranking"] = idx
                        new_cand["score_details"] = match.score_details.model_dump()
                        new_cand["skill_gap"] = match.skill_gap
                        new_cand["recommendation"] = match.recommendation
                        ranked_cands.append(new_cand)
                        if idx == 1:
                            selected_cand = new_cand
                        break
            
            if not ranked_cands:
                ranked_cands = candidates
                if ranked_cands:
                    selected_cand = ranked_cands[0]

            self._log_action(state, "CandidateAssessmentAgent", f"Ranked {len(ranked_cands)} candidates. Top match: {selected_cand.get('name') if selected_cand else 'None'}.")

            return {
                "candidates": ranked_cands,
                "selected_candidate": selected_cand,
                "approval": {"status": "pending", "reviewer_id": None, "comments": "Waiting for HR dashboard approval."}
            }
        return {}

    async def execute_interview_stage(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Stage 3: Coordinates Interview Agent for top candidate(s)."""
        logger.info(f"[{self.session_id}] Orchestrator -> Delegating to Interview Agent...")
        
        selected_cand = state.get("selected_candidate", {})
        job_sec = state.get("job", {})
        
        if not selected_cand:
            return {}

        cand_name = selected_cand.get("name", "Candidate")
        cand_email = selected_cand.get("email", "candidate@example.com")
        job_title = job_sec.get("title", "Software Engineer")

        # Simulate interview scheduling & question generation
        sched_res = await simulate_interview_scheduling(cand_name, cand_email, job_title, mode="chat")
        
        from app.agents.discovery import JobCriteria, CandidateProfile
        job_crit = JobCriteria.model_validate(job_sec) if job_sec else JobCriteria(title=job_title, required_skills=["Python"], experience="3+ years")
        
        parsed_dict = selected_cand.get("parsed_profile")
        if parsed_dict:
            cand_prof = CandidateProfile.model_validate(parsed_dict)
        else:
            from app.agents.discovery import PersonalInfo
            cand_prof = CandidateProfile(personal_info=PersonalInfo(name=cand_name, email=cand_email))

        q_res = await generate_interview_questions(job_crit, cand_prof, num_questions=4)
        
        self._log_action(state, "InterviewAgent", f"Scheduled interview & generated 4 tailored questions for {cand_name}.")

        return {
            "interview": {
                "status": "scheduled",
                "scheduling_details": sched_res.data.model_dump() if sched_res.data else {},
                "questions": [q.model_dump() for q in q_res.data.questions] if q_res.data else []
            }
        }

    async def execute_hiring_decision_stage(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Stage 4: Coordinates Hiring Decision Agent (with HITL interrupt check)."""
        logger.info(f"[{self.session_id}] Orchestrator -> Delegating to Hiring Decision Agent...")
        
        job_sec = state.get("job", {})
        candidates = state.get("candidates", [])
        approval = state.get("approval", {})
        
        job_title = job_sec.get("title", "Software Engineer")
        status_val = approval.get("status", "pending")
        reviewer = approval.get("reviewer_id")
        comments = approval.get("comments")

        res = await process_hiring_decisions(
            job_title=job_title,
            candidates=candidates,
            approval_status=status_val,
            reviewer_id=reviewer,
            comments=comments
        )

        if res.data:
            dec_data = res.data
            self._log_action(state, "HiringDecisionAgent", f"Processed decision status: {dec_data.decision_status.upper()}.")
            
            return {
                "decision": {
                    "status": dec_data.decision_status,
                    "comparison_report": dec_data.comparison_report.model_dump(),
                    "selected_candidate": dec_data.selected_candidate_name
                },
                "notification": dec_data.notification_result or {}
            }
        return {}

    def _log_action(self, state: Dict[str, Any], agent_name: str, action: str):
        """Helper to append telemetry audit logs to shared graph state."""
        logs = state.get("logs", [])
        import datetime
        logs.append({
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
            "agent_name": agent_name,
            "action": action,
            "status": "success"
        })
        state["logs"] = logs
