import asyncio
import os
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.router import api_router
from app.smtp_mock_server import start_mock_smtp_server_task
import app.db.base  # Register all models for SQLAlchemy

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)


@app.on_event("startup")
async def startup_event():
    # Run the mock SMTP server on port 1025 in the background
    asyncio.create_task(start_mock_smtp_server_task())
    
    # Ensure uploads directory exists
    os.makedirs(os.path.join(os.path.dirname(__file__), "uploads", "resumes"), exist_ok=True)

# Serve uploaded resumes as static files
app.mount("/uploads", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "uploads")), name="uploads")

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    # allow_origin_regex="https?://.*",
      allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred.", "message": str(exc)},
    )


@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": "0.1.0"
    }


app.include_router(api_router, prefix=settings.API_V1_STR)
