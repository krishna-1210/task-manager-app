/**
 * DashboardPage — the primary authenticated view.
 *
 * Responsibilities (Requirements 3.1–3.6):
 * - Calls fetchTasks() on mount to load the user's task list.
 * - Shows a loading indicator while the initial fetch is in flight.
 * - Shows an error banner with a retry button when the fetch fails;
 *   clicking retry re-issues fetchTasks() and clears the banner on success.
 * - Renders StatusSummary (full task array for accurate counts),
 *   TaskCreateForm (createTask action), and TaskList (capped tasks + handlers).
 * - Displays an empty-state message and zero counts when the task list is empty
 *   (handled inside StatusSummary and TaskList respectively).
 *
 * This component never calls the API directly — all state and actions come from
 * the useTasks hook.
 */

import { useEffect } from 'react'

import { useAuth } from '../hooks/useAuth'
import { useTasks } from '../hooks/useTasks'
import StatusSummary from '../components/tasks/StatusSummary'
import TaskCreateForm from '../components/tasks/TaskCreateForm'
import TaskList from '../components/tasks/TaskList'

import styles from './DashboardPage.module.css'

/**
 * DashboardPage — route: /dashboard (protected).
 */
function DashboardPage() {
  const { logout } = useAuth()
  const {
    tasks,
    hasMore,
    statusCounts,
    isLoading,
    error,
    fetchTasks,
    createTask,
    updateTaskStatus,
    deleteTask,
  } = useTasks()

  /**
   * Total task count across all statuses — used by TaskList's disclosure message.
   * Derived from statusCounts (which is computed from the full unsliced array),
   * so it's accurate even when hasMore is true.
   */
  const totalCount =
    statusCounts.pending + statusCounts.in_progress + statusCounts.done

  /** Fetch tasks once on mount (Requirement 3.1). */
  useEffect(() => {
    fetchTasks()
    // fetchTasks is a stable useCallback — safe to list as dep, runs once.
  }, [fetchTasks])

  /** Retry handler — re-issues the fetch request (Requirement 3.5). */
  function handleRetry() {
    fetchTasks()
  }

  /** Logout button handler (Requirement 2.5). */
  function handleLogout() {
    logout()
  }

  return (
    <div className={styles.page}>
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className={styles.header}>
        <h1 className={styles.appTitle}>Task Manager</h1>
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={handleLogout}
          aria-label="Log out"
        >
          Log out
        </button>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                        */}
      {/* ------------------------------------------------------------------ */}
      <main className={styles.main}>
        {/* Loading state — shown while the initial fetch is in flight */}
        {isLoading && (
          <p className={styles.loadingMessage} role="status" aria-live="polite">
            Loading tasks…
          </p>
        )}

        {/* Error banner with retry (Requirement 3.5) */}
        {error && !isLoading && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorText}>{error}</span>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard content — shown even during a background retry */}
        {!isLoading && (
          <>
            {/* Status summary bar (Requirements 3.3, 3.4) */}
            <section className={styles.summarySection} aria-label="Status summary">
              <StatusSummary tasks={tasks} />
            </section>

            {/* Task creation form (Requirements 4.3, 4.6, 4.7) */}
            <section className={styles.createSection} aria-label="Create a task">
              <TaskCreateForm createTask={createTask} />
            </section>

            {/* Task list (Requirements 3.2, 3.6) */}
            <section className={styles.listSection} aria-label="Your tasks">
              <TaskList
                tasks={tasks}
                hasMore={hasMore}
                totalCount={totalCount}
                onStatusChange={updateTaskStatus}
                onDeleteRequest={deleteTask}
              />
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default DashboardPage
