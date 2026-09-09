# Design Document: Task Manager App

## Overview

The Task Manager is a two-tier web application composed of a React single-page application (SPA) frontend and a FastAPI backend. Authenticated users can create, update the status of, and delete their personal tasks through a dashboard interface.

The backend is the authoritative layer for all data and security decisions. The frontend provides a responsive UI that mirrors backend state optimistically where specified (e.g., prepending new tasks, removing deleted tasks) and makes no security assumptions on its own. JWT-based authentication ties the two tiers together: the frontend acquires a short-lived Bearer token on login and includes it in every subsequent API request.

### Key Design Decisions

- **PostgreSQL as the database**: PostgreSQL is chosen for its native `ENUM` type support, robust ACID guarantees, and broad ecosystem compatibility. It runs as a separate process (or container), which is appropriate for a production-ready deployment and removes the concurrency limitations of a file-based database.
- **Flyway for schema management**: DDL is handled exclusively by Flyway versioned SQL migration scripts (`V1__`, `V2__`, …). SQLAlchemy is retained for session management and query execution but is never used for DDL (`Base.metadata.create_all` is not called). This gives explicit, auditable control over schema evolution and avoids the implicit schema-drift risk of ORM-managed DDL. Flyway connects via the PostgreSQL JDBC URL format: `jdbc:postgresql://<host>:<port>/<dbname>`.
- **python-jose + passlib for auth**: Industry-standard Python JWT and password hashing libraries; well-maintained and compatible with FastAPI's security utilities.
- **slowapi for rate limiting**: Thin wrapper around `limits` that integrates natively with FastAPI/Starlette middleware without requiring Redis for the stated load levels.
- **React Context API over Zustand**: The application's state surface (auth token + task list) is shallow enough that a custom Context + `useReducer` pattern avoids adding a state management dependency.
- **Vite proxy for local development**: The Vite dev server proxies `/api` to `localhost:8000`, removing CORS concerns during development and keeping the production deployment model simple (reverse proxy or separate origin with CORS headers).

---

## Architecture

```mermaid
graph TD
    subgraph Browser
        A[React SPA<br/>Vite / React 19]
    end

    subgraph Startup
        FW[Flyway<br/>migrate]
    end

    subgraph Backend Process
        B[FastAPI App]
        C[Auth Router<br/>POST /auth/login]
        D[Tasks Router<br/>GET / POST / PATCH / DELETE /tasks]
        E[Auth Service<br/>JWT • Rate Limiter]
        F[Task Service<br/>CRUD • Ownership]
        G[Database Layer<br/>SQLAlchemy + PostgreSQL]
    end

    H[(PostgreSQL<br/>taskmanager)]

    FW -- "applies versioned\nSQL migrations" --> H
    FW -- "success → HTTP\nserver starts" --> B
    A -- "Bearer token in\nAuthorization header" --> B
    B --> C
    B --> D
    C --> E
    D --> F
    E --> G
    F --> G
    G --> H
```

### Request Lifecycle

1. User submits login form → `POST /auth/login` → Auth Service validates credentials, checks lockout state, issues JWT → Frontend stores token in memory.
2. Subsequent requests include `Authorization: Bearer <token>` → FastAPI dependency `get_current_user` decodes and validates the JWT → Request proceeds to the appropriate service.
3. Any 401 response from the backend → Frontend clears token and redirects to `/login`.

---

## Components and Interfaces

### Backend Components

#### `app/main.py` — Application Entry Point

Bootstraps FastAPI, registers routers, attaches CORS middleware, initialises the database on startup with a retry loop.

```python
# Startup sequence (pseudo-code)
async def lifespan(app):
    while not migrations_ready:
        try:
            result = subprocess.run(
                ["flyway",
                 "-url=jdbc:postgresql://localhost:5432/taskmanager",
                 "-user=${DB_USER}",
                 "-password=${DB_PASSWORD}",
                 "-locations=filesystem:./app/db/migrations", "migrate"],
                capture_output=True, check=True
            )
            migrations_ready = True
        except subprocess.CalledProcessError as e:
            log.error(f"Flyway migration failed: {e.stderr}. Retrying in 30s.")
            await asyncio.sleep(30)
    yield
```

