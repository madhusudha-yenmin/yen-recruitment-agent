import logging
import asyncio
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import openai
import instructor
from app.core.config import settings
from app.agents.base import AgentResponse, compute_cache_key, get_cached_llm_response, save_cached_llm_response
from app.agents.discovery import JobCriteria, CandidateProfile

logger = logging.getLogger(__name__)


# --- Data Models ---

class MatchScoreDetails(BaseModel):
    technical_skills_score: float = Field(description="Score out of 40")
    experience_score: float = Field(description="Score out of 20")
    location_score: float = Field(description="Score out of 10")
    notice_period_score: float = Field(description="Score out of 10")
    education_score: float = Field(description="Score out of 10")
    industry_score: float = Field(description="Score out of 10")


class CandidateMatchResult(BaseModel):
    candidate_id: Optional[str] = None
    candidate_name: str
    email: Optional[str] = None
    location: Optional[str] = None
    experience_years: float = 0.0
    resume_url: Optional[str] = None
    overall_score: float = Field(description="Weighted overall score from 0 to 100")
    score_details: MatchScoreDetails
    skill_gap: List[str] = Field(default_factory=list, description="List of required skills missing from candidate resume")
    matching_skills: List[str] = Field(default_factory=list, description="List of required skills present in candidate resume")
    recommendation: str = Field(description="Interview recommendation: 'strong-match', 'potential-match', or 'poor-match'")
    reasoning: str = Field(description="Detailed explanation of the match score and skill gaps")
    ranking_position: Optional[int] = None


class AssessmentBatchResult(BaseModel):
    job_title: str
    total_evaluated: int
    ranked_candidates: List[CandidateMatchResult]
    top_candidate_name: Optional[str] = None


# --- Internal Tool Functions ---

def compute_heuristic_match(job: JobCriteria, candidate: CandidateProfile) -> CandidateMatchResult:
    """Computes algorithmic weighted match score using standard hiring formula."""
    # 1. Technical Skills (40%)
    req_skills = [s.lower().strip() for s in job.required_skills if s and s != "UNKNOWN"]
    cand_skills = [s.skill_name.lower().strip() for s in candidate.skills]
    if req_skills:
        matched = [s for s in req_skills if any(s in cs or cs in s for cs in cand_skills)]
        missing = [s for s in req_skills if not any(s in cs or cs in s for cs in cand_skills)]
        tech_score = (len(matched) / len(req_skills)) * 40.0
    else:
        matched = cand_skills
        missing = []
        tech_score = 35.0

    # 2. Experience (20%)
    exp_score = 15.0
    if candidate.total_experience_years >= 5.0:
        exp_score = 20.0
    elif candidate.total_experience_years >= 3.0:
        exp_score = 16.0
    elif candidate.total_experience_years >= 1.0:
        exp_score = 12.0
    else:
        exp_score = 8.0

    # 3. Location (10%)
    loc_score = 8.0
    if job.location != "UNKNOWN" and candidate.personal_info.location != "UNKNOWN":
        if "remote" in job.location.lower() or job.location.lower() in candidate.personal_info.location.lower():
            loc_score = 10.0

    # 4. Notice Period (10%)
    notice_score = 8.0
    # 5. Education (10%)
    edu_score = 8.0
    if candidate.education:
        edu_score = 10.0
    # 6. Industry (10%)
    ind_score = 8.0

    overall = tech_score + exp_score + loc_score + notice_score + edu_score + ind_score
    overall = round(min(100.0, max(0.0, overall)), 1)

    if overall >= 80.0:
        rec = "strong-match"
    elif overall >= 60.0:
        rec = "potential-match"
    else:
        rec = "poor-match"

    return CandidateMatchResult(
        candidate_name=candidate.personal_info.name,
        overall_score=overall,
        score_details=MatchScoreDetails(
            technical_skills_score=round(tech_score, 1),
            experience_score=round(exp_score, 1),
            location_score=round(loc_score, 1),
            notice_period_score=round(notice_score, 1),
            education_score=round(edu_score, 1),
            industry_score=round(ind_score, 1),
        ),
        skill_gap=missing,
        matching_skills=matched,
        recommendation=rec,
        reasoning=f"Candidate scored {overall}/100. Matched skills: {', '.join(matched) if matched else 'None'}. Missing: {', '.join(missing) if missing else 'None'}."
    )


