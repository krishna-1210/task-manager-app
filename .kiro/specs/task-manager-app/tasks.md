# Implementation Plan: Task Manager App

## Overview

Implement a two-tier Task Manager web application with a FastAPI backend and a React (Vite) frontend. The backend uses PostgreSQL with Flyway versioned migrations, JWT authentication, in-memory rate limiting, and SQLAlchemy for queries only. The frontend uses React Context API + `useReducer` for auth state, a `useTasks` hook for task state, Axios interceptors for 401 handling, and `react-router-dom` for routing. Implementation proceeds backend-first, then frontend, with property-based and unit tests as sub-tasks throughout.

---

## Tasks

- [ ] 1. Set up backend project structure and configuration
  - [ ] 1.1 Scaffold backend directory layout and install dependencies
    - Create `tm-backend/` with the following structure: `app/main.py`, `app/routers/`, `app/services/`, `app/db/` (`database.py`, `models.py`, `migrations/`), `tests/` (`conftest.py`, `unit/`, `integration/`, `property/`)
    - Create `tm-backend/requirements.txt` pinning: `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `psycopg2-binary`, `python-jose[cryptography]`, `passlib[bcrypt]`, `slowapi`, `python-dotenv`, `pytest`, `pytest-asyncio`, `httpx`, `hypothesis`
    - Create `tm-backend/.env.example` with `DATABASE_URL`, `SECRET_KEY`, `DB_USER`, `DB_PASSWORD` placeholders
    - _Requirements: 7.1, 7.2, 8.1_

  - [ ] 1.2 Create SQLAlchemy database layer (`app/db/database.py`)
    - Define `engine` from `DATABASE_URL` env var using `postgresql+psycopg2://` scheme
    - Define `SessionLocal` and `get_db` dependency
    - Do **not** call `Base.metadata.create_all` anywhere
    - _Requirements: 7.1, 7.2_

  - [ ] 1.3 Create ORM models (`app/db/models.py`)
    - Define `User` model: `id`, `username` (String 150, unique), `hashed_password` (String 255), `tasks` relationship with `cascade="all, delete-orphan"`
    - Define `Task` model: `id`, `user_id` (FK to users.id, indexed), `title` (String 255), `description` (Text, nullable), `status` (String, default `"pending"`), `created_at`, `updated_at` (DateTime with `func.now()`)
    - Use `Mapped` / `mapped_column` declarative style; models are query-only (no DDL)
    - _Requirements: 7.1, 7.2_

  - [ ] 1.4 Write Flyway SQL migration scripts
    - Create `app/db/migrations/V1__create_users_table.sql`: `CREATE TABLE users` with `id SERIAL PRIMARY KEY`, `username VARCHAR(150) UNIQUE NOT NULL`, `hashed_password VARCHAR(255) NOT NULL`
    - Create `app/db/migrations/V2__create_tasks_table.sql`: `CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'done')` and `CREATE TABLE tasks` with all required columns, FK to `users.id`, and `status` using the ENUM type
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 2. Implement application entry point with Flyway startup lifecycle
  - [ ] 2.1 Implement `app/main.py` with Flyway migration lifespan
    - Create FastAPI app with a `lifespan` async context manager
    - Inside `lifespan`, implement `run_migrations_with_retry()`: loop calling `subprocess.run(["flyway", ...])` with `DB_USER`, `DB_PASSWORD`, and `DATABASE_URL`-derived JDBC URL; on `CalledProcessError`, log stderr and `await asyncio.sleep(30)`; only `yield` (start HTTP server) after success
    - Attach CORS middleware; include `auth` and `tasks` routers
    - _Requirements: 7.3_

  - [ ]* 2.2 Write integration test for startup migration retry behavior
    - Test that the HTTP server does not accept requests until Flyway succeeds
    - Test that a Flyway failure is logged with sufficient context
    - _Requirements: 7.3_

