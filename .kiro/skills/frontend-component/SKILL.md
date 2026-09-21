---
name: frontend-component
description: Create a new React component for the task-manager frontend. Use when adding a UI component, page, hook, or constant following the project's folder structure and styling conventions.
---

## Creating a Frontend Component

Follow these steps in order. The key principle: **folder first, then file, then styles, then wire up**.

### Step 1 — Determine the correct folder

Ask: what kind of thing is this?

| Type | Folder | File naming |
|---|---|---|
| Route-level page | `src/pages/` | `<Name>Page.jsx` |
| Reusable UI primitive | `src/components/common/` | `<Name>.jsx` |
| Auth-specific component | `src/components/auth/` | `<Name>.jsx` |
| Task-domain component | `src/components/tasks/` | `<Name>.jsx` |
| Custom hook | `src/hooks/` | `use<Name>.js` |
| API client (one only) | `src/api/` | `client.js` |
| Shared constant | `src/constants/` | `camelCase.js` |
| Utility helper | `src/utils/` | `camelCase.js` |

If unsure, ask before creating the file.

### Step 2 — Create the component file

One component per file. File name must match the exported component name exactly.

```jsx
// src/components/tasks/StatusBadge.jsx

import styles from './StatusBadge.module.css';
import { STATUS_VALUES, STATUS_LABELS } from '../../constants/taskStatus';

/**
 * Displays a coloured pill badge for a task status.
 * @param {{ status: 'pending' | 'in_progress' | 'done' }} props
 */
function StatusBadge({ status }) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default StatusBadge;
```

Rules:
- Named export or default export — be consistent within a domain folder
- Props destructured in the function signature
- One-line JSDoc describing purpose and params on every exported component/hook
- Event handlers named with `handle` prefix: `handleSubmit`, `handleDelete`
- Boolean state/props with `is`/`has` prefix: `isLoading`, `hasError`

### Step 3 — Create the co-located CSS Module

Create `<ComponentName>.module.css` **in the same folder** as the component.

```css
/* src/components/tasks/StatusBadge.module.css */

.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--tm-space-1) var(--tm-space-3);
  border-radius: var(--tm-radius-pill);
  font-size: var(--tm-font-size-sm);
  font-weight: var(--tm-font-weight-medium);
}

.pending {
  background-color: var(--tm-color-status-pending);
  color: #000;
}

.in_progress {
  background-color: var(--tm-color-status-progress);
  color: #fff;
}

.done {
  background-color: var(--tm-color-status-done);
  color: #fff;
}
```

Rules:
- **Only** use `--tm-*` CSS custom properties for colors, spacing, radii, and typography — never raw hex/px values for design tokens
- **No** inline `style={{}}` props except genuinely dynamic values (e.g., calculated widths)
- **No** Tailwind classes, **no** styled-components
- All design tokens are defined in `src/index.css` under `:root`

### Step 4 — Use constants, never hard-coded strings

```js
// WRONG
if (task.status === 'in_progress') { ... }

// CORRECT
import { STATUS_VALUES } from '../constants/taskStatus';
if (task.status === STATUS_VALUES.IN_PROGRESS) { ... }
```

### Step 5 — Hook rules (when creating a hook)

```js
// src/hooks/useTasks.js

import { useState, useCallback } from 'react';
import apiClient from '../api/client';

/**
 * Owns all task list state and CRUD operations.
 * @returns {{ tasks, isLoading, error, createTask, deleteTask, updateTaskStatus }}
 */
function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get('/tasks');
      setTasks(data);
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { tasks, isLoading, error, fetchTasks };
}

export default useTasks;
```

Rules:
- JWT token lives in React state only — **never** `localStorage` or `sessionStorage`
- All API calls go through `src/api/client.js` — hooks import `apiClient`, components do not
- Every async function has `try/catch/finally` — loading set to `false` in `finally`
- Errors stored in state, surfaced via `ErrorBanner` — no `console.error` in components
- Hook always returns the same shape even when loading (no `undefined` fields)

### Step 6 — Wire up in the parent

After creating the component, import it in the appropriate page or parent component.
Do not modify routing unless this is a new page — routing lives in `App.jsx`.

### Step 7 — Run frontend tests

```powershell
cd tm-frontend
npx vitest --run
```

---

## Quick Reference

| Rule | Detail |
|---|---|
| Styling | CSS Modules only, `--tm-*` tokens |
| State | No component owns task state — use `useTasks` |
| API | Only hooks import `client.js` |
| Status strings | Always from `STATUS_VALUES` constant |
| Token storage | React state only — never localStorage |
| Test runner | `vitest --run` (never watch mode) |
