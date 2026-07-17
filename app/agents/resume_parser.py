"""
Resume Parser Agent using PyMuPDF (fitz) and LLM Semantic Extraction.
deterministic fields: email, phone, linkedin, github are extracted using regex.
semantic fields: name, skills, education, employment_history, projects are extracted using LLM.
experience_years: computed in Python based on the employment dates.
"""
import logging
import re
import os
import datetime
from collections import Counter
from typing import List, Optional, Tuple, Dict


import openai
import instructor
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Ensure env variables are loaded using absolute path
from dotenv import load_dotenv
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(env_path)


# ---------------------------------------------------------------------------
# Pydantic Data Models (Final Output & LLM Target)
# ---------------------------------------------------------------------------

class ParsedResume(BaseModel):
    name: str = "Unknown"
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    location: Optional[str] = None
    skills: List[str] = []
    education: List[str] = []
    experience_years: float = 0.0
    total_pages: int = 1
    raw_text_preview: str = ""


class ATSDimension(BaseModel):
    name: str
    score: float        # 0–100
    weight: float       # 0.0–1.0 fraction
    detail: str


class ATSResult(BaseModel):
    candidate_id: str
    filename: str
    parsed: ParsedResume
    ats_score: float    # 0–100 weighted composite
    dimensions: List[ATSDimension]
    recommendation: str  # "strong-hire" | "hire" | "no-hire"
    resume_url: Optional[str] = None


# Pydantic models for semantic extraction via LLM
class EmploymentHistoryItem(BaseModel):
    company: str = Field(description="Name of the company / employer")
    title: str = Field(description="Job title or role designation")
    start_date: str = Field(description="Start date of employment normalized to YYYY-MM format (e.g. '2020-06', '2018-05')")
    end_date: str = Field(description="End date of employment normalized to YYYY-MM format or 'Present' (e.g. '2022-08', 'Present')")
    description: Optional[str] = Field(default=None, description="Short summary of work done or achievements")

class ProjectItem(BaseModel):
    name: str = Field(description="Project name")
    description: Optional[str] = Field(default=None, description="Short description of the project")

class EducationItem(BaseModel):
    institution: str = Field(description="University, college or school name")
    degree: str = Field(description="Degree name (e.g. B.S., B.Tech, Master, PhD)")
    year: Optional[str] = Field(default=None, description="Graduation year or duration (e.g. '2020', '2016-2020')")

class SemanticExtraction(BaseModel):
    name: str = Field(description="Candidate's full name")
    location: Optional[str] = Field(default=None, description="Candidate's current location (city/state)")
    skills: List[str] = Field(description="List of technical and professional skills mentioned")
    education: List[EducationItem] = Field(description="List of educational qualifications")
    employment_history: List[EmploymentHistoryItem] = Field(description="List of professional experience positions")
    projects: List[ProjectItem] = Field(description="List of side projects or academic projects")


# ---------------------------------------------------------------------------
# Text Extraction & Preprocessing
# ---------------------------------------------------------------------------