#### `app/routers/auth.py` — Authentication Router

| Endpoint | Method | Description |
|---|---|---|
| `/auth/login` | POST | Accepts `application/x-www-form-urlencoded` (OAuth2PasswordRequestForm). Validates credentials, enforces lockout, returns JWT. |

#### `app/routers/tasks.py` — Tasks Router

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/tasks` | GET | Required | Returns all tasks owned by the current user. |
| `/tasks` | POST | Required | Creates a new task; initialises status to `pending`. |
| `/tasks/{task_id}` | PATCH | Required | Updates the status of a task the current user owns. |
| `/tasks/{task_id}` | DELETE | Required | Deletes a task the current user owns; ownership checked before existence. |

#### `app/services/auth_service.py` — Auth Business Logic

Responsibilities:
- Password verification via `passlib` (bcrypt)
- JWT issuance via `python-jose` with 1-hour expiry
- Lockout tracking: maintains a per-account in-memory store of `(consecutive_failures, window_start)`. Resets on successful login. Persistent across requests within the process lifetime; does not survive restarts (acceptable for this scope).
- JWT decoding and validation for the `get_current_user` FastAPI dependency

#### `app/services/task_service.py` — Task Business Logic

Responsibilities:
- Create, retrieve, update, delete tasks with user-scoped queries
- Ownership enforcement: tasks router passes `current_user.id` to all service calls; service raises `HTTPException(403)` before any existence check on update/delete

#### `app/db/` — Database Layer

- `database.py`: SQLAlchemy engine, `SessionLocal`, `get_db` dependency. The connection string uses the `postgresql+psycopg2://` scheme (via the `psycopg2` driver) and is read from the `DATABASE_URL` environment variable (e.g. `postgresql+psycopg2://user:password@localhost:5432/taskmanager`).
- `models.py`: ORM models (see Data Models) — used for querying only, not DDL
- `migrations/`: Flyway versioned SQL migration scripts
  - `V1__create_users_table.sql`: creates the `users` table
  - `V2__create_tasks_table.sql`: creates the `tasks` table with the foreign key to `users`

Flyway is invoked as a subprocess during the startup lifespan (see `app/main.py`). SQLAlchemy's `Base.metadata.create_all` is **not** called anywhere in the application.

### Frontend Components

```
src/
├── main.jsx                  # ReactDOM.createRoot, router wrapper
├── App.jsx                   # Route definitions
├── context/
│   └── AuthContext.jsx       # Token storage, login/logout actions
├── api/
│   └── client.js             # Axios instance with interceptors
├── pages/
│   ├── LoginPage.jsx         # Login form
│   └── DashboardPage.jsx     # Task dashboard
├── components/
│   ├── ProtectedRoute.jsx    # Redirect-if-unauthenticated HOC
│   ├── TaskList.jsx          # Renders the task list
│   ├── TaskItem.jsx          # Single task row: title, status, date, controls
│   ├── TaskStatusBadge.jsx   # Status pill component
│   ├── StatusSummary.jsx     # Counts grouped by status
│   ├── TaskCreateForm.jsx    # Inline create form
│   └── DeleteConfirmDialog.jsx # Confirmation modal
└── hooks/
    └── useTasks.js           # Task state management hook
```

#### `AuthContext.jsx`

Holds the token in React state (in-memory). Provides `login(token)` and `logout()`. No localStorage — token is lost on page refresh, prompting re-login (acceptable per requirements: "memory or secure HTTP-only cookie"). Cookie support can be added later.

#### `api/client.js` — Axios Instance

```javascript
// Attaches Bearer token from AuthContext to every request
// Intercepts 401 responses and triggers logout()
const client = axios.create({ baseURL: '/api' });
client.interceptors.request.use(config => {
  const token = getToken(); // from AuthContext
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
client.interceptors.response.use(null, error => {
  if (error.response?.status === 401) logout();
  return Promise.reject(error);
});
```

#### `ProtectedRoute.jsx`

```jsx
// Wraps react-router-dom <Route> children
// Redirects to /login if no token present
const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
};
```

#### `useTasks.js` Hook