- [ ] 3. Implement Pydantic schemas
  - [ ] 3.1 Create `app/schemas.py` with all API schemas
    - `TokenResponse(BaseModel)`: `access_token: str`, `token_type: str = "bearer"`
    - `TokenPayload(BaseModel)`: `sub: str`, `exp: datetime`
    - `TaskCreate(BaseModel)`: `title: str = Field(min_length=1, max_length=255)`, `description: str | None = Field(default=None, max_length=1000)`
    - `TaskStatusUpdate(BaseModel)`: `status: Literal["pending", "in_progress", "done"]`
    - `TaskResponse(BaseModel)` with `model_config = ConfigDict(from_attributes=True)`: `id`, `title`, `description`, `status`, `created_at`, `updated_at`
    - _Requirements: 4.1, 4.2, 4.8, 4.9, 5.1, 5.3, 8.1–8.5_

- [ ] 4. Implement auth service with JWT and lockout logic
  - [ ] 4.1 Implement `app/services/auth_service.py`
    - Password hashing / verification with `passlib` (bcrypt)
    - JWT issuance via `python-jose`: `create_access_token(user_id)` sets `sub=str(user_id)`, `exp=now+3600s`
    - JWT decoding: `decode_token(token)` raises `HTTPException(401)` for expired or malformed tokens
    - In-memory `_lockout_store: dict[str, LockoutRecord]` with `@dataclass LockoutRecord(consecutive_failures, window_start, locked_until)`
    - `check_lockout(username)` → raises `HTTPException(429)` if locked and `now < locked_until`
    - `record_failure(username)`: increment counter; reset window if >10 min old; set `locked_until = now+900` when `consecutive_failures >= 5`
    - `clear_lockout(username)`: delete record from store
    - Implement Requirement 1.7: on incoming request, if locked but credentials are valid, clear lockout and return token
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7_

  - [ ]* 4.2 Write property test for token expiry (Property 1)
    - **Property 1: Token expiry is always 1 hour**
    - **Validates: Requirements 1.1**
    - Use `hypothesis` `@given(st.text(min_size=1), st.text(min_size=1))` to generate username/password pairs; decode the returned JWT and assert `exp - iat == 3600`

  - [ ]* 4.3 Write property test for invalid credentials always return 401 (Property 2)
    - **Property 2: Invalid credentials always return 401**
    - **Validates: Requirements 1.2**
    - Generate arbitrary (username, password) pairs that do not match any registered account; assert 401 and no token in response

  - [ ]* 4.4 Write property test for account lockout after 5 consecutive failures (Property 4)
    - **Property 4: Account lockout after 5 consecutive failures**
    - **Validates: Requirements 1.6, 1.7**
    - Generate a registered account; simulate exactly 5 consecutive bad-credential attempts; assert 6th attempt returns 429; assert that a 6th attempt with valid credentials returns 200 and clears lockout

  - [ ]* 4.5 Write unit tests for auth service
    - Test `create_access_token` produces a decodable JWT with correct `sub` and 3600s window
    - Test `record_failure` resets window when >10 min old
    - Test `check_lockout` passes before 5 failures and blocks on 5th
    - Test `clear_lockout` removes record from store
    - _Requirements: 1.1, 1.6, 1.7_

- [ ] 5. Implement auth router
  - [ ] 5.1 Implement `app/routers/auth.py` — `POST /auth/login`
    - Accept `OAuth2PasswordRequestForm` (`application/x-www-form-urlencoded`)
    - Call `check_lockout`; verify credentials; on failure call `record_failure` and raise `HTTPException(401)`; on success call `clear_lockout` and return `TokenResponse`
    - Complete within 500ms constraint (no blocking I/O outside DB; bcrypt cost factor ≤ 12)
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 8.1_

  - [ ] 5.2 Implement `get_current_user` FastAPI dependency in `app/dependencies.py`
    - Extract Bearer token from `Authorization` header; call `decode_token`; load user from DB; raise `HTTPException(401)` if user not found or token invalid/expired
    - _Requirements: 2.2, 2.3_

  - [ ]* 5.3 Write property test for unvalidated tokens returning 401 (Property 5)
    - **Property 5: Unvalidated tokens always return 401 from protected endpoints**
    - **Validates: Requirements 2.2, 2.3**
    - Use `hypothesis` to generate malformed token strings and expired JWTs; assert every protected endpoint returns 401

  - [ ]* 5.4 Write integration tests for auth endpoints
    - Test valid login returns 200 + token (`access_token`, `token_type`)
    - Test invalid credentials return 401 with error message
    - Test 5th consecutive failure triggers 429; valid credentials after lockout return 200
    - Test missing token on protected endpoint returns 401
    - Test expired token on protected endpoint returns 401
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 2.2, 2.3, 8.1_

