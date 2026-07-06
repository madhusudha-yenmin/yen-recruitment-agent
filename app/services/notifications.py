import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_email_content(notif_type: str, candidate_name: str, job_title: str, extra: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    """Generates professional email subject and body based on notification type."""
    extra = extra or {}
    company_name = extra.get("company_name", "Our Company")

    if notif_type == "offer_email":
        salary = extra.get("salary", "Competitive")
        return {
            "subject": f"Congratulations! Offer of Employment for {job_title} at {company_name}",
            "body": f"Dear {candidate_name},\n\nWe are thrilled to extend an offer of employment for the position of {job_title} at {company_name}.\nFollowing your impressive performance during the AI and technical interview rounds, our team was deeply impressed by your skills and background.\n\nProposed Compensation: {salary}\n\nPlease review the attached formal offer letter and let us know if you have any questions.\n\nBest regards,\nThe {company_name} Recruiting Team"
        }
    elif notif_type == "interview_email":
        schedule_time = extra.get("scheduled_at", "shortly")
        link = extra.get("interview_link", "https://portal.example.com/interview")
        return {
            "subject": f"Invitation: AI Interview for {job_title} at {company_name}",
            "body": f"Dear {candidate_name},\n\nThank you for your application for the {job_title} role at {company_name}. We would like to invite you to complete an interactive AI interview.\n\nScheduled Time: {schedule_time}\nInterview Link: {link}\n\nWe look forward to speaking with you!\n\nBest regards,\nThe {company_name} Recruiting Team"
        }
    elif notif_type == "rejection_email":
        return {
            "subject": f"Update regarding your application for {job_title}",
            "body": f"Dear {candidate_name},\n\nThank you for giving us the opportunity to consider your application for the {job_title} position at {company_name}.\nWe were impressed by your qualifications and experience; however, we have decided to move forward with other candidates whose experience more closely aligns with our current needs.\n\nWe wish you the very best in your professional endeavors and hope to stay in touch for future opportunities.\n\nWarm regards,\nThe {company_name} Recruiting Team"
        }
    elif notif_type == "reminder_email":
        return {
            "subject": f"Reminder: Upcoming Interview for {job_title}",
            "body": f"Dear {candidate_name},\n\nThis is a friendly reminder regarding your upcoming interview for {job_title}.\nPlease ensure you have a stable internet connection and access to a quiet environment.\n\nBest regards,\nThe {company_name} Recruiting Team"
        }
    else:
        return {
            "subject": f"Update on your application for {job_title}",
            "body": f"Dear {candidate_name},\n\nWe are writing to provide an update on your candidacy for {job_title} at {company_name}. We will be in touch shortly with next steps.\n\nBest regards,\nThe {company_name} Recruiting Team"
        }


async def send_notification(
    candidate_name: str,
    candidate_email: str,
    notif_type: str,
    job_title: str,
    extra_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Sends (or simulates sending) an automated recruitment notification email."""
    content = generate_email_content(notif_type, candidate_name, job_title, extra_data)
    
    # Log simulated email dispatch
    logger.info(f"[NOTIFICATION SERVICE] Dispatched {notif_type} to {candidate_email} ({candidate_name})")
    logger.debug(f"Subject: {content['subject']}\nBody:\n{content['body']}")

    return {
        "status": "sent",
        "type": notif_type,
        "sent_to": candidate_email,
        "channel": "email",
        "subject": content["subject"],
        "body": content["body"],
        "sent_at": utc_now_iso()
    }