Manages task list state. Exposes:
- `tasks` — capped at 100 for display (full array retained for count accuracy)
- `hasMore` — `true` when server returned > 100 tasks
- `statusCounts` — `{ pending, in_progress, done }` derived from the full array
- `fetchTasks()`, `createTask(data)`, `updateTaskStatus(id, status)`, `deleteTask(id)`

All mutations apply optimistic local updates where specified (create prepends, delete removes) and revert on server error.

#### `DashboardPage.jsx`

Composes `StatusSummary`, `TaskCreateForm`, and `TaskList`. On mount calls `fetchTasks()`. Tracks `isLoading`, `error`, and `retryFn` state.

#### Status Update Timing (Requirement 5.4 / 5.8)

Status updates are not optimistic — the UI waits for the server 200 before updating. The `updateTaskStatus` function starts a `setTimeout` at 500ms; if the state update hasn't fired within that window (due to rendering delays or network latency exceeding the budget), an error indicator is set on that task item. In practice the network round-trip to a local/co-located server well under 500ms; this guard is a belt-and-suspenders compliance mechanism.

---

## Data Models

### Backend ORM Models

#### `User`

```python
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="owner", cascade="all, delete-orphan")
```

#### `Task`

```python
class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        # Maps to a PostgreSQL native ENUM type ('pending', 'in_progress', 'done').
        # The ENUM type and its values are created by Flyway migration (not by SQLAlchemy DDL).
        String,
        default="pending",
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    owner: Mapped["User"] = relationship("User", back_populates="tasks")
```

### API Schemas (Pydantic)

#### Auth

```python
# Response
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# JWT payload (not exposed)
class TokenPayload(BaseModel):
    sub: str        # user.id as string
    exp: datetime
```

#### Tasks

```python
# Create request
class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)

# Status update request
class TaskStatusUpdate(BaseModel):
    status: Literal["pending", "in_progress", "done"]

# Response
class TaskResponse(BaseModel):
    id: int
    title: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

### Frontend Data Shapes

```typescript
// Task (mirroring TaskResponse)
interface Task {
  id: number;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "done";
  created_at: string;   // ISO 8601
  updated_at: string;
}

// Auth context
interface AuthState {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}
```

### In-Memory Rate Limiter State (Auth Service)

```python
# Not persisted — lives in process memory
@dataclass
class LockoutRecord:
    consecutive_failures: int
    window_start: float       # time.monotonic()
    locked_until: float | None  # time.monotonic() or None

