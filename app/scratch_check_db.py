from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.models.user import User
from app.models.company import Company
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.core.config import settings

def main():
    sync_url = settings.SYNC_DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://")
    engine = create_engine(sync_url)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        cands = session.query(Candidate).all()
        print("--- CANDIDATES ---")
        for c in cands:
            print(f"ID: {c.id}, Email: {c.email}, Status: {c.status}, ProposedDates: {c.proposed_dates}")
        
        ivs = session.query(Interview).all()
        print("--- INTERVIEWS ---")
        for i in ivs:
            print(f"CandID: {i.candidate_id}, ScheduledAt: {i.scheduled_at}, Transcript: {i.transcript}")

if __name__ == "__main__":
    main()
