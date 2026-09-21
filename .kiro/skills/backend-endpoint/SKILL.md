---
name: backend-endpoint
description: Add a new FastAPI endpoint to the task-manager backend. Use when implementing a new API route, HTTP method, or resource operation following the layered architecture.
---

## Adding a Backend Endpoint

Always implement in this order: **Schema → Service → Router → Test**. Never skip ahead.

### Step 1 — Define the Pydantic schemas

File: `tm-backend/app/schemas/<resource>.py`

Create request and response schemas. Suffix convention:
- `<Resource>Create` — POST request body
- `<Resource>Update` — PATCH request body  
- `<Resource>Response` — response shape returned to client

```python
# app/schemas/task.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

STATUS = Literal["pending", "in_progress", "done"]

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)

class TaskUpdate(BaseModel):
    status: STATUS

class TaskResponse(BaseModel):
    id: int
    title: str
    description: str | None
    status: STATUS
    created_at: datetime

    model_config = {"from_attributes": True}
```

### Step 2 — Implement the service function

File: `tm-backend/app/services/<resource>_service.py`

Rules:
- Service functions take a `db: Session` and domain objects — **no** `Request`, `Response`, or HTTP status codes
- Business logic lives here — not in the router
- Ownership check (`403`) before existence check (`404`)
- Use structured logging

```python
# app/services/task_service.py
import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.task import Task
from app.schemas.task import TaskCreate

logger = logging.getLogger(__name__)

def create_task(db: Session, owner_id: int, data: TaskCreate) -> Task:
    """Create a new task owned by the given user."""
    task = Task(title=data.title, description=data.description, owner_id=owner_id)
    db.add(task)
    db.commit()
    db.refresh(task)
    logger.info("Task %d created for user %d", task.id, owner_id)
    return task

def delete_task(db: Session, task_id: int, current_user_id: int) -> None:
    """Delete a task. Raises 403 if not owner, 404 if not found."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if task and task.owner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorised")  # ownership first
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")  # existence second
    db.delete(task)
    db.commit()
```

### Step 3 — Add the route to the router

File: `tm-backend/app/routers/<resource>.py`

Rules:
- Router only handles HTTP concerns: parsing, auth guards, calling service, returning response
- No DB queries directly in the router
- Use `Depends(get_current_user)` and `Depends(get_db)` from `app/dependencies.py`

```python
# app/routers/tasks.py
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.task import TaskCreate, TaskResponse
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return task_service.create_task(db, owner_id=current_user.id, data=data)
```

### Step 4 — Register the router in main.py

```python
# app/main.py
from app.routers import tasks, auth

app.include_router(auth.router)
app.include_router(tasks.router)
```

### Step 5 — Write the tests

File: `tm-backend/app/tests/test_<resource>.py`

Cover:
- Happy path (correct input, correct user)
- Auth failure (no token → 401)
- Ownership failure (wrong user → 403)
- Not found (missing resource → 404)
- Validation failure (bad input → 422)

```python
def test_delete_task_wrong_owner_returns_403(client, other_user_token, seeded_task):
    response = client.delete(
        f"/tasks/{seeded_task.id}",
        headers={"Authorization": f"Bearer {other_user_token}"}
    )
    assert response.status_code == 403
```

### Step 6 — Run tests

```powershell
cd tm-backend
pytest
```

All tests must pass before the task is marked done.

---

## Layer Cheat Sheet

| Layer | File | Allowed | Forbidden |
|---|---|---|---|
| schemas/ | `schemas/<r>.py` | Pydantic models | ORM queries |
| services/ | `services/<r>_service.py` | Business logic, DB queries | HTTPException status codes as primary concern, Request/Response |
| routers/ | `routers/<r>.py` | HTTP parsing, auth, call service | Business logic, direct DB queries |
| tests/ | `tests/test_<r>.py` | Integration + unit tests | Prod DB connections |
