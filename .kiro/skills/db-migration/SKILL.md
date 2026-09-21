---
name: db-migration
description: Create or update a Flyway database migration for the task-manager backend. Use when adding a new table, altering a column, adding an index, or any other schema change.
---

## Flyway Migration Workflow

Follow these steps every time a schema change is needed. Never use `Base.metadata.create_all()`.

### Step 1 — Determine the next version number

Check the existing migrations in `tm-backend/app/db/migrations/` to find the highest version number currently used.

```powershell
Get-ChildItem "tm-backend/app/db/migrations" -Filter "V*.sql" | Sort-Object Name
```

The new migration gets the next integer: if the last is `V3__...`, yours is `V4__...`.

### Step 2 — Name the file correctly

Format: `V<n>__<snake_case_description>.sql`

Rules:
- Double underscore between version and description
- Description in `snake_case`
- Be specific — the description is permanent history

Good examples:
- `V1__create_users_table.sql`
- `V2__create_tasks_table.sql`
- `V3__add_status_index_to_tasks.sql`

Bad examples:
- `V1_create_users.sql` — single underscore (wrong)
- `V1__update.sql` — description too vague
- `V1__CreateUsers.sql` — not snake_case

### Step 3 — Write the migration

Every migration must follow these rules:

**Always use `IF NOT EXISTS` / `IF EXISTS`** to make migrations idempotent:

```sql
-- Creating a table
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Adding a column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;

-- Creating an index
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(owner_id);

-- Dropping a table (use with care)
DROP TABLE IF EXISTS legacy_table;
```

**Never:**
- Edit a migration file that has already been applied to any environment
- Use `DROP COLUMN` without a preceding `ADD COLUMN` migration in the same PR
- Store application logic or stored procedures in migrations

### Step 4 — Update the SQLAlchemy model

After writing the migration, update (or create) the corresponding model in `tm-backend/app/models/`.

Use `Mapped` / `mapped_column` style (SQLAlchemy 2.x):

```python
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, func
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

### Step 5 — Verify locally

With PostgreSQL running and `.env` configured:

```powershell
# Apply the migration via Flyway
flyway -url=jdbc:postgresql://localhost:5432/taskmanager migrate

# Or check what would be applied without running
flyway -url=jdbc:postgresql://localhost:5432/taskmanager info
```

If Flyway is not installed locally, note that CI will validate it. At minimum, check that the SQL syntax is valid.

### Step 6 — Run backend tests

```powershell
cd tm-backend
pytest
```

All tests must pass before committing the migration.

---

## Quick Reference

| Rule | Detail |
|---|---|
| File location | `tm-backend/app/db/migrations/` |
| Naming | `V<n>__<snake_case>.sql` (double underscore) |
| Idempotency | Always use `IF NOT EXISTS` |
| Never | Edit an applied migration |
| Never | Call `Base.metadata.create_all()` |
| Model style | `Mapped` / `mapped_column` (SQLAlchemy 2.x) |