async def match_candidate_tool(job: JobCriteria, candidate: CandidateProfile) -> AgentResponse[CandidateMatchResult]:
    """Internal Tool: Evaluates a single candidate against job criteria using algorithmic scoring and LLM refinement."""
    heuristic_res = compute_heuristic_match(job, candidate)

    if not settings.GROQ_API_KEY:
        return AgentResponse(
            status="success",
            confidence=90,
            reasoning_summary="Evaluated candidate using algorithmic weighted scoring formula.",
            data=heuristic_res
        )

    cache_key = compute_cache_key("candidate_matcher", f"{job.model_dump_json()}:{candidate.model_dump_json()}")
    cached_data = await get_cached_llm_response(cache_key)
    if cached_data:
        match_res = CandidateMatchResult.model_validate(cached_data["data"])
        return AgentResponse(
            status="success",
            confidence=cached_data.get("confidence", 95),
            reasoning_summary="Retrieved candidate evaluation from Redis cache.",
            data=match_res
        )

    try:
        client = instructor.from_openai(openai.AsyncOpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1"
        ))
        prompt = f"""
You are an expert Candidate Assessment Agent.
Evaluate candidate against job criteria using weighted formula (Tech 40%, Exp 20%, Loc 10%, Notice 10%, Edu 10%, Industry 10%).
Job Criteria:
{job.model_dump_json(indent=2)}
Candidate Profile:
{candidate.model_dump_json(indent=2)}
Algorithmic Baseline Score: {heuristic_res.overall_score}/100. Refine reasoning and exact skill gap.
"""
        result: CandidateMatchResult = await client.chat.completions.create(
            model=settings.DEFAULT_LLM_MODEL,
            response_model=CandidateMatchResult,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        result.candidate_name = candidate.personal_info.name
        response = AgentResponse(
            status="success",
            confidence=95,
            reasoning_summary="Successfully evaluated candidate via LLM + weighted scoring formula.",
            data=result
        )
        await save_cached_llm_response(cache_key, response.model_dump())
        return response
    except Exception as exc:
        logger.error(f"LLM Candidate Matching failed: {exc}; returning heuristic baseline.")
        return AgentResponse(
            status="success",
            confidence=85,
            reasoning_summary="LLM call failed; evaluated candidate using heuristic weighted formula.",
            data=heuristic_res
        )


# --- Unified Candidate Assessment Agent Interface ---

async def assess_and_rank_candidates(job: JobCriteria, candidate_dicts: List[Dict[str, Any]]) -> AgentResponse[AssessmentBatchResult]:
    """Candidate Assessment Agent:
    
    Unified agent responsible for:
    1. Comparing JD vs Resume
    2. Calculating skill match, experience match, and education match
    3. Ranking candidate pool from highest to lowest fit
    """
    logger.info("Candidate Assessment Agent: Evaluating and ranking candidate pool...")
    
    async def process_cand(cand_dict: Dict[str, Any]) -> Optional[CandidateMatchResult]:
        parsed_dict = cand_dict.get("parsed_profile")
        if parsed_dict:
            profile = CandidateProfile.model_validate(parsed_dict)
        else:
            from app.agents.discovery import PersonalInfo
            profile = CandidateProfile(personal_info=PersonalInfo(name=cand_dict.get("name", "Unknown"), email=cand_dict.get("email")))

        res = await match_candidate_tool(job, profile)
        if res.data:
            match_data = res.data
            match_data.candidate_id = cand_dict.get("candidate_id") or cand_dict.get("email")
            match_data.email = profile.personal_info.email or cand_dict.get("email")
            match_data.location = profile.personal_info.location
            match_data.experience_years = cand_dict.get("experience_years", 0.0)
            match_data.resume_url = cand_dict.get("resume_url")
            return match_data
        return None

    evaluated_results = await asyncio.gather(*(process_cand(c) for c in candidate_dicts))
    evaluated: List[CandidateMatchResult] = [e for e in evaluated_results if e is not None]

    # Sort descending by overall score
    evaluated.sort(key=lambda x: x.overall_score, reverse=True)

    # Assign ranking positions
    for idx, cand_res in enumerate(evaluated, start=1):
        cand_res.ranking_position = idx

    top_name = evaluated[0].candidate_name if evaluated else None

    batch_res = AssessmentBatchResult(
        job_title=job.title,
        total_evaluated=len(evaluated),
        ranked_candidates=evaluated,
        top_candidate_name=top_name
    )

    return AgentResponse(
        status="success",
        confidence=95,
        reasoning_summary=f"Assessment completed: Evaluated and ranked {len(evaluated)} candidates for '{job.title}'. Top match: {top_name}.",
        data=batch_res
    )