- [ ] 6. Checkpoint — backend auth layer complete
  - Ensure all auth-related tests pass. Ask the user if any questions arise before proceeding.

- [ ] 7. Implement task service
  - [ ] 7.1 Implement `app/services/task_service.py`
    - `get_tasks(db, user_id)` → list of `Task` for that user
    - `create_task(db, user_id, data: TaskCreate)` → `Task` with `status="pending"`, associates `user_id` from token
    - `update_task_status(db, task_id, user_id, new_status)` → checks ownership first (raises `HTTPException(403)` before existence check); then checks existence (raises `HTTPException(404)`); persists new status; returns updated `Task`
    - `delete_task(db, task_id, user_id)` → checks ownership first (raises `HTTPException(403)` before existence check regardless of whether task exists); then deletes; returns `None`
    - DB write failures propagate as `HTTPException(500)` with structured log
    - _Requirements: 4.1, 4.4, 5.1, 5.2, 5.6, 5.7, 6.1, 6.2, 6.3, 7.4_

  - [ ]* 7.2 Write property test for valid task creation returns 201 with status pending (Property 11)
    - **Property 11: Valid task creation always returns 201 with status pending**
    - **Validates: Requirements 4.1, 4.4**
    - `@given(title=st.text(min_size=1, max_size=255).filter(lambda t: t.strip()), description=st.one_of(st.none(), st.text(max_size=1000)))` — assert 201, `status == "pending"`, `user_id == authenticated user id`

  - [ ]* 7.3 Write property test for status updates on owned tasks (Property 14)
    - **Property 14: Status updates on owned tasks always persist correctly**
    - **Validates: Requirements 5.1, 5.7**
    - Generate any task owned by the user and any target status in `{pending, in_progress, done}`; assert 200 and returned status equals target — regardless of prior status

  - [ ]* 7.4 Write property test for status updates on unowned tasks return 403 (Property 15)
    - **Property 15: Status updates on unowned tasks always return 403**
    - **Validates: Requirements 5.2**
    - Generate a task owned by user A; attempt PATCH as user B; assert 403

  - [ ]* 7.5 Write property test for ownership check precedes existence check on delete (Property 19)
    - **Property 19: Ownership check precedes existence check on delete**
    - **Validates: Requirements 6.2**
    - For any task ID (including non-existent IDs) and any user who is not the owner, assert `DELETE /tasks/{id}` returns 403 and never 404

  - [ ]* 7.6 Write property test for deleting an owned task returns 204 and removes from storage (Property 18)
    - **Property 18: Deleting an owned task returns 204 and removes it from storage**
    - **Validates: Requirements 6.1**
    - Delete a task owned by the user; assert 204; subsequent `GET /tasks` does not contain the deleted task

  - [ ]* 7.7 Write unit tests for task service
    - Test `create_task` associates correct `user_id` and sets `status="pending"`
    - Test `update_task_status` raises 403 before 404 for non-owner
    - Test `delete_task` raises 403 before 404 for non-owner
    - Test all status transitions succeed (all 9 combinations of from/to)
    - _Requirements: 4.4, 5.1, 5.2, 5.6, 5.7, 6.1, 6.2, 6.3_

