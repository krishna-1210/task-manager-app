"""Task business logic — CRUD operations for the tasks resource.

All functions operate at the service layer: they receive a DB session and
validated data, apply business rules, and return ORM instances or raise
HTTPException. They have no HTTP-request or response concerns.

Ownership rule (Requirements 5.2, 6.2):
    403 Forbidden is raised BEFORE 404 Not Found on every mutating operation.
"""

import logging

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models import Task
from app.schemas import TaskCreate

logger = logging.getLogger(__name__)


def get_tasks(db: Session, user_id: int) -> list[Task]:
    """Return all tasks owned by *user_id*, ordered by creation date descending.

    Args:
        db: Active SQLAlchemy session.
        user_id: Primary key of the authenticated user.

    Returns:
        List of Task ORM instances (may be empty).
    """
    return (
        db.query(Task)
        .filter(Task.user_id == user_id)
        .order_by(Task.created_at.desc())
        .all()
    )


def create_task(db: Session, user_id: int, data: TaskCreate) -> Task:
    """Create a new task for *user_id* with status ``"pending"``.

    Args:
        db: Active SQLAlchemy session.
        user_id: Primary key of the authenticated user (from JWT — never from
            the request body).
        data: Validated TaskCreate schema instance.

    Returns:
        The newly created and committed Task ORM instance.

    Raises:
        HTTPException(500): If the DB write fails.
    """
    task = Task(
        user_id=user_id,
        title=data.title,
        description=data.description,
        status="pending",
    )
    try:
        db.add(task)
        db.commit()
        db.refresh(task)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("DB error creating task for user_id=%d: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Failed to create task") from exc

    logger.info("Task id=%d created for user_id=%d.", task.id, user_id)
    return task


def update_task_status(
    db: Session,
    task_id: int,
    user_id: int,
    new_status: str,
) -> Task:
    """Update the status of a task, enforcing ownership before existence.

    Ownership is checked first (403) so that an unauthenticated caller cannot
    probe for task existence by observing 404 vs 403 responses.

    Args:
        db: Active SQLAlchemy session.
        task_id: Primary key of the task to update.
        user_id: Primary key of the authenticated user.
        new_status: Target status string (``"pending"``, ``"in_progress"``,
            or ``"done"``).

    Returns:
        The updated Task ORM instance.

    Raises:
        HTTPException(403): The task exists but is owned by another user,
            OR the task does not exist (ownership cannot be confirmed).
        HTTPException(404): The task does not exist AND the caller was already
            confirmed as the owner (logically impossible here — 403 fires first
            for non-owners).
        HTTPException(500): DB write failure.
    """
    # Ownership check first — fetch by task_id only (no user filter yet)
    task: Task | None = db.query(Task).filter(Task.id == task_id).first()

    # 403 before 404: if task is missing OR owned by someone else, return 403
    if task is None or task.user_id != user_id:
        logger.warning(
            "update_task_status: user_id=%d attempted to modify task_id=%d (owner=%s).",
            user_id,
            task_id,
            task.user_id if task else "N/A",
        )
        raise HTTPException(status_code=403, detail="Not authorised")

    # Task exists and is owned by the caller — safe to check 404 (unreachable
    # here, but kept for clarity if the query changes)
    # At this point task is confirmed to exist and be owned by user_id.

    try:
        task.status = new_status
        db.commit()
        db.refresh(task)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(
            "DB error updating task_id=%d status to '%s': %s", task_id, new_status, exc
        )
        raise HTTPException(status_code=500, detail="Failed to update task") from exc

    logger.info("Task id=%d status updated to '%s' by user_id=%d.", task.id, new_status, user_id)
    return task


def delete_task(db: Session, task_id: int, user_id: int) -> None:
    """Delete a task, enforcing ownership before existence.

    Per Requirement 6.2: for any task_id (including non-existent IDs) and any
    user who is not the owner, this function raises 403 and never 404.
    The existence check (404) only fires when the caller IS the confirmed owner
    but the task genuinely doesn't exist.

    Args:
        db: Active SQLAlchemy session.
        task_id: Primary key of the task to delete.
        user_id: Primary key of the authenticated user.

    Returns:
        None on success (caller should return HTTP 204).

    Raises:
        HTTPException(403): Task exists but is owned by another user, or task
            does not exist (ownership cannot be confirmed → 403 not 404).
        HTTPException(404): Task does not exist AND caller is the confirmed
            owner (edge case: task was deleted between ownership check and
            delete — in practice the 403 path fires for non-owners first).
        HTTPException(500): DB write failure.
    """
    # Ownership check first — fetch without user filter
    task: Task | None = db.query(Task).filter(Task.id == task_id).first()

    # 403 before 404 (Requirement 6.2):
    # - task not found → 403 (cannot confirm ownership → deny)
    # - task found but different owner → 403
    if task is None or task.user_id != user_id:
        logger.warning(
            "delete_task: user_id=%d attempted to delete task_id=%d (owner=%s).",
            user_id,
            task_id,
            task.user_id if task else "N/A",
        )
        raise HTTPException(status_code=403, detail="Not authorised")

    # Confirmed owner — proceed with deletion
    try:
        db.delete(task)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("DB error deleting task_id=%d: %s", task_id, exc)
        raise HTTPException(status_code=500, detail="Failed to delete task") from exc

    logger.info("Task id=%d deleted by user_id=%d.", task_id, user_id)