# Dict keyed by username
_lockout_store: dict[str, LockoutRecord] = {}
```

The lockout logic:
1. On failed auth: increment `consecutive_failures`. If `window_start` is older than 10 minutes, reset counter to 1 and update `window_start`. If `consecutive_failures >= 5`, set `locked_until = now + 900`.
2. On incoming request: if `locked_until` is set and `now < locked_until`, check credentials first; if valid, clear lockout and return token (Requirement 1.7); if invalid, return 429.
3. On successful auth: clear the lockout record entirely.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token expiry is always 1 hour

*For any* valid username and password pair, the JWT returned by `POST /auth/login` shall decode to a payload where `exp - iat` equals exactly 3600 seconds.

**Validates: Requirements 1.1**

---

### Property 2: Invalid credentials always return 401

*For any* (username, password) pair that does not match a registered account, the Auth_Service shall return a 401 status code and shall not include a token in the response.

**Validates: Requirements 1.2**

---

### Property 3: Frontend login form rejects incomplete submissions

*For any* combination of (username, password) where at least one field is empty or composed entirely of whitespace, the login form shall display a field-level error on every empty/whitespace field and shall issue zero network requests to the backend.

**Validates: Requirements 1.5**

---

### Property 4: Account lockout after 5 consecutive failures

*For any* registered account, after exactly 5 consecutive failed authentication attempts within a 10-minute window, the next authentication request (regardless of credential validity) shall receive a 429 response — unless the credentials are valid, in which case the lockout is cleared and a 200 with a token is returned.

**Validates: Requirements 1.6, 1.7**

---

### Property 5: Unvalidated tokens always return 401 from protected endpoints

*For any* protected backend endpoint (`GET /tasks`, `POST /tasks`, `PATCH /tasks/{id}`, `DELETE /tasks/{id}`), a request that carries either no Authorization header, a malformed token, or an expired token shall receive a 401 response.

**Validates: Requirements 2.2, 2.3**

---

### Property 6: Unauthenticated frontend routes redirect to login

*For any* protected frontend route (e.g., `/dashboard`), accessing that route when no token is held in AuthContext shall result in a client-side redirect to `/login` before rendering the protected content.

**Validates: Requirements 2.1**

---

### Property 7: Frontend 401 responses trigger logout and redirect

*For any* API response with status 401 received by the Axios client interceptor, the frontend shall clear the stored token and redirect the user to the login page.

**Validates: Requirements 2.4**

---

### Property 8: Every rendered task item contains title, status, and creation date

*For any* non-empty task list returned by the backend, every `TaskItem` rendered in the `TaskList` component shall display the task's title, its current status, and its `created_at` date.

**Validates: Requirements 3.2**

---

### Property 9: Status summary counts accurately reflect task list state

*For any* list of tasks returned by the backend, the `StatusSummary` component shall display counts where `count(status=pending) + count(status=in_progress) + count(status=done)` equals the total number of tasks, and each individual count equals the number of tasks with that status.

**Validates: Requirements 3.4**

---

### Property 10: Task list is capped at 100 displayed items

*For any* task list response containing N items where N > 100, the `TaskList` component shall render exactly 100 `TaskItem` components and shall render a disclosure indicator signalling that additional tasks exist.

**Validates: Requirements 3.6**

---

### Property 11: Valid task creation always returns 201 with status pending

*For any* title string of length 1–255 characters (and any description of length 0–1000 characters or absent), `POST /tasks` with a valid auth token shall return a 201 response whose body contains a task with `status = "pending"` and a `user_id` equal to the authenticated user's id.

**Validates: Requirements 4.1, 4.4**

---

### Property 12: Frontend task title validation prevents invalid submissions

*For any* title that is empty, composed entirely of whitespace, or exceeds 255 characters, the task creation form shall display a field-level validation error and shall not issue a `POST /tasks` request.

**Validates: Requirements 4.3, 4.7**

---

### Property 13: New tasks are prepended to the task list

*For any* existing task list state and any successfully created task, after the `POST /tasks` response resolves with 201, the new task shall appear at index 0 of the rendered task list without a full page reload.

**Validates: Requirements 4.5**

---

### Property 14: Status updates on owned tasks always persist correctly

*For any* authenticated user, any task they own, and any target status in `{pending, in_progress, done}` (including the task's current status), `PATCH /tasks/{id}` shall return 200 with the updated task reflecting the new status — regardless of the prior status value.

**Validates: Requirements 5.1, 5.7**

---

### Property 15: Status updates on unowned tasks always return 403

*For any* task and any authenticated user who is not the task's owner, `PATCH /tasks/{id}` shall return 403.

**Validates: Requirements 5.2**

---

### Property 16: Status update UI reflects new status after 200 response

*For any* task in the rendered task list and any valid status update that receives a 200 response, the `TaskItem` component shall display the new status after the response is received and before 500ms elapses from the moment the response was received.

**Validates: Requirements 5.4**

---

### Property 17: All three status controls are present on every task item

*For any* task rendered in the task list, the `TaskItem` component shall render controls that allow transitioning to each of the three statuses: `pending`, `in_progress`, and `done`.

**Validates: Requirements 5.5**

---

### Property 18: Deleting an owned task returns 204 and removes it from storage

*For any* task owned by the authenticated user, `DELETE /tasks/{id}` shall return 204 and a subsequent `GET /tasks` shall not include that task in its response.

**Validates: Requirements 6.1**

---

### Property 19: Ownership check precedes existence check on delete

*For any* task ID and any authenticated user who is not the task's owner (including task IDs that do not exist in the database), `DELETE /tasks/{id}` shall return 403 and shall never return 404 for a non-owner requester.

**Validates: Requirements 6.2**

---

### Property 20: Deleted tasks are removed from the frontend list

*For any* task list containing task T, after a successful `DELETE /tasks/T.id` (204 response), `TaskItem` for T shall no longer appear in the rendered task list.

**Validates: Requirements 6.4**

---

### Property 21: Delete confirmation prompt always appears before request submission

*For any* delete action initiated by the user on any task, a confirmation dialog shall be displayed containing both a confirm option and a cancel option, and no `DELETE` network request shall be issued until the user explicitly selects the confirm option.

**Validates: Requirements 6.5**

---

## Error Handling

### Backend Error Responses

All error responses follow a consistent JSON envelope:

```json
{
  "detail": "Human-readable message"
}
```

For validation errors (422), FastAPI's default Pydantic error format is used:

```json
{
  "detail": [
    { "loc": ["body", "title"], "msg": "String should have at most 255 characters", "type": "string_too_long" }
  ]
}
```

| Scenario | HTTP Status | Behaviour |
|---|---|---|
| Invalid credentials | 401 | `{"detail": "Incorrect username or password"}` |
| Account locked out | 429 | `{"detail": "Too many failed attempts. Try again in N minutes."}` |
| Missing / invalid token | 401 | `{"detail": "Not authenticated"}` |
| Expired token | 401 | `{"detail": "Token has expired"}` |
| Task not found (requester is owner) | 404 | `{"detail": "Task not found"}` |
| Task owned by different user | 403 | `{"detail": "Not authorized to modify this task"}` |
| Invalid status value | 422 | Pydantic validation error |
| Title/description too long | 422 | Pydantic validation error |
| Database write failure | 500 | `{"detail": "Internal server error"}` + structured log |
| Flyway migration failure on startup | N/A (server does not start) | Logged to stderr; retry every 30s |

### Frontend Error Handling

| Scenario | Behaviour |
|---|---|
| Login 401 | Display "Invalid username or password" beneath the form |
| Login 429 | Display lockout duration message; disable submit button |
| Any 401 from API | Axios interceptor triggers `logout()` → redirect to `/login` |
| `GET /tasks` failure | Show error banner with retry button |
| `POST /tasks` failure | Show inline error on the create form; task not added to list |
| `PATCH /tasks/{id}` failure | Show per-task error indicator; revert to previous status |
| `DELETE /tasks/{id}` failure | Show per-task error indicator; task remains in list |
| Status update >500ms render | Per-task error indicator set via `setTimeout` guard |

### Database Startup Retry (Flyway)

```python
MAX_RETRY_INTERVAL = 30  # seconds