- [ ] 8. Implement tasks router
  - [ ] 8.1 Implement `app/routers/tasks.py` — all four task endpoints
    - `GET /tasks`: return `list[TaskResponse]` for current user; 401 if unauthenticated
    - `POST /tasks`: validate `TaskCreate` (422 on failure); call `task_service.create_task`; return `TaskResponse` with 201
    - `PATCH /tasks/{task_id}`: validate `TaskStatusUpdate` (422 on invalid status); call `task_service.update_task_status`; return `TaskResponse` with 200
    - `DELETE /tasks/{task_id}`: call `task_service.delete_task`; return 204 No Content
    - All endpoints use `get_current_user` dependency
    - _Requirements: 4.1, 4.2, 4.8, 4.9, 5.1, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 8.2–8.5_

  - [ ]* 8.2 Write integration tests for task endpoints
    - Test `GET /tasks` returns empty array for new user; returns all tasks for authenticated user
    - Test `POST /tasks` with valid title → 201 + pending status; empty title → 422; title >255 → 422; description >1000 → 422
    - Test `PATCH /tasks/{id}` valid status → 200; invalid status → 422; non-existent id → 404; other user's task → 403
    - Test `DELETE /tasks/{id}` owned task → 204; non-existent → 404; other user's task → 403
    - Test 401 on all endpoints with missing/invalid/expired token
    - _Requirements: 4.1, 4.2, 4.8, 4.9, 5.1, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 8.2–8.5_

  - [ ] 8.3 Verify OpenAPI schema is served at `/docs`
    - Add a test asserting `GET /docs` returns 200 and `GET /openapi.json` returns a valid schema
    - _Requirements: 8.6_

- [ ] 9. Checkpoint — backend tasks layer complete
  - Ensure all backend tests pass (`pytest`). Ask the user if any questions arise before proceeding.

- [ ] 10. Set up frontend project structure and configuration
  - [ ] 10.1 Scaffold frontend with Vite and install dependencies
    - Create `tm-frontend/` with Vite React template
    - Install (pinned): `react-router-dom`, `axios`
    - Install dev: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `msw`, `fast-check`, `jsdom`
    - Create `vite.config.js` with `server.proxy` mapping `/api` → `http://localhost:8000`
    - Create directory structure: `src/context/`, `src/api/`, `src/pages/`, `src/components/`, `src/hooks/`, `src/__tests__/property/`
    - _Requirements: 8.7_

  - [ ] 10.2 Create frontend type definitions and constants
    - Define `Task` interface (id, title, description, status, created_at, updated_at) and `AuthState` interface in `src/types.js` or as JSDoc
    - Define `STATUS_VALUES = ['pending', 'in_progress', 'done']` constant
    - _Requirements: 5.5_

- [ ] 11. Implement auth context and Axios client
  - [ ] 11.1 Implement `src/context/AuthContext.jsx`
    - Store token in React state (in-memory only — no localStorage)
    - Expose `token`, `login(token)`, `logout()` via context
    - Wrap app in `AuthProvider`; export `useAuth` hook
    - _Requirements: 1.4, 2.5_

  - [ ] 11.2 Implement `src/api/client.js` — Axios instance with interceptors
    - Create Axios instance with `baseURL: '/api'`
    - Request interceptor: attach `Authorization: Bearer <token>` from `AuthContext` if token present
    - Response interceptor: on 401 response, call `logout()` and redirect to `/login`
    - _Requirements: 2.4, 8.7_

  - [ ]* 11.3 Write property test for frontend 401 responses triggering logout (Property 7)
    - **Property 7: Frontend 401 responses trigger logout and redirect**
    - **Validates: Requirements 2.4**
    - Use `fast-check` to generate arbitrary API endpoint paths; mock server to return 401; assert token cleared and redirect to `/login` occurs
    - _Requirements: 2.4_

  - [ ]* 11.4 Write unit tests for AuthContext and Axios client
    - Test `login(token)` stores token; `logout()` clears token
    - Test request interceptor attaches Bearer header when token present; omits header when null
    - Test 401 response interceptor calls `logout()` and triggers redirect
    - _Requirements: 1.4, 2.4, 2.5_

- [ ] 12. Implement routing and protected route
  - [ ] 12.1 Implement `src/components/ProtectedRoute.jsx` and `src/App.jsx` routes
    - `ProtectedRoute`: read `token` from `useAuth`; if falsy, `<Navigate to="/login" replace />`; otherwise render `children`
    - `App.jsx`: define routes — `/login` → `LoginPage`, `/dashboard` → `ProtectedRoute` wrapping `DashboardPage`; default redirect `/` → `/login`
    - _Requirements: 2.1_

  - [ ]* 12.2 Write property test for unauthenticated routes redirect to login (Property 6)
    - **Property 6: Unauthenticated frontend routes redirect to login**
    - **Validates: Requirements 2.1**
    - Use `fast-check` to generate protected route paths; render without token in context; assert redirect to `/login` before protected content renders
    - _Requirements: 2.1_

  - [ ]* 12.3 Write unit tests for ProtectedRoute
    - Test renders children when token present
    - Test redirects to `/login` when token is null
    - Test logout action clears token and redirects to `/login`
    - _Requirements: 2.1, 2.5_

