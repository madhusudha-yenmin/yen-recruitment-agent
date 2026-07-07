import asyncio
import app.db.base  # Register all models to prevent InvalidRequestError
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash

async def seed():
    async with AsyncSessionLocal() as db:
        # Check if exists
        res = await db.execute(select(User).where(User.email == "recruiter@yen.ai"))
        if not res.scalar_one_or_none():
            recruiter = User(
                email="recruiter@yen.ai",
                password_hash=get_password_hash("Admin@1234!"),
                name="Sarah Jenkins (Demo)",
                role=UserRole.RECRUITER,
                status="active"
            )
            db.add(recruiter)
            
        res2 = await db.execute(select(User).where(User.email == "alice.smith@example.com"))
        if not res2.scalar_one_or_none():
            candidate = User(
                email="alice.smith@example.com",
                password_hash=get_password_hash("Candidate@2026!"),
                name="Alice Smith (Demo)",
                role=UserRole.CANDIDATE,
                status="active"
            )
            db.add(candidate)
        
        await db.commit()
        print("Successfully seeded demo users!")

if __name__ == "__main__":
    asyncio.run(seed())
