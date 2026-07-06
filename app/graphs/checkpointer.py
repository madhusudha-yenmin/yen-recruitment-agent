import logging
from typing import Any
from langgraph.checkpoint.memory import MemorySaver
from app.core.config import settings

logger = logging.getLogger(__name__)

# Global memory saver instance for fallback and testing
_memory_saver = MemorySaver()


async def get_checkpointer(db_url: str = settings.DATABASE_URL) -> Any:
    """Returns an async LangGraph checkpointer.

    Attempts to initialize AsyncPostgresSaver if available and configured,
    otherwise cleanly falls back to an in-memory MemorySaver for testing/dev.
    """
    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        # Clean up SQLAlchemy asyncpg prefix for psycopg/postgres driver if needed by langgraph-checkpoint-postgres
        conn_string = db_url.replace("postgresql+asyncpg://", "postgresql://")
        return AsyncPostgresSaver.from_conn_string(conn_string)
    except (ImportError, Exception) as exc:
        logger.warning(
            f"AsyncPostgresSaver unavailable or failed to initialize ({exc}). "
            "Falling back to in-memory MemorySaver checkpointer."
        )
        return _memory_saver