def _extract_and_preprocess_pdf(pdf_bytes: bytes) -> Tuple[str, int]:
    """
    Extract text using pdfminer.six.
    Normalizes whitespace, removes duplicate headers/footers and page numbers,
    and inserts missing newlines around section headers.
    """
    try:
        import io
        from pdfminer.high_level import extract_text_to_fp
        from pdfminer.layout import LAParams

        output = io.StringIO()
        extract_text_to_fp(io.BytesIO(pdf_bytes), output, laparams=LAParams())
        raw_text = output.getvalue()
        
        # Split pages and clean empty pages / single-character line noise
        pages = [p.strip() for p in raw_text.split("\x0c")]
        pages = [p for p in pages if len(p.strip()) > 1]
        page_count = max(1, len(pages))
    except Exception as e:
        logger.error(f"pdfminer failed to open document: {e}")
        return "", 1

    first_lines = []
    last_lines = []
    pages_lines = []

    for page in pages:
        lines = [line.strip() for line in page.splitlines() if line.strip()]
        pages_lines.append(lines)
        if lines:
            first_lines.append(lines[0])
            last_lines.append(lines[-1])

    header_to_remove = None
    footer_to_remove = None
    if page_count > 1:
        if first_lines:
            first_counts = Counter(first_lines)
            most_common_first, count = first_counts.most_common(1)[0]
            if count >= max(2, page_count // 2):
                header_to_remove = most_common_first
        if last_lines:
            last_counts = Counter(last_lines)
            most_common_last, count = last_counts.most_common(1)[0]
            if count >= max(2, page_count // 2):
                footer_to_remove = most_common_last

    reconstructed_lines = []
    page_num_pattern = re.compile(r'(?i)^(page\s*\d+(\s*of\s*\d+)?|\d+\s*/\s*\d+)$')

    for lines in pages_lines:
        for line in lines:
            if page_num_pattern.match(line):
                continue
            if header_to_remove and line == header_to_remove:
                continue
            if footer_to_remove and line == footer_to_remove:
                continue
            reconstructed_lines.append(line)

    clean_text = "\n".join(reconstructed_lines)

    # Wrap headers in newlines
    headers_pattern = re.compile(
        r'(?i)\b(summary|objective|skills|technical skills|education|academic background|work experience|employment history|experience|projects|publications|certifications)\b'
    )
    
    processed_lines = []
    for line in clean_text.splitlines():
        line_strip = line.strip()
        if not line_strip:
            continue
        if headers_pattern.match(line_strip) and len(line_strip.split()) <= 3:
            processed_lines.append("")
            processed_lines.append(line_strip.upper())
            processed_lines.append("")
        else:
            processed_lines.append(line)

    processed_text = "\n".join(processed_lines)
    
    # Normalize whitespaces
    processed_text = re.sub(r'[ \t]+', ' ', processed_text)
    processed_text = re.sub(r'\n{3,}', '\n\n', processed_text)
    processed_text = processed_text.strip()
    
    # Remove trailing single character line noise at the end of the document
    lines = processed_text.splitlines()
    while lines and len(lines[-1].strip()) <= 1:
        lines.pop()
    processed_text = "\n".join(lines).strip()
    
    return processed_text, page_count


# ---------------------------------------------------------------------------
# Regex Deterministic Field Extractors
# ---------------------------------------------------------------------------

def _extract_email(text: str) -> Optional[str]:
    # 1. Match explicitly up to TLD and stop to avoid merging issues with trailing headers
    match = re.search(r"\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.(?:com|org|net|edu|gov|in|co|us|info|io|me|dev))\b", text)
    if match:
        return match.group(1)
        
    # 2. What if it's merged like "email@domain.comSkills" or "email@domain.comS"?
    match_merged = re.search(r"\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.(?:com|org|net|edu|gov|in|co|us|info|io|me|dev))", text)
    if match_merged:
        return match_merged.group(1)
    
    # 3. Fallback to general email pattern
    emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,4}", text)
    if emails:
        email = emails[0]
        # Clean any trailing 'S' or 's' appended due to merged layout text
        for tld in ["com", "org", "net", "edu", "gov", "in", "co", "us", "info", "io", "me", "dev"]:
            if email.endswith(tld + "S") or email.endswith(tld + "s"):
                return email[:-1]
        return email
    return None


def _extract_phone(text: str) -> Optional[str]:
    # Remove common date formats and date ranges to prevent year intervals (e.g. 2018 - 2021) from matching as phones
    temp_text = re.sub(r'\b(19\d{2}|20\d{2})\s*[-–—]\s*(19\d{2}|20\d{2}|present|current)\b', '', text, flags=re.IGNORECASE)
    temp_text = re.sub(r'\b\d{2}[-./]\d{2}[-./]\d{4}\b', '', temp_text)
    
    # Match formatted phone numbers
    phones = re.findall(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|(?:\+?91[-.\s]?)?\d{10}\b", temp_text)
    if phones:
        return phones[0].strip()
        
    # Strict fallback for other digit strings
    fallback_phones = re.findall(r"[\+\(]?[0-9][0-9 .\-\(\)]{8,15}[0-9]", temp_text)
    valid = [p.strip() for p in fallback_phones if len(re.sub(r"\D", "", p)) >= 10]
    return valid[0] if valid else None


def _extract_linkedin(text: str) -> Optional[str]:
    match = re.search(r'(?i)\blinkedin\.com/(?:in/|pub/)?([a-zA-Z0-9_\-\u00C0-\u00FF]+)', text)
    if match:
        handle = match.group(1)
        # Clean up common PDF parsing concatenation artifacts
        handle = re.sub(r'(?i)(created|page\d*|resume|email|phone|mobile|contact|github|portfolio|website)$', '', handle)
        handle = handle.rstrip('-_')
        if handle:
            return f"https://www.linkedin.com/in/{handle}"
    return None


def _extract_github(text: str) -> Optional[str]:
    match = re.search(r'(?i)\bgithub\.com/([a-zA-Z0-9_\-]+)', text)
    if match:
        handle = match.group(1)
        # Clean up common PDF parsing concatenation artifacts
        handle = re.sub(r'(?i)(created|page\d*|resume|email|phone|mobile|contact|linkedin|portfolio|website)$', '', handle)
        handle = handle.rstrip('-_')
        if handle:
            return f"https://github.com/{handle}"
    return None


def _extract_location(text: str) -> Optional[str]:
    txt_lower = text.lower()
    for city in ["Chennai", "Coimbatore", "Bengaluru", "Bangalore", "Hyderabad", "Mumbai", "Pune", "Delhi", "San Francisco", "New York", "London"]:
        if city.lower() in txt_lower:
            return city if city != "Bangalore" else "Bengaluru"
    return None


# ---------------------------------------------------------------------------
# Python-based Experience Calculator
# ---------------------------------------------------------------------------

def _calculate_experience_years(employment_history: List[EmploymentHistoryItem]) -> float:
    """
    Calculate the total experience duration in years from employment dates.
    Handles overlapping periods by sorting and merging intervals.
    """
    if not employment_history:
        return 0.0

    current_year = datetime.datetime.now().year
    current_month = datetime.datetime.now().month

    def parse_date_str(date_str: str) -> Tuple[int, int]:
        """Parse year and month from YYYY-MM format. Returns (year, month)."""
        clean_str = date_str.strip().lower()
        if not clean_str or any(kw in clean_str for kw in ["present", "current", "active", "now"]):
            return current_year, current_month

        # Match YYYY-MM
        match = re.search(r"\b(19\d{2}|20\d{2})-(0?[1-9]|1[0-2])\b", clean_str)
        if match:
            return int(match.group(1)), int(match.group(2))

        # Fallback to 4-digit year
        year_match = re.search(r"\b(19\d{2}|20\d{2})\b", clean_str)
        if year_match:
            return int(year_match.group(1)), 1

        return current_year, 1

    # Convert all employment items to intervals (start_in_months, end_in_months)
    intervals: List[Tuple[int, int]] = []
    base_year = 1970
    
    for item in employment_history:
        start_year, start_month = parse_date_str(item.start_date)
        end_year, end_month = parse_date_str(item.end_date)
        
        start_val = (start_year - base_year) * 12 + start_month
        end_val = (end_year - base_year) * 12 + end_month
        
        if end_val >= start_val:
            intervals.append((start_val, end_val))

    if not intervals:
        return 0.0

    # Merge overlapping intervals
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]
    for current in intervals[1:]:
        prev_start, prev_end = merged[-1]
        curr_start, curr_end = current
        if curr_start <= prev_end:
            merged[-1] = (prev_start, max(prev_end, curr_end))
        else:
            merged.append(current)

    # Sum total months
    total_months = sum((end - start + 1) for start, end in merged)
    return round(total_months / 12.0, 1)


# ---------------------------------------------------------------------------
# ATS Scoring
# ---------------------------------------------------------------------------

def _skills_match_score(candidate_skills: List[str], job_title: str, exp_req: str) -> Tuple[float, str]:
    if not candidate_skills:
        return 0.0, "No skills detected in resume."

    job_kw = set(re.split(r"[\s,/+\-]+", job_title.lower()))
    job_kw.update(re.split(r"[\s,/+\-]+", exp_req.lower()))
    job_kw -= {"the", "a", "an", "of", "in", "for", "and", "or", "with", "years", "year", "experience", ""}
    
    # Filter generic job role titles and raw digits
    role_words = {"developer", "engineer", "senior", "junior", "lead", "manager", "intern", "analyst", "specialist", "consultant", "staff", "principal", "software", "tech", "technical"}
    job_kw -= role_words
    job_kw = {w for w in job_kw if not w.isdigit()}

    if not job_kw:
        return 70.0, "No specific keywords in job title."

    # Map of synonym sets for related tech stacks
    synonyms = {
        "java": {"java", "core java", "j2ee", "spring", "spring boot", "hibernate", "jvm"},
        "react": {"reactjs", "react.js", "react-js", "react native", "react-native"},
        "node": {"nodejs", "node.js", "expressjs", "express.js"},
        "js": {"javascript", "js", "es6"},
        "ts": {"typescript", "ts"},
        "aws": {"amazon web services", "aws", "s3", "ec2", "rds", "lambda"},
        "gcp": {"google cloud", "google cloud platform", "gcp"},
        "azure": {"microsoft azure", "azure"},
        "sql": {"mysql", "postgresql", "sql server", "sqlite", "oracle", "pl/sql", "mariadb"},
        "mongodb": {"mongo", "mongodb"},
        "postgres": {"postgresql", "postgres"},
        "python": {"django", "fastapi", "flask", "py"},
        "ml": {"machine learning", "deep learning", "nlp", "computer vision", "artificial intelligence", "ai"},
        "ai": {"artificial intelligence", "ai", "llm", "genai", "generative ai"},
    }

    matched = set()
    for kw in job_kw:
        # Build list of synonyms for this keyword
        kw_syns = {kw}
        for k, syn_set in synonyms.items():
            if kw == k or kw in syn_set:
                kw_syns.update(syn_set)
                kw_syns.add(k)
                
        # Look for exact word boundary match in candidate's skills list to avoid java matching javascript
        found = False
        for skill in candidate_skills:
            skill_lower = skill.lower().strip()
            for syn in kw_syns:
                syn_lower = syn.lower().strip()
                # Check exact equality or word boundary match (e.g. \bjava\b inside 'core java, sql', but not 'javascript')
                if (syn_lower == skill_lower or 
                    re.search(r'\b' + re.escape(syn_lower) + r'\b', skill_lower) or 
                    re.search(r'\b' + re.escape(skill_lower) + r'\b', syn_lower)):
                    matched.add(kw)
                    found = True
                    break
            if found:
                break

    ratio = len(matched) / len(job_kw)
    score = min(ratio * 150, 100.0)  # Generous matching curve
    detail = f"Matched {len(matched)}/{len(job_kw)} keywords: {', '.join(sorted(matched)) or 'none'}"
    return round(score, 1), detail


def _experience_score(detected_years: float, required_exp: str) -> Tuple[float, str]:
    nums = re.findall(r"\d+(?:\.\d+)?", required_exp)
    if not nums:
        return 70.0, "No specific experience requirement."
    required = float(nums[0])
    if required == 0:
        return 100.0, "No minimum experience required."

    if detected_years >= required:
        score = 100.0
        detail = f"~{detected_years:.1f} yrs detected ≥ {required:.0f}+ yrs required."
    elif detected_years >= required * 0.7:
        score = 75.0
        detail = f"~{detected_years:.1f} yrs slightly below {required:.0f}+ yrs."
    else:
        score = max((detected_years / required) * 100, 10.0)
        detail = f"~{detected_years:.1f} yrs well below {required:.0f}+ yrs required."

    return round(score, 1), detail


def _education_score(education: List[str]) -> Tuple[float, str]:
    if not education:
        return 40.0, "No education information detected."
    edu_text = " ".join(education).lower()
    if any(k in edu_text for k in ["phd", "ph.d", "doctorate"]):
        return 100.0, "Doctorate / PhD detected."
    if any(k in edu_text for k in ["master", "msc", "mtech", "mba", "mca", "m.e"]):
        return 90.0, "Master's degree detected."
    if any(k in edu_text for k in ["bachelor", "b.e", "b.tech", "bsc", "bca", "b.sc", "degree"]):
        return 80.0, "Bachelor's degree detected."
    if any(k in edu_text for k in ["diploma", "certificate"]):
        return 60.0, "Diploma / Certificate detected."
    return 55.0, f"{education[0][:60]}"


def _contact_score(email: Optional[str], phone: Optional[str]) -> Tuple[float, str]:
    if email and phone:
        return 100.0, "Email and phone both present."
    if email:
        return 70.0, "Email present; phone missing."
    if phone:
        return 60.0, "Phone present; email missing."
    return 20.0, "No contact info detected."


# ---------------------------------------------------------------------------
# Public Entry Point
# ---------------------------------------------------------------------------

def parse_and_score_resume(
    pdf_bytes: bytes,
    filename: str,
    candidate_id: str,
    job_title: str,
    experience_req: str,
) -> ATSResult:
    """
    Parse a PDF resume and return a structured ATSResult.
    deterministic fields: email, phone, linkedin, github extracted via regex.
    semantic fields: name, skills, education, employment, projects extracted via LLM.
    experience_years: computed in Python based on employment dates.
    final validation: completed via Pydantic model validation.
    """
    # 1. Extract & Preprocess text
    text, page_count = _extract_and_preprocess_pdf(pdf_bytes)

    if not text.strip():
        logger.warning(f"No text extracted from {filename}. Returning zeroed result.")
        return ATSResult(
            candidate_id=candidate_id,
            filename=filename,
            parsed=ParsedResume(total_pages=page_count),
            ats_score=0.0,
            dimensions=[],
            recommendation="no-hire"
        )

    # 2. Extract deterministic fields using regex
    email = _extract_email(text)
    phone = _extract_phone(text)
    linkedin = _extract_linkedin(text)
    github = _extract_github(text)

    # 3. Extract semantic fields using LLM
    semantic = None
    groq_key = os.getenv("GROQ_API_KEY")

    if groq_key:
        try:
            logger.info("GROQ_API_KEY found. Orchestrating Semantic LLM Extraction...")
            client = instructor.from_openai(openai.OpenAI(
                api_key=groq_key,
                base_url="https://api.groq.com/openai/v1"
            ))
            
            semantic = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                response_model=SemanticExtraction,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"Extract the semantic candidate profile from this resume. "
                            f"Carefully locate the candidate name, extract all technical skills, "
                            f"extract the list of educational qualifications, side projects, and "
                            f"the full list of employment positions with their exact start & end dates. "
                            f"Resume Text:\n{text}"
                        )
                    }
                ],
                temperature=0.1
            )
        except Exception as e:
            import traceback
            print(f"\n[ERROR] LLM Semantic Extraction failed: {e}")
            traceback.print_exc()
            logger.warning(f"LLM Semantic Extraction failed: {e}. Falling back to default values.")

    # 4. Fallback if LLM fails or is not configured
    if not semantic:
        semantic = SemanticExtraction(
            name=filename.replace(".pdf", "").replace("_", " ").title(),
            skills=[],
            education=[],
            employment_history=[],
            projects=[]
        )

    # 5. Compute experience in Python from extracted dates
    experience_years = _calculate_experience_years(semantic.employment_history)

    # Format education items into clean strings list
    formatted_education = []
    for edu in semantic.education:
        parts = [p.strip() for p in [edu.degree, edu.institution] if p and p.strip()]
        edu_str = " - ".join(parts)
        if edu.year and edu.year.strip():
            edu_str += f" ({edu.year.strip()})"
        if edu_str:
            formatted_education.append(edu_str)

    # 6. Validate final ParsedResume with Pydantic
    location_str = semantic.location or _extract_location(text) or "Chennai, India"
    if location_str and location_str.strip().lower() == "remote":
        location_str = _extract_location(text) or "Chennai, India"

    parsed = ParsedResume.model_validate({
        "name": semantic.name or "Unknown Candidate",
        "email": email,
        "phone": phone,
        "linkedin": linkedin,
        "github": github,
        "location": location_str,
        "skills": semantic.skills or [],
        "education": formatted_education,
        "experience_years": experience_years,
        "total_pages": page_count,
        "raw_text_preview": text[:500].strip()
    })

    logger.info(f"Successfully validated profile for '{parsed.name}' (Computed Exp: {parsed.experience_years:.1f} yrs)")

    # 7. ATS Scoring
    s_score, s_detail = _skills_match_score(parsed.skills, job_title, experience_req)
    e_score, e_detail = _experience_score(parsed.experience_years, experience_req)
    edu_score, edu_detail = _education_score(parsed.education)
    c_score, c_detail = _contact_score(parsed.email, parsed.phone)

    dimensions = [
        ATSDimension(name="Skills Match",         score=s_score,   weight=0.50, detail=s_detail),
        ATSDimension(name="Experience",           score=e_score,   weight=0.25, detail=e_detail),
        ATSDimension(name="Education",            score=edu_score, weight=0.15, detail=edu_detail),
        ATSDimension(name="Contact Info",         score=c_score,   weight=0.10, detail=c_detail),
    ]

    # If skills matching criteria were present but candidate matched 0 keywords, set overall ATS score to 0.0
    if s_score == 0.0:
        composite = 0.0
    else:
        composite = round(sum(d.score * d.weight for d in dimensions), 1)

    recommendation = (
        "strong-hire" if composite >= 70
        else "hire" if composite >= 45
        else "no-hire"
    )

    return ATSResult(
        candidate_id=candidate_id,
        filename=filename,
        parsed=parsed,
        ats_score=composite,
        dimensions=dimensions,
        recommendation=recommendation
    )
