# Frontend Folder Structure & Style Conventions

This steering file is automatically loaded for every session.
It defines the canonical folder layout, component rules, and style conventions for `tm-frontend/`.

---

## Canonical Folder Layout

```
tm-frontend/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── main.jsx                 # ReactDOM.createRoot entry point only — no logic
│   ├── App.jsx                  # Router setup (React Router) + top-level layout
│   ├── App.css                  # Global layout styles only (not component styles)
│   ├── index.css                # CSS custom properties (design tokens), resets
│   │
│   ├── api/
│   │   └── client.js            # Axios instance — ALL API calls go through here
│   │
│   ├── hooks/
│   │   ├── useAuth.js           # Login, logout, token state
│   │   └── useTasks.js          # All task CRUD state — components never call API directly
│   │
│   ├── pages/
│   │   ├── LoginPage.jsx        # Route: /login
│   │   └── DashboardPage.jsx    # Route: /dashboard
│   │
│   ├── components/
│   │   ├── common/              # Generic, reusable UI primitives
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── ErrorBanner.jsx
│   │   │   └── LoadingSkeleton.jsx
│   │   ├── auth/                # Login-specific components
│   │   │   └── LoginForm.jsx
│   │   └── tasks/               # Task-domain components
│   │       ├── TaskItem.jsx
│   │       ├── TaskList.jsx
│   │       ├── TaskCreateForm.jsx
│   │       ├── StatusBadge.jsx
│   │       ├── StatusSummaryBar.jsx
│   │       └── DeleteConfirmDialog.jsx
│   │
│   ├── constants/
│   │   └── taskStatus.js        # STATUS_VALUES constant — single source of truth
│   │
│   └── utils/
│       └── formatDate.js        # Date formatting helpers
│
├── eslint.config.js
├── vite.config.js
├── package.json
└── index.html
```

---

## Component Rules

- One component per file. File name matches the exported component name (PascalCase).
- Pages live in `src/pages/` — they own routing-level concerns (page title, redirect logic).
- Shared UI primitives live in `src/components/common/`.
- Domain-specific components live in their own subfolder: `auth/`, `tasks/`.
- Components **never** import from `src/api/client.js` directly — only hooks do.
- Components **never** manage task state — that belongs to `useTasks`.

---

## Hook Rules

- `useAuth` owns: JWT token (React state only, never localStorage), login/logout actions, auth error state.
- `useTasks` owns: task list, loading state, error state, create/update/delete actions.
- All API calls are made inside hooks, never inside components or pages.
- Hooks return a stable object shape every render (even when loading).

---

## API Client Rules (`src/api/client.js`)

- Single Axios instance exported as default.
- Base URL read from `import.meta.env.VITE_API_BASE_URL`.
- Request interceptor attaches the JWT `Authorization: Bearer <token>` header.
- Response interceptor handles `401` globally (redirect to `/login`, clear token).
- No other file creates an Axios instance.

---

## Constants Rules

- Status values are always imported from `src/constants/taskStatus.js`.
- Never hard-code the strings `"pending"`, `"in_progress"`, or `"done"` in components.

```js
// src/constants/taskStatus.js
export const STATUS_VALUES = {
  PENDING:     'pending',
  IN_PROGRESS: 'in_progress',
  DONE:        'done',
};

export const STATUS_LABELS = {
  [STATUS_VALUES.PENDING]:     'Pending',
  [STATUS_VALUES.IN_PROGRESS]: 'In Progress',
  [STATUS_VALUES.DONE]:        'Done',
};
```

---

## Styling Rules

- Design tokens (colors, spacing, radii, fonts) are defined as CSS custom properties in `src/index.css`.
- Component-scoped styles use CSS Modules (`ComponentName.module.css`) placed next to the component file.
- No inline `style={{}}` props except for truly dynamic values (e.g., calculated widths).
- No Tailwind, no styled-components — plain CSS Modules only.
- Token names follow `--tm-<category>-<variant>` convention:

```css
/* src/index.css — design tokens */
:root {
  /* Colors */
  --tm-color-primary:        #4F46E5;
  --tm-color-danger:         #EF4444;
  --tm-color-status-pending: #F59E0B;
  --tm-color-status-progress:#3B82F6;
  --tm-color-status-done:    #10B981;
  --tm-color-surface:        #FFFFFF;
  --tm-color-bg:             #F9FAFB;
  --tm-color-border:         #E5E7EB;
  --tm-color-text:           #111827;
  --tm-color-text-muted:     #6B7280;

  /* Spacing */
  --tm-space-1: 4px;
  --tm-space-2: 8px;
  --tm-space-3: 12px;
  --tm-space-4: 16px;
  --tm-space-6: 24px;
  --tm-space-8: 32px;

  /* Shape */
  --tm-radius-sm:   4px;
  --tm-radius-md:   8px;
  --tm-radius-pill: 9999px;

  /* Typography */
  --tm-font-size-sm:   0.875rem;
  --tm-font-size-base: 1rem;
  --tm-font-size-lg:   1.125rem;
  --tm-font-weight-normal: 400;
  --tm-font-weight-medium: 500;
  --tm-font-weight-bold:   700;
}
```

---

## Routing Rules

- React Router v6 `<BrowserRouter>` configured in `App.jsx`.
- Protected routes redirect to `/login` when no token is present (handled in `App.jsx`).
- Route paths:
  - `/login` → `LoginPage`
  - `/dashboard` → `DashboardPage` (protected)
  - `/` → redirect to `/dashboard`

---

## Testing Rules

- Test runner: `vitest` — always run with `--run` flag, never in watch mode.
- Test files are co-located with the module: `TaskItem.test.jsx` next to `TaskItem.jsx`.
- Hook tests use `@testing-library/react` `renderHook`.
- Property tests use `fast-check` with `{ numRuns: 100 }`.
- Run all frontend tests: `vitest --run` from `tm-frontend/`.
