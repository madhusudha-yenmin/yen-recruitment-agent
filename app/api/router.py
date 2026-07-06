from fastapi import APIRouter

api_router = APIRouter()

from app.api.v1 import auth, recruitment, interview
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(recruitment.router, prefix="/recruitment", tags=["recruitment"])
api_router.include_router(interview.router, prefix="/interview", tags=["interview"])

# Future routers:
# from app.api.v1 import jobs, candidates
# api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
