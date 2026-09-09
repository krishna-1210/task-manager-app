# Task Manager App — Team Workflow Guide

This steering file is automatically loaded by Kiro for every session in this workspace.
It tells Kiro how this team works, what the conventions are, and how to help developers
pick up, implement, and ship tasks end-to-end.

---

## Project Overview

This is a two-tier Task Manager web application:
- **Backend**: FastAPI + PostgreSQL + Flyway migrations + JWT auth (`tm-backend/`)
- **Frontend**: React (Vite) + Axios + React Router (`tm-frontend/`)
- **Spec**: Full requirements, design, and tasks live in `.kiro/specs/task-manager-app/`
- **GitHub repo**: https://github.com/krishna-1210/task-manager-app

---

## How a Developer Starts a Task

When a developer opens Kiro and says they are working on a task, Kiro should:

1. **Ask which GitHub issue number or task number** they are picking up (if not already stated)
2. **Read the relevant task** from `.kiro/specs/task-manager-app/tasks.md`
3. **Read the requirements** from `.kiro/specs/task-manager-app/requirements.md`
4. **Read the design** from `.kiro/specs/task-manager-app/design.md`
5. **Confirm understanding** of the task scope before writing any code
6. **Check existing code** in `tm-backend/` or `tm-frontend/` before creating new files

### Example prompt a developer might use
```
I'm picking up Issue #7 / Task 7 — Implement task service.
```
Kiro should then read `tasks.md`, find Task 7, and begin implementation.

---

## Branch Naming Convention

Always create a feature branch before writing any code.

Format: `feature/task-<number>-<short-slug>`

Examples:
- `feature/task-1-backend-setup`
- `feature/task-4-auth-service`
- `feature/task-13-login-page`

**Never commit directly to `main`.**

---

## Git Workflow

When starting a task, Kiro should run:
```bash
git checkout main
git pull origin main
git checkout -b feature/task-<number>-<slug>
```

When the task is complete, Kiro should:
1. Stage only the files changed for this task (never `git add .` blindly)
2. Commit with a meaningful message:
   ```
   feat(task-<number>): <short description>
   
   Implements <task title> as per .kiro/specs/task-manager-app/tasks.md
   Closes #<github-issue-number>
   ```
3. Push the branch: `git push -u origin feature/task-<number>-<slug>`
4. Raise a PR with:
   - Title under 70 characters
   - Body referencing the issue: `Closes #<number>`
   - Summary of what was implemented
   - What was tested

---

## Testing Requirements

### Backend
- Run tests with: `pytest` from `tm-backend/`
- All tests must pass before raising a PR
- Property tests use `hypothesis` with `@settings(max_examples=100)`
- Integration tests require a running PostgreSQL instance and `.env` file

### Frontend
- Run tests with: `vitest --run` from `tm-frontend/`
- All tests must pass before raising a PR
- Property tests use `fast-check` with `{ numRuns: 100 }`
- Never use `vitest` in watch mode — always use `--run`

---

## Code Standards

### Backend (Python / FastAPI)
- Use `Mapped` / `mapped_column` declarative style for SQLAlchemy models
- **Never** call `Base.metadata.create_all` — all schema changes go through Flyway migrations
- All Flyway migrations live in `tm-backend/app/db/migrations/`
- Ownership checks must happen **before** existence checks (403 before 404)
- bcrypt cost factor must be ≤ 12 to meet the 500ms login response constraint
- Use structured logging for all errors

### Frontend (React / Vite)
- Token stored in React state only — **never** in `localStorage`
- All API calls go through `src/api/client.js` Axios instance
- `useTasks` hook owns all task state — components do not call the API directly
- Status values must always come from the `STATUS_VALUES` constant
- `vitest --run` not watch mode for CI

---

## Task Dependency Order

Implement tasks in wave order to avoid blocked dependencies:

| Wave | Tasks |
|------|-------|
| 0 | 1.1, 1.2, 1.3, 1.4 |
| 1 | 2.1, 3.1, 10.1, 10.2 |
| 2 | 4.1 |
| 3 | 4.2–4.5, 5.1, 5.2 |
| 4 | 5.3, 5.4, 7.1, 11.1, 11.2 |
| 5 | 7.2–7.7, 8.1, 11.3, 11.4, 12.1 |
| 6 | 8.2, 8.3, 12.2, 12.3, 13.1 |
| 7 | 13.2, 13.3, 14.1 |
| 8 | 14.2, 15.1, 15.3, 15.4 |
| 9 | 15.2, 15.5, 15.6, 15.7 |
| 10 | 16.1, 17.6, 17.7, 17.8 |
| 11 | 16.2–16.4, 17.1–17.5 |

Do not start a wave until all tasks from the prior wave are merged to `main`.

---

## Environment Setup

Each developer needs a `.env` file in `tm-backend/`:
```
DATABASE_URL=postgresql+psycopg2://<user>:<password>@localhost:5432/taskmanager
SECRET_KEY=<random-secret>
DB_USER=<db-user>
DB_PASSWORD=<db-password>
```
Copy from `tm-backend/.env.example` — never commit the `.env` file.

---

## PR Checklist

Before raising a PR, Kiro should verify:
- [ ] Feature branch created with correct naming convention
- [ ] All backend tests pass (`pytest`) if backend files were changed
- [ ] All frontend tests pass (`vitest --run`) if frontend files were changed
- [ ] No `.env` or secrets files staged
- [ ] Commit message references the GitHub issue (`Closes #<n>`)
- [ ] PR description summarises what was implemented and what was tested

---

## Checkpoints

Tasks 6, 9, and 18 are checkpoints. At each checkpoint:
- All tests from prior tasks must pass
- Kiro should ask the developer to confirm before proceeding to the next wave
- No new tasks should start until the checkpoint is cleared
