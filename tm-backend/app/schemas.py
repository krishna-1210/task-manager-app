"""Pydantic request/response schemas for all API endpoints.

All schemas used by the auth and tasks routers are defined here.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------


class TokenResponse(BaseModel):
    """Response body returned on successful login (POST /auth/login)."""

    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Internal JWT payload — not exposed via the API directly.

    Attributes:
        sub: User ID as a string (subject claim).
        exp: Token expiry as a datetime.
    """

    sub: str
    exp: datetime


# ---------------------------------------------------------------------------
# Task schemas
# ---------------------------------------------------------------------------


class TaskCreate(BaseModel):
    """Request body for POST /tasks.

    Attributes:
        title: Task title, 1–255 characters (required).
        description: Optional task description, max 1000 characters.
    """

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class TaskStatusUpdate(BaseModel):
    """Request body for PATCH /tasks/{task_id}.

    Attributes:
        status: New status value; must be one of the three allowed values.
    """

    status: Literal["pending", "in_progress", "done"]


class TaskResponse(BaseModel):
    """Response body for task endpoints.

    Uses from_attributes=True so SQLAlchemy ORM instances can be serialised
    directly via model_validate(orm_obj).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime
