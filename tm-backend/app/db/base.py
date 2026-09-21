"""SQLAlchemy declarative base shared by all ORM models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models.

    Schema is managed exclusively by Flyway migrations.
    Base.metadata.create_all() must never be called.
    """
    pass
