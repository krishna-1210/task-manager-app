---
name: raise-pr
description: Prepare and raise a pull request after completing a task. Use when a task is done and ready for review — runs tests, verifies conventions, generates the PR description, and pushes the branch.
---

## Raising a PR

Run through every step. Do not skip ahead to pushing if earlier steps fail.

### Step 1 — Confirm you are on the right branch

```powershell
git -C <workspace> branch --show-current
```

Branch must match `feature/task-<n>-<slug>`. If you are on `main`, stop — nothing gets pushed to main directly.

### Step 2 — Check what has changed

```powershell
git -C <workspace> diff --name-only HEAD
git -C <workspace> status --short
```

Review every file listed. Confirm:
- No `.env` file is staged
- No unrelated files are staged
- All files belong to this task's scope

If `.env` appears: **stop immediately**, unstage it, add it to `.gitignore`, and do not proceed until it is removed.

### Step 3 — Run tests

**Backend** (if any `tm-backend/` files changed):
```powershell
cd tm-backend
pytest
```

**Frontend** (if any `tm-frontend/` files changed):
```powershell
cd tm-frontend
npx vitest --run
```

All tests must pass. Fix failures before continuing.

### Step 4 — Run the pre-PR code review checklist

Work through each category:

**Folder structure**
- [ ] Backend files in correct layer (routers/, services/, models/, schemas/, db/, tests/)
- [ ] Frontend files in correct folder (pages/, components/, hooks/, api/, constants/, utils/)
- [ ] CSS Modules co-located next to component files

**Backend conventions**
- [ ] SQLAlchemy models use `Mapped`/`mapped_column` — not `Column()` style
- [ ] `Base.metadata.create_all()` not called anywhere
- [ ] All env vars through `app/config.py Settings` — no `os.environ.get()` inline
- [ ] Ownership check (403) before existence check (404)
- [ ] No bare `print()` calls — structured logging only
- [ ] `requirements.txt` uses pinned exact versions (`==`)

**Frontend conventions**
- [ ] JWT token in React state only — not `localStorage`
- [ ] No component imports `src/api/client.js` directly
- [ ] `useTasks` owns all task state
- [ ] Status strings from `STATUS_VALUES` constant only
- [ ] No inline `style={{}}` except dynamic values
- [ ] CSS custom properties use `--tm-*` naming

**Security**
- [ ] No secrets, tokens, or passwords hardcoded or logged
- [ ] No `.env` file staged

### Step 5 — Stage files

Stage only the files that belong to this task:

```powershell
# Stage specific files — never git add . blindly
git add tm-backend/app/routers/tasks.py
git add tm-backend/app/services/task_service.py
git add tm-frontend/src/components/tasks/TaskItem.jsx
# ... etc
```

Verify the staged set:
```powershell
git -C <workspace> diff --staged --name-only
```

### Step 6 — Commit with the correct message format

```
feat(task-<n>): <short imperative description>

Implements <task title> as per .kiro/specs/task-manager-app/tasks.md
Closes #<github-issue-number>
```

```powershell
git commit -m "feat(task-7): implement task CRUD service

Implements Task 7 — Task Service as per .kiro/specs/task-manager-app/tasks.md
Closes #7"
```

Commit message types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`

### Step 7 — Push the branch

```powershell
git push -u origin feature/task-<n>-<slug>
```

### Step 8 — Generate the PR description

Use this template, filled in from the task spec:

```
## Summary

Implements Task <n> — <task title>.

<1–2 sentence description of what was built>

## Changes

- `<file>` — <what it does>
- `<file>` — <what it does>

## Testing

- [ ] `pytest` passes (backend)
- [ ] `vitest --run` passes (frontend)
- <describe any manual testing done>

## Notes

<any design decisions, tradeoffs, or things the reviewer should know>

Closes #<issue-number>
```

### Step 9 — Raise the PR

Use the GitHub CLI:

```powershell
gh pr create `
  --title "feat(task-<n>): <short description under 70 chars>" `
  --body "<paste the generated description>" `
  --base main `
  --head feature/task-<n>-<slug>
```

PR title must be **under 70 characters**.

---

## Pre-flight Summary

| Check | Command | Must pass |
|---|---|---|
| On correct branch | `git branch --show-current` | `feature/task-<n>-*` |
| No `.env` staged | `git status --short` | `.env` not listed |
| Backend tests | `pytest` from `tm-backend/` | All green |
| Frontend tests | `vitest --run` from `tm-frontend/` | All green |
| Commit message | Manual check | Matches format |
| PR title length | Manual check | ≤ 70 chars |
