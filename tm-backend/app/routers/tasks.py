"""Tasks router — CRUD endpoints for the /tasks resource.

All four endpoints require a valid JWT via the get_current_user dependency.
Business logic is delegated entirely to task_service; this module only handles
HTTP parsing, dependency injection, and response shaping.

Routes:
    GET    /tasks              → list[TaskResponse]   (200)
    POST   /tasks              → TaskResponse          (201)
    PATCH  /tasks/{task_id}   → TaskResponse          (200)
    DELETE /tasks/{task_id}   → (no body)             (204)
"""

import logging

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.dependencies import get_current_user
from app.schemas import TaskCreate, TaskResponse, TaskStatusUpdate
from app.services import task_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=list[TaskResponse])
def list_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskResponse]:
    """Return all tasks owned by the authenticated user.

    Args:
        current_user: Authenticated user extracted from the JWT.
        db: SQLAlchemy database session.

    Returns:
        List of TaskResponse objects (may be empty).

    Raises:
        HTTPException(401): Missing or invalid token (raised by get_current_user).
    """
    tasks = task_service.get_tasks(db, current_user.id)
    logger.info("user_id=%d fetched %d task(s).", current_user.id, len(tasks))
    return tasks


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskResponse:
    """Create a new task for the authenticated user.

    The task is always created with status ``"pending"``. The user_id is taken
    from the validated JWT — never from the request body.

    Args:
        data: Validated TaskCreate body (title required, description optional).
        current_user: Authenticated user extracted from the JWT.
        db: SQLAlchemy database session.

    Returns:
        The created TaskResponse with HTTP 201.

    Raises:
        HTTPException(401): Missing or invalid token.
        HTTPException(422): Request body fails Pydantic validation.
        HTTPException(500): Database write failure.
    """
    task = task_service.create_task(db, current_user.id, data)
    logger.info("user_id=%d created task_id=%d.", current_user.id, task.id)
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    data: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskResponse:
    """Update the status of a task owned by the authenticated user.

    Args:
        task_id: Primary key of the task to update (path parameter).
        data: Validated TaskStatusUpdate body containing the new status.
        current_user: Authenticated user extracted from the JWT.
        db: SQLAlchemy database session.

    Returns:
        The updated TaskResponse with HTTP 200.

    Raises:
        HTTPException(401): Missing or invalid token.
        HTTPException(403): Task exists but is owned by another user, or task
            does not exist (ownership cannot be confirmed).
        HTTPException(422): Invalid status value in request body.
        HTTPException(500): Database write failure.
    """
    task = task_service.update_task_status(db, task_id, current_user.id, data.status)
    logger.info(
        "user_id=%d updated task_id=%d status to '%s'.",
        current_user.id,
        task_id,
        data.status,
    )
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete a task owned by the authenticated user.

    Returns HTTP 204 No Content on success. No response body is returned.

    Args:
        task_id: Primary key of the task to delete (path parameter).
        current_user: Authenticated user extracted from the JWT.
        db: SQLAlchemy database session.

    Returns:
        Empty HTTP 204 response.

    Raises:
        HTTPException(401): Missing or invalid token.
        HTTPException(403): Task exists but is owned by another user, or task
            does not exist (ownership cannot be confirmed — 403 not 404).
        HTTPException(500): Database write failure.
    """
    task_service.delete_task(db, task_id, current_user.id)
    logger.info("user_id=%d deleted task_id=%d.", current_user.id, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