- [ ] 13. Implement Login page
  - [ ] 13.1 Implement `src/pages/LoginPage.jsx`
    - Render form with `username` and `password` fields and a submit button
    - Client-side validation: if username or password is empty/whitespace, display field-level error on the offending field(s) only and do not submit
    - On submit: call `POST /api/auth/login` with `application/x-www-form-urlencoded`; on 200, call `login(token)` and navigate to `/dashboard`; on 401, display "Invalid username or password" beneath the form; on 429, display lockout duration message and disable submit button
    - _Requirements: 1.2, 1.4, 1.5, 1.6_

  - [ ]* 13.2 Write property test for login form rejecting incomplete submissions (Property 3)
    - **Property 3: Frontend login form rejects incomplete submissions**
    - **Validates: Requirements 1.5**
    - Use `fast-check` to generate (username, password) pairs where at least one is empty or whitespace; assert field-level error shown and zero network requests issued
    - _Requirements: 1.5_

  - [ ]* 13.3 Write unit tests for LoginPage
    - Test empty username shows field error, no submit
    - Test empty password shows field error, no submit
    - Test both fields valid → form submits to `/auth/login`
    - Test 401 response → error message displayed beneath form
    - Test 429 response → lockout message displayed, submit button disabled
    - Test successful login calls `login(token)` and navigates to `/dashboard`
    - _Requirements: 1.2, 1.4, 1.5, 1.6_

- [ ] 14. Implement `useTasks` hook
  - [ ] 14.1 Implement `src/hooks/useTasks.js`
    - State: `tasks` (full array), `isLoading`, `error`
    - `fetchTasks()`: `GET /api/tasks`; on success set tasks; on failure set `error`
    - `createTask(data)`: optimistic prepend to list; `POST /api/tasks`; on error revert list and set per-form error
    - `updateTaskStatus(id, status)`: **not** optimistic — send `PATCH /api/tasks/{id}`; on 200 update list within 500ms; start `setTimeout(500ms)` at moment 200 received — if state update hasn't fired by then, set per-task error indicator; on non-200 set per-task error and do not update status
    - `deleteTask(id)`: `DELETE /api/tasks/{id}`; on 204 remove task from list; on error set per-task error
    - Expose `tasks` (capped slice of first 100 for rendering), `hasMore` (`tasks.length > 100`), `statusCounts` (`{pending, in_progress, done}` derived from full array)
    - _Requirements: 3.1, 3.4, 3.5, 3.6, 4.5, 5.4, 5.8, 6.1, 6.4_

  - [ ]* 14.2 Write unit tests for useTasks hook
    - Test `fetchTasks` sets tasks on success; sets error on failure; retry clears error on success
    - Test `createTask` prepends task optimistically; reverts on API error
    - Test `updateTaskStatus` waits for 200 before updating; sets error indicator if 500ms guard fires
    - Test `deleteTask` removes task from list on 204; keeps task on error
    - Test `hasMore` is true when >100 tasks returned; `statusCounts` sums correctly
    - _Requirements: 3.4, 3.5, 3.6, 4.5, 5.4, 5.8, 6.4_

