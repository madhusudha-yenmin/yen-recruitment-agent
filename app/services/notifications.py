import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.core.config import settings

logger = logging.getLogger(__name__)

import os
from app.core.config import Settings

def get_mail_config() -> ConnectionConfig:
    """Dynamically loads email config from .env so port/credential edits take effect without restarting."""
    current_settings = Settings()

    mail_starttls = current_settings.MAIL_STARTTLS
    mail_ssl_tls = current_settings.MAIL_SSL_TLS

    if current_settings.MAIL_PORT == 587:
        mail_starttls = True
        mail_ssl_tls = False
    elif current_settings.MAIL_PORT == 465:
        mail_ssl_tls = True
        mail_starttls = False

    mail_from = current_settings.MAIL_FROM
    if current_settings.MAIL_USERNAME and "@gmail.com" in current_settings.MAIL_USERNAME.lower():
        mail_from = current_settings.MAIL_USERNAME

    return ConnectionConfig(
        MAIL_USERNAME=current_settings.MAIL_USERNAME,
        MAIL_PASSWORD=current_settings.MAIL_PASSWORD,
        MAIL_FROM=mail_from,
        MAIL_PORT=current_settings.MAIL_PORT,
        MAIL_SERVER=current_settings.MAIL_SERVER,
        MAIL_FROM_NAME=current_settings.MAIL_FROM_NAME,
        MAIL_STARTTLS=mail_starttls,
        MAIL_SSL_TLS=mail_ssl_tls,
        USE_CREDENTIALS=True if current_settings.MAIL_USERNAME else False,
        VALIDATE_CERTS=False
    )


from string import Template

async def send_scheduling_email(
    candidate_name: str,
    candidate_email: str,
    job_role: str,
    otp_password: str,
    deadline: str = None,
    company_name: str = "YEN AI",
    interview_link: str = "http://localhost:3000/",
    proposed_dates: list[str] = None
):
    if not deadline:
        # Default deadline: 3 days from now
        deadline = (datetime.now() + timedelta(days=3)).strftime("%B %d, %Y")
        
    subject = "Interview Schedule - YEN AI"
    
    # Load HTML template from the email_templates folder
    template_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "email_templates", "scheduling_interview.html"))
    html_content = ""
    
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            template_str = f.read()
        
        proposed_dates_html = ""
        if proposed_dates:
            dates_li = "".join([f"<li><strong>{d}</strong></li>" for d in proposed_dates])
            proposed_dates_html = f"""
            <div style="background-color: #e0e7ff; padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #c7d2fe;">
                <p style="margin-top: 0; margin-bottom: 8px; color: #3730a3; font-weight: 600;">Proposed Interview Dates:</p>
                <ul style="margin: 0; padding-left: 20px; color: #312e81;">
                    {dates_li}
                </ul>
            </div>
            """

        # Populate template placeholders using string.Template to avoid CSS brace formatting KeyError issues
        t = Template(template_str)
        html_content = t.safe_substitute(
            candidate_name=candidate_name,
            job_role=job_role,
            company_name=company_name,
            deadline=deadline,
            interview_link=interview_link,
            candidate_email=candidate_email,
            otp_password=otp_password,
            proposed_dates_html=proposed_dates_html
        )
    except Exception as template_err:
        logger.error(f"Failed to load or format email HTML template: {template_err}")
        # Fallback raw HTML body
        html_content = f"""
        <html>
        <body>
            <h2>Hi {candidate_name},</h2>
            <p>Your application for the {job_role} position at {company_name} has been shortlisted.</p>
            <p>Please access the portal to select your preferred date and time.</p>
            <p><a href="{interview_link}">Candidate Portal</a></p>
            <p>Login Email: {candidate_email}</p>
            <p>Verification Code: {otp_password}</p>
            <p>Please complete your availability submission by {deadline}.</p>
        </body>
        </html>
        """

    message = MessageSchema(
        subject=subject,
        recipients=[candidate_email],
        body=html_content,
        subtype=MessageType.html
    )

    # Warn if localhost URL is in email — Gmail will silently drop/spam such emails
    if "localhost" in interview_link or "127.0.0.1" in interview_link:
        logger.warning(
            f"[EMAIL DELIVERABILITY WARNING] CANDIDATE_PORTAL_URL contains '{interview_link}'. "
            "Gmail and most mail providers will silently drop or spam-filter emails containing localhost links. "
            "Update CANDIDATE_PORTAL_URL in .env to a real HTTPS URL (ngrok, devtunnel, or production)."
        )

    fm = FastMail(get_mail_config())
    try:
        await fm.send_message(message)
        logger.info(f"[EMAIL SENT] Successfully dispatched scheduling email → To: {candidate_email} | Subject: '{subject}'")
        return True
    except Exception as e:
        logger.error(
            f"[EMAIL FAILED] Could not send scheduling email to {candidate_email}.\n"
            f"  SMTP Error  : {type(e).__name__}: {e}\n"
            f"  Server      : {get_mail_config().MAIL_SERVER}:{get_mail_config().MAIL_PORT}\n"
            f"  Username    : {get_mail_config().MAIL_USERNAME}\n"
            f"  STARTTLS    : {get_mail_config().MAIL_STARTTLS}\n"
            f"  SSL/TLS     : {get_mail_config().MAIL_SSL_TLS}"
        )
        print(f"\n{'='*60}")
        print(f"[EMAIL SEND FAILED]")
        print(f"  To      : {candidate_email}")
        print(f"  Subject : {subject}")
        print(f"  Error   : {type(e).__name__}: {e}")
        print(f"{'='*60}\n")
        return False


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
    """Sends an automated recruitment notification email using FastMail."""
    content = generate_email_content(notif_type, candidate_name, job_title, extra_data)
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
            <h2 style="color: {'#10b981' if notif_type == 'offer_email' else '#ef4444' if notif_type == 'rejection_email' else '#6366f1'};">
                {'🎉 Offer of Employment' if notif_type == 'offer_email' else 'Update on Your Application' if notif_type == 'rejection_email' else 'Notification'}
            </h2>
            <div style="white-space: pre-wrap; font-size: 15px; color: #475569; margin-top: 15px;">
{content['body']}
            </div>
            <hr style="margin-top: 30px; border: 0; border-top: 1px solid #e2e8f0;" />
            <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from YEN AI Recruitment System.</p>
        </div>
    </body>
    </html>
    """
    
    try:
        message = MessageSchema(
            subject=content["subject"],
            recipients=[candidate_email],
            body=html_body,
            subtype=MessageType.html
        )
        fm = FastMail(get_mail_config())
        await fm.send_message(message)
        logger.info(f"[EMAIL SENT] Dispatched {notif_type} to {candidate_email} ({candidate_name}) | Subject: {content['subject']}")
    except Exception as e:
        logger.error(f"[EMAIL FAILED] Could not send {notif_type} to {candidate_email}: {e}")

    return {
        "status": "sent",
        "type": notif_type,
        "sent_to": candidate_email,
        "channel": "email",
        "subject": content["subject"],
        "body": content["body"],
        "sent_at": utc_now_iso()
    }
