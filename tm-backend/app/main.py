"""FastAPI application entry point.

Bootstraps the app with a lifespan that runs Flyway migrations before
the HTTP server starts. Retries every 30 seconds on failure.
Registers CORS middleware and all routers.
"""

import asyncio
import logging
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Retry interval in seconds when Flyway migration fails (Requirement 7.3)
MIGRATION_RETRY_INTERVAL = 30


def _build_jdbc_url(database_url: str) -> str:
    """Convert a SQLAlchemy DATABASE_URL to a Flyway JDBC URL.

    Example:
        postgresql+psycopg2://user:pass@localhost:5432/taskmanager
        → jdbc:postgresql://localhost:5432/taskmanager
    """
    # Strip driver prefix (everything up to and including "://")
    without_scheme = database_url.split("://", 1)[1]          # user:pass@host:port/db
    host_db = without_scheme.split("@", 1)[1]                  # host:port/db
    return f"jdbc:postgresql://{host_db}"


async def run_migrations_with_retry() -> None:
    """Run Flyway migrations, retrying every 30 s until they succeed.

    The HTTP server is not started until this function returns successfully,
    satisfying Requirement 7.3 (server must not accept requests until DB is ready).
    """
    jdbc_url = _build_jdbc_url(settings.DATABASE_URL)

    while True:
        try:
            subprocess.run(
                [
                    "flyway",
                    f"-url={jdbc_url}",
                    f"-user={settings.DB_USER}",
                    f"-password={settings.DB_PASSWORD}",
                    "-locations=filesystem:./app/db/migrations",
                    "migrate",
                ],
                capture_output=True,
                check=True,
            )
            logger.info("Flyway migrations applied successfully.")
            return
        except subprocess.CalledProcessError as exc:
            logger.error(
                "Flyway migration failed: %s. Retrying in %ds.",
                exc.stderr.decode(errors="replace"),
                MIGRATION_RETRY_INTERVAL,
            )
            await asyncio.sleep(MIGRATION_RETRY_INTERVAL)
        except FileNotFoundError:
            logger.error(
                "flyway executable not found on PATH. Retrying in %ds.",
                MIGRATION_RETRY_INTERVAL,
            )
            await asyncio.sleep(MIGRATION_RETRY_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager.

    Runs Flyway migrations before yielding (starting the HTTP server).
    The server only becomes available after migrations succeed.
    """
    await run_migrations_with_retry()
    yield


def create_app() -> FastAPI:
    """Application factory — creates and configures the FastAPI instance."""
    application = FastAPI(
        title="Task Manager API",
        version="1.0.0",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],  # Vite dev server
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers registered here — implementations added in Tasks 5.1 and 8.1
    # from app.routers import auth, tasks
    # application.include_router(auth.router, prefix="/auth", tags=["auth"])
    # application.include_router(tasks.router, prefix="/tasks", tags=["tasks"])

    return application


app = create_app()


@app.get("/health", tags=["health"])
def health() -> dict:
    """Health-check endpoint — available before and after migrations."""
    return {"status": "ok"}