- [ ] 15. Implement task components
  - [ ] 15.1 Implement `src/components/StatusSummary.jsx`
    - Accept `tasks` prop (full array); derive and display counts for `pending`, `in_progress`, `done`
    - Add `data-testid="count-pending"`, `data-testid="count-in_progress"`, `data-testid="count-done"` attributes
    - Display 0 for each group when task list is empty
    - _Requirements: 3.3, 3.4_

  - [ ]* 15.2 Write property test for status summary counts (Property 9)
    - **Property 9: Status summary counts accurately reflect task list state**
    - **Validates: Requirements 3.4**
    - Use `fast-check` `fc.array(fc.record({id, title, status: fc.constantFrom(...), ...}))` with `numRuns: 100`; assert each `data-testid` count matches filtered length and total equals task count

  - [ ] 15.3 Implement `src/components/TaskStatusBadge.jsx`
    - Accept `status` prop; render a styled pill with the status label
    - _Requirements: 3.2_

  - [ ] 15.4 Implement `src/components/DeleteConfirmDialog.jsx`
    - Accept `isOpen`, `onConfirm`, `onCancel` props
    - Render modal with "Confirm" and "Cancel" buttons
    - Do not submit delete request from within this component — delegate to caller via `onConfirm`
    - _Requirements: 6.5, 6.6_

  - [ ] 15.5 Implement `src/components/TaskItem.jsx`
    - Accept `task`, `onStatusChange(id, status)`, `onDeleteRequest(id)` props
    - Display `task.title`, `TaskStatusBadge` with current status, and `created_at` formatted date
    - Render three status control buttons (pending, in_progress, done) — one per `STATUS_VALUES`
    - Show per-task error indicator when `task.hasError` is set
    - On delete icon/button click: open `DeleteConfirmDialog`; on confirm call `onDeleteRequest`; on cancel dismiss
    - _Requirements: 3.2, 5.4, 5.5, 5.8, 6.5, 6.6_

  - [ ] 15.6 Implement `src/components/TaskCreateForm.jsx`
    - Controlled form with `title` (required) and `description` (optional) fields
    - Client-side validation: empty/whitespace title → field-level error, no submit; title >255 chars → field-level error with 255-char limit message, no submit
    - On valid submit: call `createTask(data)` from `useTasks`; clear form on success; show inline error on API failure
    - _Requirements: 4.3, 4.6, 4.7_

  - [ ] 15.7 Implement `src/components/TaskList.jsx`
    - Accept `tasks` (capped 100), `hasMore`, `onStatusChange`, `onDeleteRequest` props
    - Render a `TaskItem` for each task
    - When `hasMore` is true, render a disclosure indicator ("Showing 100 of N tasks")
    - _Requirements: 3.2, 3.6_

- [ ] 16. Implement Dashboard page
  - [ ] 16.1 Implement `src/pages/DashboardPage.jsx`
    - On mount, call `fetchTasks()`
    - Compose `StatusSummary` (pass full task array), `TaskCreateForm`, `TaskList`
    - Show loading state while `isLoading` is true
    - Show error banner with retry button when `error` is set; on retry call `fetchTasks()` again; on success clear error
    - Pass `onStatusChange` and `onDeleteRequest` handlers from `useTasks` down to `TaskList`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 16.2 Write property test for every rendered task item contains required fields (Property 8)
    - **Property 8: Every rendered task item contains title, status, and creation date**
    - **Validates: Requirements 3.2**
    - Use `fast-check` to generate non-empty task arrays; render `TaskList`; assert every rendered item displays title, status badge, and `created_at`

  - [ ]* 16.3 Write property test for task list capped at 100 items (Property 10)
    - **Property 10: Task list is capped at 100 displayed items**
    - **Validates: Requirements 3.6**
    - Generate task arrays of length > 100; render `TaskList`; assert exactly 100 `TaskItem` components rendered and disclosure indicator present

  - [ ]* 16.4 Write unit tests for DashboardPage
    - Test empty task list shows empty-state message and zero counts for each status group
    - Test task list renders all returned tasks up to 100
    - Test error banner shown on fetch failure; retry button re-issues fetch; success clears banner
    - _Requirements: 3.1, 3.3, 3.5_

