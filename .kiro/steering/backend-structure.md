# Backend Folder Structure & Conventions

This steering file is automatically loaded for every session.
It defines the canonical folder layout and module conventions for `tm-backend/`.

---

## Canonical Folder Layout

```
tm-backend/
├── app/
│   ├── main.py                  # FastAPI app factory, router registration, middleware
│   ├── config.py                # Settings loaded from .env via pydantic-settings
│   ├── dependencies.py          # Shared FastAPI Depends() helpers (get_db, get_current_user)
│   ├── db/
│   │   ├── base.py              # SQLAlchemy Base = declarative_base()
│   │   ├── session.py           # engine + SessionLocal + get_db()
│   │   └── migrations/          # Flyway SQL migration files ONLY (no Alembic)
│   │       ├── V1__create_users.sql
│   │       └── V2__create_tasks.sql
│   ├── models/                  # SQLAlchemy ORM models (one file per table)
│   │   ├── user.py
│   │   └── task.py
│   ├── schemas/                 # Pydantic request/response schemas (one file per domain)
│   │   ├── user.py
│   │   └── task.py
│   ├── routers/                 # FastAPI APIRouter instances (one file per resource)
│   │   ├── auth.py              # POST /auth/login, POST /auth/logout
│   │   └── tasks.py             # GET/POST/PATCH/DELETE /tasks
│   ├── services/                # Business logic, no direct HTTP concerns
│   │   ├── auth_service.py
│   │   └── task_service.py
│   └── tests/                   # pytest test suite
│       ├── conftest.py          # Fixtures: test DB session, test client, seeded users
│       ├── test_auth.py
│       └── test_tasks.py
├── .env                         # Never committed — copy from .env.example
├── .env.example                 # Committed template with placeholder values
├── requirements.txt             # Pinned exact versions (use pip freeze)
└── Dockerfile                   # Optional, for containerised runs
```

---

## Module Responsibilities

| Layer | What goes here | What does NOT go here |
|---|---|---|
| `routers/` | HTTP parsing, auth guards, calling service | Business logic, DB queries |
| `services/` | Business rules, orchestration, calling models | HTTP status codes, Request/Response types |
| `models/` | SQLAlchemy table definitions | Pydantic validation |
| `schemas/` | Pydantic input/output shapes | ORM queries |
| `dependencies.py` | Reusable `Depends()` callables | Route handlers |
| `config.py` | All env-var access via `Settings` class | Inline `os.environ.get()` calls |

---

## SQLAlchemy Model Rules

- Always use `Mapped` / `mapped_column` declarative style (SQLAlchemy 2.x).
- Every model must inherit from `Base` defined in `app/db/base.py`.
- Primary keys use `Integer` with `autoincrement=True`.
- Timestamps use `DateTime(timezone=True)` with `server_default=func.now()`.
- **Never call `Base.metadata.create_all()`** — all schema changes go through Flyway migrations.

```python
# Correct model style
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, func
from app.db.base import Base

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

---

## Flyway Migration Rules

- Files live in `app/db/migrations/`.
- Naming: `V<n>__<snake_case_description>.sql` (double underscore before description).
- Never edit a migration that has already been applied — create a new one instead.
- Every migration must be idempotent where possible (use `IF NOT EXISTS`).

---

## Dependency & Config Rules

- All env vars are accessed through `app/config.py` `Settings` class — never `os.environ.get()` inline.
- `requirements.txt` must use pinned exact versions (`==`), not ranges.
- bcrypt cost factor must be `≤ 12` to satisfy the 500 ms login SLA.

---

## Error Handling Rules

- Ownership checks happen **before** existence checks — return `403` before `404`.
- Use `HTTPException` for all API errors. Never let unhandled exceptions reach the client.
- Use structured logging (`logging.getLogger(__name__)`) for all errors — no bare `print()`.

---

## Testing Rules

- Run tests from `tm-backend/` with: `pytest`
- Integration tests require a running PostgreSQL instance and a valid `.env` file.
- Property tests use `hypothesis` with `@settings(max_examples=100)`.
- Test files go in `app/tests/` and mirror the module they test (e.g., `test_tasks.py` tests `services/task_service.py` + `routers/tasks.py`).