async def run_migrations_with_retry():
    while True:
        try:
            subprocess.run(
                ["flyway",
                 "-url=jdbc:postgresql://localhost:5432/taskmanager",
                 "-user=${DB_USER}",
                 "-password=${DB_PASSWORD}",
                 "-locations=filesystem:./app/db/migrations", "migrate"],
                capture_output=True, check=True
            )
            logger.info("Flyway migrations applied successfully.")
            return
        except subprocess.CalledProcessError as e:
            logger.error(
                f"Flyway migration failed: {e.stderr.decode()}. "
                f"Retrying in {MAX_RETRY_INTERVAL}s."
            )
            await asyncio.sleep(MAX_RETRY_INTERVAL)
```

The HTTP server is not started (Uvicorn accept loop does not begin) until `run_migrations_with_retry()` returns successfully, implemented by placing the call inside the FastAPI `lifespan` context manager before `yield`. If Flyway exits with a non-zero code — for example because PostgreSQL is not yet reachable during container startup ordering, the `taskmanager` database does not exist, a previous migration checksum fails, or Flyway is not on `PATH` — the retry loop keeps the server offline and logs the Flyway stderr output for diagnosis. Connection credentials are read from the `DB_USER` and `DB_PASSWORD` environment variables.

---

## Testing Strategy

### Dual Testing Approach

Unit and integration tests verify concrete examples, edge cases, and API contracts. Property-based tests verify universal properties across randomly generated inputs. Both are complementary.

### Backend Testing

**Framework**: `pytest` with `httpx.AsyncClient` for endpoint tests, `pytest-asyncio` for async support.

**Property-Based Testing**: `hypothesis` library — minimum 100 examples per property test.

**Test layout**:
```
tm-backend/tests/
├── conftest.py               # test PostgreSQL database fixture (or testcontainers), test client, user factory
├── unit/
│   ├── test_auth_service.py  # token generation, lockout logic
│   └── test_task_service.py  # ownership enforcement, status transitions
├── integration/
│   ├── test_auth_endpoints.py
│   └── test_task_endpoints.py
└── property/
    ├── test_auth_properties.py
    └── test_task_properties.py
