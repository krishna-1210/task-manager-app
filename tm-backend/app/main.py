"""FastAPI application entry point.

Full lifespan (Flyway migration startup, CORS, router registration) is
implemented in Task 2.1. This stub keeps the app runnable during Task 1.
"""

import logging

from fastapi import FastAPI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(title="Task Manager API")


@app.get("/health")
def health() -> dict:
    """Health-check endpoint."""
    return {"status": "ok"}
