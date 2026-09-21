"""SQLAlchemy engine, session factory, and get_db dependency.

Schema management is handled exclusively by Flyway — Base.metadata.create_all()
is never called here or anywhere in the application.
"""

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings

logger = logging.getLogger(__name__)

# Engine uses the postgresql+psycopg2:// scheme from DATABASE_URL
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before use (handles DB restarts)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """FastAPI dependency that provides a database session per request.

    Yields a SQLAlchemy Session and ensures it is closed after the request
    completes, whether or not an exception was raised.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