```

**Property test example (Hypothesis)**:
```python
from hypothesis import given, settings
from hypothesis import strategies as st

# Feature: task-manager-app, Property 11: Valid task creation always returns 201 with status pending
@given(
    title=st.text(min_size=1, max_size=255).filter(lambda t: t.strip()),
    description=st.one_of(st.none(), st.text(max_size=1000))
)
@settings(max_examples=100)
def test_valid_task_creation_returns_pending(client, auth_token, title, description):
    response = client.post(
        "/tasks",
        json={"title": title, "description": description},
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 201
    assert response.json()["status"] == "pending"
```

**Example tests** cover:
- Empty task list dashboard (Requirement 3.3)
- Logout clears token and redirects (Requirement 2.5)
- DB init failure triggers retry (Requirement 7.3)
- API contract verification for each endpoint (Requirement 8.1–8.7)

**Edge case tests** cover:
- Empty/missing title → 422 (Requirement 4.2)
- Title > 255 chars → 422 (Requirement 4.8)
- Description > 1000 chars → 422 (Requirement 4.9)
- Invalid status value → 422 (Requirement 5.3)
- Non-existent task ID → 404 (Requirements 5.6, 6.3)
- DB write failure → 500 with log (Requirement 7.4)
- Cancel on delete dialog → no request (Requirement 6.6)

### Frontend Testing

**Framework**: `vitest` + `@testing-library/react` for component tests, `msw` (Mock Service Worker) for API mocking.

**Property-Based Testing**: `fast-check` library — minimum 100 examples per property test.

**Test layout**:
```
tm-frontend/src/
└── __tests__/
    ├── LoginPage.test.jsx         # form validation, 401 handling, 429 handling
    ├── DashboardPage.test.jsx     # task list rendering, error/retry, empty state
    ├── ProtectedRoute.test.jsx    # redirect logic
    ├── useTasks.test.js           # hook state management
    ├── TaskItem.test.jsx          # status controls, delete confirm
    ├── StatusSummary.test.jsx     # count accuracy
    └── property/
        ├── auth.property.test.jsx
        └── tasks.property.test.jsx
```

**Property test example (fast-check)**:
```javascript
import fc from 'fast-check';

// Feature: task-manager-app, Property 9: Status summary counts accurately reflect task list state
test('status summary counts accurately reflect task list', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        id: fc.integer(),
        title: fc.string({ minLength: 1 }),
        status: fc.constantFrom('pending', 'in_progress', 'done'),
        created_at: fc.string(),
        updated_at: fc.string(),
      })),
      (tasks) => {
        const { getByTestId } = render(<StatusSummary tasks={tasks} />);
        const pending = tasks.filter(t => t.status === 'pending').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const done = tasks.filter(t => t.status === 'done').length;
        expect(getByTestId('count-pending')).toHaveTextContent(String(pending));
        expect(getByTestId('count-in_progress')).toHaveTextContent(String(inProgress));
        expect(getByTestId('count-done')).toHaveTextContent(String(done));
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Tests

Run against a real PostgreSQL test database with `pytest`:
- Full login → create task → update status → delete task flow
- Restart simulation (re-create engine, verify data persists) (Requirement 7.1, 7.2)
- OpenAPI schema available at `/docs` (Requirement 8.6)

### Test Configuration Notes

- Backend property tests use `hypothesis` with `@settings(max_examples=100)` minimum
- Frontend property tests use `fast-check` with `{ numRuns: 100 }` minimum
- Each property test carries a comment: `// Feature: task-manager-app, Property N: <property_text>`
- Run frontend tests with `vitest --run` (single execution, no watch mode)
- Run backend tests with `pytest` (standard single execution)