- [ ] 17. Implement remaining frontend property and unit tests
  - [ ]* 17.1 Write property test for new tasks prepended to the task list (Property 13)
    - **Property 13: New tasks are prepended to the task list**
    - **Validates: Requirements 4.5**
    - Use `fast-check` to generate an existing task list state and a new task; mock `POST /tasks` to return 201; assert new task appears at index 0 without full reload

  - [ ]* 17.2 Write property test for status update UI reflects new status (Property 16)
    - **Property 16: Status update UI reflects new status after 200 response**
    - **Validates: Requirements 5.4**
    - Use `fast-check` to generate task + target status; mock `PATCH /tasks/{id}` to return 200; assert `TaskItem` displays new status within 500ms of response receipt

  - [ ]* 17.3 Write property test for all three status controls present on every task item (Property 17)
    - **Property 17: All three status controls are present on every task item**
    - **Validates: Requirements 5.5**
    - Use `fast-check` to generate task records with any status; render `TaskItem`; assert buttons/controls for all three statuses are present

  - [ ]* 17.4 Write property test for delete confirmation prompt always appears (Property 21)
    - **Property 21: Delete confirmation prompt always appears before request submission**
    - **Validates: Requirements 6.5**
    - Use `fast-check` to generate task items; simulate click on delete; assert `DeleteConfirmDialog` is displayed and no `DELETE` network request is issued until confirm is clicked

  - [ ]* 17.5 Write property test for deleted tasks removed from frontend list (Property 20)
    - **Property 20: Deleted tasks are removed from the frontend list**
    - **Validates: Requirements 6.4**
    - Generate a task list containing task T; mock `DELETE /tasks/T.id` to return 204; assert `TaskItem` for T no longer rendered

  - [ ]* 17.6 Write property test for frontend task title validation (Property 12)
    - **Property 12: Frontend task title validation prevents invalid submissions**
    - **Validates: Requirements 4.3, 4.7**
    - Use `fast-check` to generate titles that are empty, whitespace-only, or >255 chars; assert field-level error shown and no `POST /tasks` request issued

  - [ ]* 17.7 Write unit tests for TaskItem
    - Test renders title, status badge, and created_at date
    - Test three status buttons present for any task status
    - Test delete button opens `DeleteConfirmDialog`; cancel dismisses without request; confirm calls `onDeleteRequest`
    - Test per-task error indicator shown when `task.hasError` is set
    - _Requirements: 3.2, 5.5, 6.5, 6.6_

  - [ ]* 17.8 Write unit tests for TaskCreateForm
    - Test empty title shows field error, no submit
    - Test title exceeding 255 chars shows 255-char limit error, no submit
    - Test valid title submits; clears form on success
    - Test API failure shows inline error, task not added to list
    - _Requirements: 4.3, 4.6, 4.7_

- [ ] 18. Final checkpoint — all tests pass
  - Run `pytest` (backend) and `vitest --run` (frontend). Ensure all tests pass. Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for full traceability to requirements.md
- Property tests reference their property number from design.md and carry comments: `// Feature: task-manager-app, Property N: <property_text>` (frontend) or `# Feature: task-manager-app, Property N: <property_text>` (backend)
- Unit and property tests are complementary — both are included where the design defines correctness properties
- `SQLAlchemy Base.metadata.create_all` must **never** be called; all schema changes go through Flyway migrations
- Backend property tests use `hypothesis` with `@settings(max_examples=100)` minimum
- Frontend property tests use `fast-check` with `{ numRuns: 100 }` minimum
- Run frontend tests with `vitest --run` (single execution, not watch mode)
- Run backend tests with `pytest` (standard single execution)
- The `tm-backend/.env` file (copied from `.env.example`) must be present with valid `DATABASE_URL`, `SECRET_KEY`, `DB_USER`, `DB_PASSWORD` before running integration tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "3.1", "10.1", "10.2"] },
    { "id": 2, "tasks": ["4.1", "2.2"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "4.5", "5.1", "5.2"] },
    { "id": 4, "tasks": ["5.3", "5.4", "7.1", "11.1", "11.2"] },
    { "id": 5, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "8.1", "11.3", "11.4", "12.1"] },
    { "id": 6, "tasks": ["8.2", "8.3", "12.2", "12.3", "13.1"] },
    { "id": 7, "tasks": ["13.2", "13.3", "14.1"] },
    { "id": 8, "tasks": ["14.2", "15.1", "15.3", "15.4"] },
    { "id": 9, "tasks": ["15.2", "15.5", "15.6", "15.7"] },
    { "id": 10, "tasks": ["16.1", "17.6", "17.7", "17.8"] },
    { "id": 11, "tasks": ["16.2", "16.3", "16.4", "17.1", "17.2", "17.3", "17.4", "17.5"] }
  ]
}
```
