/**
 * useTasks — owns all task state and CRUD actions for the dashboard.
 *
 * Components never call the API directly; they call the actions exposed here
 * and read the derived state values.
 *
 * State shape:
 *   _allTasks  — full array (used for counts and hasMore check)
 *   isLoading  — true while fetchTasks is in flight
 *   error      — fetch-level error string or null
 *
 * Returned object (stable shape every render):
 *   tasks        — first MAX_TASK_DISPLAY items of _allTasks (for rendering)
 *   hasMore      — true when _allTasks.length > MAX_TASK_DISPLAY
 *   statusCounts — { pending, in_progress, done } counts from full array
 *   isLoading
 *   error
 *   fetchTasks()</p>
 *   createTask(data)
 *   updateTaskStatus(id, status)
 *   deleteTask(id)
 */

import { useCallback, useState } from 'react'

import apiClient from '../api/client'
import { STATUS_VALUES } from '../constants/taskStatus'

/** Maximum number of tasks rendered at once (Requirement 3.6). */
const MAX_TASK_DISPLAY = 100

/** Milliseconds after a 200 response before a status-update timeout fires. */
const STATUS_UPDATE_TIMEOUT_MS = 500

/**
 * Build a statusCounts object from the full task array.
 *
 * @param {Array<{status: string}>} allTasks
 * @returns {{ pending: number, in_progress: number, done: number }}
 */
function buildStatusCounts(allTasks) {
  return {
    [STATUS_VALUES.PENDING]: allTasks.filter((t) => t.status === STATUS_VALUES.PENDING).length,
    [STATUS_VALUES.IN_PROGRESS]: allTasks.filter(
      (t) => t.status === STATUS_VALUES.IN_PROGRESS,
    ).length,
    [STATUS_VALUES.DONE]: allTasks.filter((t) => t.status === STATUS_VALUES.DONE).length,
  }
}

/**
 * useTasks — provides task state and actions to dashboard components.
 *
 * @returns {{
 *   tasks: Array,
 *   hasMore: boolean,
 *   statusCounts: { pending: number, in_progress: number, done: number },
 *   isLoading: boolean,
 *   error: string|null,
 *   fetchTasks: () => Promise<void>,
 *   createTask: (data: { title: string, description?: string }) => Promise<void>,
 *   updateTaskStatus: (id: number, status: string) => Promise<void>,
 *   deleteTask: (id: number) => Promise<void>,
 * }}
 */
export function useTasks() {
  const [allTasks, setAllTasks] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // ---------------------------------------------------------------------------
  // fetchTasks
  // ---------------------------------------------------------------------------

  /**
   * Fetch the authenticated user's task list from the API.
   * Clears any previous error on success.
   */
  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.get('/tasks')
      setAllTasks(response.data)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to load tasks.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // createTask — optimistic prepend
  // ---------------------------------------------------------------------------

  /**
   * Optimistically prepend a new task then POST to the API.
   * Reverts the optimistic update on failure.
   *
   * @param {{ title: string, description?: string }} data
   */
  const createTask = useCallback(async (data) => {
    // Build a temporary optimistic task with a unique negative ID
    const optimisticId = -Date.now()
    const optimisticTask = {
      id: optimisticId,
      title: data.title,
      description: data.description ?? null,
      status: STATUS_VALUES.PENDING,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _optimistic: true,
    }

    // Prepend optimistically
    setAllTasks((prev) => [optimisticTask, ...prev])

    try {
      const response = await apiClient.post('/tasks', data)
      // Replace the optimistic entry with the real server response
      setAllTasks((prev) => prev.map((t) => (t.id === optimisticId ? response.data : t)))
    } catch (err) {
      // Revert — remove the optimistic entry
      setAllTasks((prev) => prev.filter((t) => t.id !== optimisticId))
      // Re-throw so the form can display an inline error
      throw err
    }
  }, [])

  // ---------------------------------------------------------------------------
  // updateTaskStatus — NOT optimistic, 500ms guard
  // ---------------------------------------------------------------------------

  /**
   * Send a PATCH request to update a task's status.
   * Only updates state AFTER a 200 response.
   * If the state update hasn't fired within 500ms of the 200 response, sets a
   * per-task error indicator on the task.
   *
   * @param {number} id
   * @param {string} status
   */
  const updateTaskStatus = useCallback(async (id, status) => {
    try {
      const response = await apiClient.patch(`/tasks/${id}`, { status })
      const updatedTask = response.data

      // Start 500ms guard timer the moment we receive the 200
      let stateUpdated = false
      const guardTimer = setTimeout(() => {
        if (!stateUpdated) {
          // Flag the task with a per-task error indicator
          setAllTasks((prev) =>
            prev.map((t) => (t.id === id ? { ...t, hasError: true } : t)),
          )
        }
      }, STATUS_UPDATE_TIMEOUT_MS)

      setAllTasks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...updatedTask, hasError: false } : t))
        stateUpdated = true
        clearTimeout(guardTimer)
        return next
      })
    } catch (err) {
      // Set per-task error indicator on failure
      setAllTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, hasError: true } : t)),
      )
    }
  }, [])

  // ---------------------------------------------------------------------------
  // deleteTask
  // ---------------------------------------------------------------------------

  /**
   * DELETE a task. Removes it from state on 204.
   * Sets a per-task error indicator on the task on failure.
   *
   * @param {number} id
   */
  const deleteTask = useCallback(async (id) => {
    try {
      await apiClient.delete(`/tasks/${id}`)
      setAllTasks((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setAllTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, hasError: true } : t)),
      )
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const tasks = allTasks.slice(0, MAX_TASK_DISPLAY)
  const hasMore = allTasks.length > MAX_TASK_DISPLAY
  const statusCounts = buildStatusCounts(allTasks)

  return {
    tasks,
    hasMore,
    statusCounts,
    isLoading,
    error,
    fetchTasks,
    createTask,
    updateTaskStatus,
    deleteTask,
  }
}
