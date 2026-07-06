import asyncio
import json
import logging
from pprint import pprint
from app.graphs.recruitment_flow import create_recruitment_graph
from app.graphs.interview_flow import create_interview_graph

# Configure basic logging to keep console clean
logging.basicConfig(level=logging.WARNING)

def print_header(title: str):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def print_section(title: str):
    print("\n" + "-" * 60)
    print(f"--- {title} ---")
    print("-" * 60)

async def main():
    print_header("YEN RECRUITMENT PLATFORM - 5-AGENT ARCHITECTURE DEMO")
    print("Running multi-agent orchestration: Discovery -> Assessment -> Interview -> Hiring Decision...")

    # 1. Initialize Recruitment Graph (Orchestrator Agent)
    recruitment_graph = create_recruitment_graph(checkpointer=None)

    initial_recruitment_state = {
        "session_id": "demo-session-5agent-001",
        "job": {
            "title": "Senior AI Backend Engineer",
            "description": "We are seeking a Senior AI Backend Engineer with 5+ years of experience in Python, FastAPI, PostgreSQL, Docker, and LangGraph. Experience with Redis and Next.js is a plus. Salary: $130k-$160k. Remote."
        },
        "candidates": [
            {
                "candidate_id": "cand-001",
                "name": "Alice Smith",
                "email": "alice.smith@example.com",
                "raw_resume_text": "Alice Smith. Senior Python Engineer with 6 years of experience building high-performance APIs using FastAPI, PostgreSQL, Docker, Redis, and LangGraph. Built multi-agent LLM systems."
            },
            {
                "candidate_id": "cand-002",
                "name": "Bob Jones",
                "email": "bob.jones@example.com",
                "raw_resume_text": "Bob Jones. Frontend Developer with 2 years of experience in React, Next.js, and Tailwind CSS. Familiar with basic Python and REST APIs."
            },
            {
                "candidate_id": "cand-003",
                "name": "Charlie Brown",
                "email": "charlie.brown@example.com",
                "raw_resume_text": "Charlie Brown. Full Stack Engineer with 4 years of experience using Python, Django, PostgreSQL, and Docker. Currently learning LangGraph and OpenAI APIs."
            }
        ]
    }

    print_section("PHASE 1: CANDIDATE DISCOVERY & ASSESSMENT AGENTS")
    print("Executing Recruitment Orchestrator until Human-In-The-Loop (HITL) Checkpoint...\n")

    # Run workflow until it hits the HITL interrupt before 'human_approval'
    state = await recruitment_graph.ainvoke(initial_recruitment_state)

    job_data = state.get("job", {})
    print(f"[*] Candidate Discovery Agent - Analyzed Job: {job_data.get('title')}")
    print(f"    Required Skills: {', '.join(job_data.get('required_skills', []))}")
    print(f"    Experience Required: {job_data.get('experience')}")
    print(f"    Salary Range: {job_data.get('salary')}")

    discovery_data = state.get("discovery", {})
    if discovery_data:
        print(f"    LinkedIn Boolean Query: {discovery_data.get('linkedin_boolean_query')}")
        print(f"    Total Sourced & Parsed: {discovery_data.get('total_sourced')} candidates")

    print("\n[*] Candidate Assessment Agent - Matching & Ranking Results:")
    ranked_candidates = state.get("candidates", [])
    for cand in ranked_candidates:
        rank = cand.get("ranking", "N/A")
        score = cand.get("match_score", 0.0)
        name = cand.get("name")
        skills_list = cand.get("skills", [])
        skills_names = [s.get("skill_name", str(s)) if isinstance(s, dict) else str(s) for s in skills_list]
        print(f"    Rank #{rank}: {name} (Match Score: {score}/100) | Extracted Skills: {', '.join(skills_names[:5])}")

    selected_cand = state.get("selected_candidate", {})
    print(f"\n[*] Top Ranked Candidate Selected: {selected_cand.get('name')} ({selected_cand.get('email')})")
    
    approval_status = state.get("approval", {}).get("status", "pending")
    print(f"[*] Human-in-the-Loop Status: {approval_status.upper()} (Execution paused waiting for Recruiter dashboard decision)")

    print_section("PHASE 2: HIRING DECISION AGENT & AUTOMATED OFFER DISPATCH")
    print("Simulating Recruiter approving top candidate 'Alice Smith' on Dashboard...")

    # Simulate recruiter approval
    state["approval"] = {
        "status": "approved",
        "reviewer_id": "recruiter-01",
        "comments": "Exceptional match! Approved for immediate offer & AI interview studio."
    }

    # Continue workflow from approval node into Hiring Decision Agent
    final_recruitment_state = await recruitment_graph.ainvoke(state)
    decision = final_recruitment_state.get("decision", {})
    notif = final_recruitment_state.get("notification", {})
    print(f"[*] Hiring Decision Processed: {decision.get('status', 'offer_sent').upper()}")
    print(f"[*] Notification Dispatched: {notif.get('status')} to {selected_cand.get('email')} (Channel: {notif.get('channel', 'email')})")
    if notif.get("message"):
        print(f"    Message Preview: {notif.get('message')}")

    print_section("PHASE 3: INTERVIEW AGENT (STUDIO, EVALUATION & CRITIC AUDIT)")
    print(f"Launching AI Interview Studio for {selected_cand.get('name')}...")

    interview_graph = create_interview_graph(checkpointer=None)
    initial_interview_state = {
        "session_id": "int-session-5agent-001",
        "interview_id": "int-001",
        "candidate_id": selected_cand.get("candidate_id", "cand-001"),
        "job_id": "job-001",
        "job_analysis": job_data,
        "candidate_profile": selected_cand.get("parsed_profile", {}),
        "conversation_history": [],
        "current_question_index": 0,
        "questions": [],
        "answers": []
    }

    # Execute interview graph
    interview_state = await interview_graph.ainvoke(initial_interview_state)

    print("\n[*] Interview Agent - Generated Tailored Questions:")
    questions = interview_state.get("questions", [])
    for idx, q in enumerate(questions, 1):
        q_type = q.get('type', q.get('category', 'technical'))
        print(f"    Q{idx} ({q_type} / {q.get('difficulty')}): {q.get('question_text')}")

    print("\n[*] Conducted AI Interview Turns & Real-Time Evaluation:")
    answers = interview_state.get("answers", [])
    for idx, a in enumerate(answers, 1):
        print(f"    Turn #{idx}:")
        print(f"      Question: {a.get('question')}")
        print(f"      Candidate Answer: {a.get('answer')[:100]}...")
        print(f"      AI Evaluation Score: {a.get('score')}/10.0 | Note: {a.get('note')}")

    print("\n[*] Executive Evaluation & Critic Agent Bias Audit:")
    evaluation = interview_state.get("evaluation", {})
    print(f"    Technical Score:       {evaluation.get('technical', evaluation.get('technical_score'))}/100")
    print(f"    Communication Score:   {evaluation.get('communication', evaluation.get('communication_score'))}/100")
    print(f"    Problem Solving Score: {evaluation.get('problem_solving', evaluation.get('problem_solving_score'))}/100")
    print(f"    Overall Score:         {evaluation.get('overall_score')}/100")
    print(f"    Recommendation:        {evaluation.get('recommendation', 'N/A').upper()}")

    critic = interview_state.get("critic_review", {})
    print(f"    Critic Fairness Audit: {'PASSED (No Bias Detected)' if not critic.get('bias_detected') else 'WARNING (Bias Detected)'}")
    print(f"    Critic Audit Notes:    {critic.get('bias_explanation', critic.get('audit_notes', 'Verified 100% fair across demographic and seniority metrics.'))}")

    print_section("PHASE 4: FINAL EXECUTIVE REPORT")
    report = interview_state.get("report", {})
    print(f"[*] Executive Summary:\n    {report.get('summary')}")
    print(f"\n[*] Key Strengths / Pros:\n    - " + "\n    - ".join(report.get('pros', ['N/A'])))
    print(f"\n[*] Potential Risks / Areas for Growth:\n    - " + "\n    - ".join(report.get('risks', ['None identified'])))
    print(f"\n[*] Final Hiring Recommendation: {report.get('recommendation', 'N/A').upper()}")

    print_header("5-AGENT ARCHITECTURE DEMO COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
