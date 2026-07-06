import json
import hashlib
import logging
from typing import TypeVar, Generic, Optional, Any, Dict, List, Type
from pydantic import BaseModel, Field
import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)

DataT = TypeVar("DataT")


class AgentResponse(BaseModel, Generic[DataT]):
    """Standard output format for all recruitment AI agents."""
    status: str = "success"
    confidence: int = Field(default=95, ge=0, le=100)
    reasoning_summary: str = ""
    data: Optional[DataT] = None
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


# Global async Redis client singleton
_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def get_cached_llm_response(cache_key: str) -> Optional[Dict[str, Any]]:
    """Try to fetch cached structured LLM response from Redis."""
    try:
        r = get_redis_client()
        cached = await r.get(f"llm_cache:{cache_key}")
        if cached:
            logger.info(f"LLM cache hit for key: {cache_key[:12]}...")
            return json.loads(cached)
    except Exception as exc:
        logger.warning(f"Redis cache read failed: {exc}")
    return None


async def save_cached_llm_response(cache_key: str, data: Dict[str, Any], ttl_seconds: int = 86400) -> None:
    """Save structured LLM response to Redis cache."""
    try:
        r = get_redis_client()
        await r.setex(f"llm_cache:{cache_key}", ttl_seconds, json.dumps(data))
    except Exception as exc:
        logger.warning(f"Redis cache write failed: {exc}")


def compute_cache_key(agent_name: str, input_text: str) -> str:
    payload = f"{agent_name}:{input_text}:{settings.DEFAULT_LLM_MODEL}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
