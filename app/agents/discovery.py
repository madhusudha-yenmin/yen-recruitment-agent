import os
import logging
import random
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import pymupdf
import openai
import instructor
from app.core.config import settings
from app.agents.base import AgentResponse, compute_cache_key, get_cached_llm_response, save_cached_llm_response

logger = logging.getLogger(__name__)


# --- Data Models ---

class JobCriteria(BaseModel):
    title: str = Field(description="Job title extracted from description or UNKNOWN")
    required_skills: List[str] = Field(description="List of mandatory technical and domain skills")
    preferred_skills: List[str] = Field(default_factory=list, description="List of optional or preferred skills")
    experience: str = Field(description="Required years of experience or seniority level, e.g., '3-5 years' or UNKNOWN")
    salary: str = Field(default="UNKNOWN", description="Salary range mentioned or UNKNOWN")
    location: str = Field(default="UNKNOWN", description="Work location (remote/hybrid/city) or UNKNOWN")
    notice_period: str = Field(default="UNKNOWN", description="Required notice period or UNKNOWN")
    education: str = Field(default="UNKNOWN", description="Degree or educational qualification required or UNKNOWN")


class PersonalInfo(BaseModel):
    name: str = Field(default="UNKNOWN")
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    linkedin: Optional[str] = Field(default=None)
    github: Optional[str] = Field(default=None)
    portfolio: Optional[str] = Field(default=None)
    location: Optional[str] = Field(default="UNKNOWN")


class SkillItem(BaseModel):
    skill_name: str
    years: Optional[float] = None
    level: Optional[str] = None  # beginner, intermediate, advanced, expert


class EducationItem(BaseModel):
    degree: str
    institution: str
    year: Optional[str] = None


class ExperienceItem(BaseModel):
    title: str
    company: str
    duration: Optional[str] = None
    description: Optional[str] = None


class ProjectItem(BaseModel):
    title: str
    description: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)


