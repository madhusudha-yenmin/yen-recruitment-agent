from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Recruitment Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "your-super-secret-jwt-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/recruitment_db"
    SYNC_DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/recruitment_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    SERPER_API_KEY: Optional[str] = None
    DEFAULT_LLM_MODEL: str = "llama-3.3-70b-versatile"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
