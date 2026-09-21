# Shared Code Style — Naming, Error Handling & Logging

This steering file is automatically loaded for every session.
It defines conventions that apply across both `tm-backend/` and `tm-frontend/`.

---

## Naming Conventions

### Python (backend)

| Construct | Convention | Example |
|---|---|---|
| Files / modules | `snake_case` | `task_service.py` |
| Classes | `PascalCase` | `TaskService`, `UserSchema` |
| Functions / methods | `snake_case` | `get_task_by_id()` |
| Variables | `snake_case` | `current_user`, `task_list` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_TASKS_PER_USER` |
| Pydantic schemas | `PascalCase` + suffix | `TaskCreate`, `TaskResponse`, `UserLogin` |
| SQLAlchemy models | `PascalCase` (singular) | `Task`, `User` |
| Router prefixes | `kebab-case` | `/auth`, `/tasks` |
| DB columns | `snake_case` | `created_at`, `owner_id` |

### JavaScript / JSX (frontend)

| Construct | Convention | Example |
|---|---|---|
| Files — components | `PascalCase.jsx` | `TaskItem.jsx` |
| Files — hooks | `camelCase.js` | `useTasks.js` |
| Files — utilities | `camelCase.js` | `formatDate.js` |
| Files — constants | `camelCase.js` | `taskStatus.js` |
| Files — CSS Modules | `PascalCase.module.css` | `TaskItem.module.css` |
| React components | `PascalCase` | `TaskItem`, `LoginForm` |
| Hooks | `use` prefix, `camelCase` | `useTasks`, `useAuth` |
| Variables / functions | `camelCase` | `taskList`, `handleDelete` |
| Constants (exported) | `UPPER_SNAKE_CASE` | `STATUS_VALUES`, `MAX_TITLE_LENGTH` |
| Event handlers | `handle` prefix | `handleSubmit`, `handleStatusChange` |
| Boolean props/vars | `is` / `has` prefix | `isLoading`, `hasError` |

---

## Error Handling

### Backend

- Every router function is wrapped in `try/except` or uses FastAPI's exception handlers.
- Always raise `HTTPException` with an explicit `status_code` and `detail` string.
- Ownership check (`403`) happens **before** existence check (`404`).
- Never expose internal error messages or stack traces to API responses.
- Log the full exception at `ERROR` level before re-raising or returning.

```python
# Correct pattern
import logging
logger = logging.getLogger(__name__)

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if task and task.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised")   # ownership first
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")   # existence second
    db.delete(task)
    db.commit()
```

### Frontend

- All async hook functions use `try/catch` blocks.
- Errors are stored in React state (`error` field) and surfaced via `ErrorBanner`.
- Network errors and non-2xx responses are caught at the Axios interceptor level.
- `401` responses automatically redirect to `/login` and clear the token.
- Components never `console.error` on their own — they read error state from the hook.

```js
// Correct pattern in a hook
const deleteTask = async (id) => {
  setLoading(true);
  setError(null);
  try {
    await apiClient.delete(`/tasks/${id}`);
    setTasks(prev => prev.filter(t => t.id !== id));
  } catch (err) {
    setError(err.response?.data?.detail ?? 'Failed to delete task');
  } finally {
    setLoading(false);
  }
};
```

---

## Logging

### Backend

- Use Python's standard `logging` module — no `print()` calls in production code.
- Get a module-level logger: `logger = logging.getLogger(__name__)`.
- Log levels:
  - `DEBUG` — detailed internal state during development
  - `INFO` — significant lifecycle events (server start, user login)
  - `WARNING` — recoverable issues (rate limit hit, deprecated param used)
  - `ERROR` — exceptions and failures that need attention
- Log format must include timestamp, level, module, and message.

```python
# main.py — configure once at app startup
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
```

### Frontend

- Use `console.warn` and `console.error` only in development (`import.meta.env.DEV`).
- Never log JWT tokens, passwords, or PII to the console.
- Errors displayed to users come from React error state, not console output.

---

## General Rules (Both Sides)

- No magic numbers — extract to named constants.
- No commented-out code committed to `main`.
- All public functions/hooks have a one-line JSDoc / docstring describing purpose and params.
- Max line length: **100 characters** (Python), **100 characters** (JS/JSX).
- Imports are grouped and ordered:
  - **Python**: stdlib → third-party → local app imports (blank line between each group)
  - **JS/JSX**: external packages → internal absolute paths → relative paths → CSS

---

## Commit Message Format

```
<type>(task-<n>): <short imperative description>

Implements <task title> as per .kiro/specs/task-manager-app/tasks.md
Closes #<github-issue-number>
```

Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`

Examples:
- `feat(task-4): add JWT auth service`
- `fix(task-7): return 403 before 404 on task delete`
- `test(task-5): add property tests for task creation`