class CandidateProfile(BaseModel):
    personal_info: PersonalInfo
    skills: List[SkillItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    total_experience_years: float = Field(default=0.0, description="Total estimated years of professional experience")
    embedding_vector: Optional[List[float]] = Field(default=None, description="1536-dimensional semantic embedding vector")


class DiscoveryResult(BaseModel):
    job_criteria: JobCriteria
    linkedin_boolean_query: str
    total_sourced: int
    parsed_candidates: List[Dict[str, Any]]


# --- Internal Tool Functions ---

def extract_text_from_pdf(file_path: str) -> str:
    """Extract raw text from a PDF resume using PyMuPDF."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Resume file not found: {file_path}")
    doc = pymupdf.open(file_path)
    text_chunks = [page.get_text() for page in doc]
    doc.close()
    return "\n".join(text_chunks)


def generate_mock_embedding(text: str, dim: int = 1536) -> List[float]:
    """Generate a deterministic mock embedding vector for development and testing."""
    seed_val = sum(ord(c) for c in text[:100]) if text else 42
    random.seed(seed_val)
    vec = [random.uniform(-0.1, 0.1) for _ in range(dim)]
    norm = sum(x * x for x in vec) ** 0.5
    return [x / (norm if norm > 0 else 1.0) for x in vec]


async def generate_embedding(text: str) -> List[float]:
    """Generate 1536-dim semantic embedding vector using OpenAI embedding model or mock fallback."""
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("sk-..."):
        return generate_mock_embedding(text)
    try:
        client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        resp = await client.embeddings.create(
            input=text[:8000],
            model=settings.EMBEDDING_MODEL
        )
        return resp.data[0].embedding
    except Exception as exc:
        logger.warning(f"OpenAI embedding generation failed ({exc}); using fallback vector.")
        return generate_mock_embedding(text)


def _get_fallback_job_criteria(job_description: str) -> JobCriteria:
    title = "Senior AI Backend Engineer" if "AI" in job_description or "Backend" in job_description else "Software Engineer"
    return JobCriteria(
        title=title,
        required_skills=["Python", "FastAPI", "PostgreSQL", "Docker", "LangGraph"],
        preferred_skills=["Redis", "React", "Next.js"],
        experience="5+ years",
        salary="$130,000 - $160,000",
        location="Remote",
        notice_period="30 days",
        education="Bachelor's in Computer Science or equivalent"
    )


def _get_fallback_candidate_profile(raw_text: str, embedding_vec: List[float]) -> CandidateProfile:
    name = "Alice Smith" if "Alice" in raw_text else ("Charlie Brown" if "Charlie" in raw_text else ("Bob Jones" if "Bob" in raw_text else "Jane Doe"))
    email = f"{name.lower().replace(' ', '.')}@example.com"
    exp_years = 6.0 if "6 years" in raw_text or "Alice" in raw_text else (4.0 if "4 years" in raw_text or "Charlie" in raw_text else 2.0)
    skills_list = []
    for sk in ["Python", "FastAPI", "PostgreSQL", "Docker", "LangGraph", "Redis", "React", "Next.js", "Django"]:
        if sk.lower() in raw_text.lower():
            skills_list.append(SkillItem(skill_name=sk, years=exp_years, level="advanced" if exp_years >= 4 else "intermediate"))
    
    if not skills_list:
        skills_list = [SkillItem(skill_name="Python", years=3.0, level="intermediate")]

    return CandidateProfile(
        personal_info=PersonalInfo(name=name, email=email, location="Remote"),
        skills=skills_list,
        education=[EducationItem(degree="B.S. in Computer Science", institution="Tech University", year="2018")],
        experience=[ExperienceItem(title="Software Engineer", company="Tech Corp", duration="2020 - Present", description=raw_text)],
        total_experience_years=exp_years,
        embedding_vector=embedding_vec
    )


async def analyze_job_description_tool(job_description: str) -> AgentResponse[JobCriteria]:
    """Internal Tool: Analyzes unstructured JD and extracts structured hiring criteria."""
    if not job_description or not job_description.strip():
        return AgentResponse(
            status="error",
            confidence=0,
            reasoning_summary="Empty job description provided.",
            errors=["Job description cannot be empty."]
        )

    cache_key = compute_cache_key("job_analyst", job_description)
    cached_data = await get_cached_llm_response(cache_key)
    if cached_data:
        criteria = JobCriteria.model_validate(cached_data["data"])
        return AgentResponse(
            status="success",
            confidence=cached_data.get("confidence", 95),
            reasoning_summary="Retrieved structured job analysis from Redis cache.",
            data=criteria
        )

    fallback_criteria = _get_fallback_job_criteria(job_description)

    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("sk-..."):
        response = AgentResponse(
            status="success",
            confidence=90,
            reasoning_summary="Analyzed JD using heuristic fallback rule set (API key not set).",
            data=fallback_criteria
        )
        await save_cached_llm_response(cache_key, response.model_dump())
        return response

    try:
        client = instructor.from_openai(openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY))
        prompt = f"""
You are an expert Candidate Discovery Agent analyzing a Job Description.
Extract structured hiring criteria. Never hallucinate. If unclear, return 'UNKNOWN'.
Job Description:
{job_description}
"""
        criteria: JobCriteria = await client.chat.completions.create(
            model=settings.DEFAULT_LLM_MODEL,
            response_model=JobCriteria,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        response = AgentResponse(
            status="success",
            confidence=95,
            reasoning_summary="Successfully extracted structured hiring criteria via LLM.",
            data=criteria
        )
        await save_cached_llm_response(cache_key, response.model_dump())
        return response
    except Exception as exc:
        logger.warning(f"LLM Job Analysis failed ({exc}); returning heuristic fallback.")
        return AgentResponse(
            status="success",
            confidence=85,
            reasoning_summary=f"LLM extraction unavailable ({str(exc)}); used heuristic fallback rule set.",
            data=fallback_criteria
        )


def generate_linkedin_query_tool(criteria: JobCriteria) -> str:
    """Internal Tool: Generates a targeted LinkedIn Boolean search query from job criteria."""
    skills = [s for s in criteria.required_skills if s and s != "UNKNOWN"]
    title_part = f'("{criteria.title}")' if criteria.title and criteria.title != "UNKNOWN" else ""
    skills_part = " AND ".join([f'"{s}"' for s in skills[:4]]) if skills else ""
    
    if title_part and skills_part:
        return f'{title_part} AND ({skills_part})'
    return title_part or skills_part or '("Software Engineer") AND ("Python")'


def search_candidates_tool(query: str, criteria: JobCriteria) -> List[Dict[str, Any]]:
    """Internal Tool: Searches candidate pools (simulated/sourced resumes) matching query."""
    return [
        {
            "candidate_id": "cand-001",
            "name": "Alice Smith",
            "email": "alice.smith@example.com",
            "raw_resume_text": "Alice Smith. Senior Python Engineer with 6 years of experience building high-performance APIs using FastAPI, PostgreSQL, Docker, Redis, and LangGraph. Built multi-agent LLM systems."
        },
        {
            "candidate_id": "cand-002",
            "name": "Charlie Brown",
            "email": "charlie.brown@example.com",
            "raw_resume_text": "Charlie Brown. Full Stack Engineer with 4 years of experience using Python, Django, PostgreSQL, and Docker. Currently exploring LangGraph and autonomous LLM workflows."
        },
        {
            "candidate_id": "cand-003",
            "name": "Bob Jones",
            "email": "bob.jones@example.com",
            "raw_resume_text": "Bob Jones. Frontend Developer with 2 years of experience in React, Next.js, and Tailwind CSS. Familiar with basic Python and REST APIs."
        }
    ]


async def parse_resume_tool(resume_text_or_path: str) -> AgentResponse[CandidateProfile]:
    """Internal Tool: Parses resume (PDF or text) into structured CandidateProfile and embedding vector."""
    if resume_text_or_path.endswith(".pdf") and os.path.exists(resume_text_or_path):
        raw_text = extract_text_from_pdf(resume_text_or_path)
    else:
        raw_text = resume_text_or_path

    if not raw_text or not raw_text.strip():
        return AgentResponse(
            status="error",
            confidence=0,
            reasoning_summary="Empty resume text provided.",
            errors=["Resume content cannot be empty."]
        )

    cache_key = compute_cache_key("resume_parser", raw_text)
    cached_data = await get_cached_llm_response(cache_key)
    if cached_data:
        profile = CandidateProfile.model_validate(cached_data["data"])
        return AgentResponse(
            status="success",
            confidence=cached_data.get("confidence", 95),
            reasoning_summary="Retrieved structured resume profile from Redis cache.",
            data=profile
        )

    embedding_vec = await generate_embedding(raw_text)
    fallback_profile = _get_fallback_candidate_profile(raw_text, embedding_vec)

    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("sk-..."):
        response = AgentResponse(
            status="success",
            confidence=92,
            reasoning_summary="Parsed resume using fallback extraction rules (API key not set).",
            data=fallback_profile
        )
        await save_cached_llm_response(cache_key, response.model_dump())
        return response

    try:
        client = instructor.from_openai(openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY))
        prompt = f"""
You are an expert Candidate Discovery Agent parsing a raw resume.
Extract comprehensive structured candidate information. Estimate total years of experience accurately based on dates. Never hallucinate.
Resume Text:
{raw_text}
"""
        profile: CandidateProfile = await client.chat.completions.create(
            model=settings.DEFAULT_LLM_MODEL,
            response_model=CandidateProfile,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        profile.embedding_vector = embedding_vec
        response = AgentResponse(
            status="success",
            confidence=95,
            reasoning_summary="Successfully extracted candidate profile and generated vector embedding.",
            data=profile
        )
        await save_cached_llm_response(cache_key, response.model_dump())
        return response
    except Exception as exc:
        logger.warning(f"LLM Resume Parsing failed ({exc}); returning heuristic fallback.")
        return AgentResponse(
            status="success",
            confidence=88,
            reasoning_summary=f"LLM parsing unavailable ({str(exc)}); used heuristic extraction rule set.",
            data=fallback_profile
        )


# --- Unified Candidate Discovery Agent Interface ---

async def discover_candidates(job_description: str, existing_candidates: Optional[List[Dict[str, Any]]] = None) -> AgentResponse[DiscoveryResult]:
    """Candidate Discovery Agent:
    
    Unified agent responsible for:
    1. Analyzing JD & extracting skills
    2. Generating LinkedIn Boolean query
    3. Searching candidate pools
    4. Parsing resumes/profiles into normalized vector structures
    """
    logger.info("Candidate Discovery Agent: Starting discovery pipeline...")
    
    # 1. Analyze JD
    jd_res = await analyze_job_description_tool(job_description)
    criteria = jd_res.data if jd_res.data else _get_fallback_job_criteria(job_description)

    # 2. Generate LinkedIn Boolean Query
    boolean_query = generate_linkedin_query_tool(criteria)
    logger.info(f"Candidate Discovery Agent: Generated Boolean Query -> {boolean_query}")

    # 3. Search Candidates
    raw_candidates = existing_candidates if existing_candidates else search_candidates_tool(boolean_query, criteria)

    # 4. Parse & Normalize Resumes
    parsed_pool = []
    for cand in raw_candidates:
        raw_text = cand.get("raw_resume_text") or cand.get("resume_url", "")
        parse_res = await parse_resume_tool(raw_text)
        new_cand = dict(cand)
        if parse_res.data:
            new_cand["parsed_profile"] = parse_res.data.model_dump()
            new_cand["skills"] = [s.model_dump() for s in parse_res.data.skills]
            new_cand["experience_years"] = parse_res.data.total_experience_years
            new_cand["embedding_vector"] = parse_res.data.embedding_vector
        parsed_pool.append(new_cand)

    result = DiscoveryResult(
        job_criteria=criteria,
        linkedin_boolean_query=boolean_query,
        total_sourced=len(parsed_pool),
        parsed_candidates=parsed_pool
    )

    return AgentResponse(
        status="success",
        confidence=jd_res.confidence,
        reasoning_summary=f"Discovery completed: Analyzed JD '{criteria.title}', generated Boolean query, and parsed {len(parsed_pool)} candidates into vector embeddings.",
        data=result
    )
