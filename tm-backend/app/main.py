"""FastAPI application entry point.

Bootstraps the app with a lifespan that runs Flyway migrations before
the HTTP server starts. Retries every 30 seconds on failure.
Registers CORS middleware and all routers.

Flyway connection details (url, user, password, locations) are read from
flyway.conf in the project root — no flags are passed on the command line.
"""

import asyncio
import logging
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Retry interval in seconds when Flyway migration fails (Requirement 7.3)
MIGRATION_RETRY_INTERVAL = 30


async def run_migrations_with_retry() -> None:
    """Run Flyway migrations, retrying every 30 s until they succeed.

    Connection details (url, user, password, locations) come from flyway.conf
    which Flyway reads automatically from the working directory.

    If the flyway executable is not on PATH (e.g. migrations are managed
    manually), a warning is logged and startup continues immediately —
    the server assumes migrations have already been applied.
    """
    while True:
        try:
            subprocess.run(
                ["flyway", "migrate"],
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
            logger.warning(
                "flyway executable not found on PATH — skipping automatic migration. "
                "Ensure migrations have been applied manually before starting the server."
            )
            return


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

    from app.routers import auth, tasks  # noqa: PLC0415
    application.include_router(auth.router, prefix="/auth", tags=["auth"])
    application.include_router(tasks.router, prefix="/tasks", tags=["tasks"])

    return application


app = create_app()


@app.get("/health", tags=["health"])
def health() -> dict:
    """Health-check endpoint — available before and after migrations."""
    return {"status": "ok"}
