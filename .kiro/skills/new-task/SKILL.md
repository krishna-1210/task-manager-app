---
name: new-task
description: Start a new development task from the task-manager spec. Use when picking up a task, creating a feature branch, or beginning implementation of a numbered task or GitHub issue.
---

## Starting a Task

Follow these steps in order every time a developer picks up a task.

### Step 1 — Identify the task

Ask the developer which task number or GitHub issue they are picking up if not already stated.
Accept input in any of these forms:
- "Task 7", "task-7", "#7", "Issue 7"

### Step 2 — Read the spec

Read all three spec files before writing any code:

1. `.kiro/specs/task-manager-app/tasks.md` — find the exact task by number, read its full description and acceptance criteria
2. `.kiro/specs/task-manager-app/requirements.md` — understand which requirements this task satisfies
3. `.kiro/specs/task-manager-app/design.md` — understand the design decisions that apply

### Step 3 — Check wave dependencies

Read `references/task-dependency-order.md` to confirm all prerequisite tasks from the prior wave are merged to `main` before starting. If a dependency is not yet merged, tell the developer and stop.

### Step 4 — Check existing code

Before creating any new files:
- Run `git -C <workspace> log --oneline -10` to see recent commits
- Check if any relevant files already exist in `tm-backend/app/` or `tm-frontend/src/`
- Read existing files that this task will modify or extend

### Step 5 — Create the feature branch

```powershell
git checkout main
git pull origin main
git checkout -b feature/task-<number>-<short-slug>
```

Branch naming: `feature/task-<number>-<short-slug>`
Examples: `feature/task-4-auth-service`, `feature/task-13-login-page`

### Step 6 — Confirm scope

Before writing any code, summarise:
- What this task implements (1–2 sentences)
- Which files will be created and which will be modified
- Any design decisions or tradeoffs to flag

Wait for the developer to confirm before proceeding to implementation.

### Step 7 — Implement

Follow the conventions in:
- `.kiro/steering/backend-structure.md` for all backend files
- `.kiro/steering/frontend-structure.md` for all frontend files
- `.kiro/steering/code-style.md` for naming, error handling, and logging

### Step 8 — Verify

After implementation:
- Backend changes: run `pytest` from `tm-backend/`
- Frontend changes: run `vitest --run` from `tm-frontend/`
- Fix all failures before declaring the task done

---

## Quick Reference

| Item | Rule |
|---|---|
| Branch format | `feature/task-<n>-<slug>` |
| Never commit to | `main` |
| Backend tests | `pytest` from `tm-backend/` |
| Frontend tests | `vitest --run` from `tm-frontend/` |
| Spec location | `.kiro/specs/task-manager-app/` |
