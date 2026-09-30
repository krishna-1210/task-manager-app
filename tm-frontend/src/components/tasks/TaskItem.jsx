/**
 * TaskItem — renders a single task row with status controls and delete action.
 *
 * Rules:
 * - Does NOT call the API directly; delegates via onStatusChange and onDeleteRequest.
 * - Status values always come from STATUS_VALUES (never hard-coded strings).
 * - Shows a per-task error indicator when task.hasError is set.
 * - Delete button opens DeleteConfirmDialog; confirm calls onDeleteRequest, cancel dismisses.
 *
 * @param {{
 *   task: {
 *     id: number,
 *     title: string,
 *     description: string|null,
 *     status: string,
 *     created_at: string,
 *     hasError?: boolean,
 *   },
 *   onStatusChange: (id: number, status: string) => void,
 *   onDeleteRequest: (id: number) => void,
 * }} props
 */

import { useState } from 'react'

import { STATUS_LABELS, STATUS_VALUES } from '../../constants/taskStatus'
import { formatDate } from '../../utils/formatDate'
import DeleteConfirmDialog from './DeleteConfirmDialog'
import TaskStatusBadge from './TaskStatusBadge'

import styles from './TaskItem.module.css'

/** Ordered list of status buttons to render for every task item (Requirement 5.5). */
const STATUS_BUTTONS = [
  { value: STATUS_VALUES.PENDING, label: STATUS_LABELS[STATUS_VALUES.PENDING] },
  { value: STATUS_VALUES.IN_PROGRESS, label: STATUS_LABELS[STATUS_VALUES.IN_PROGRESS] },
  { value: STATUS_VALUES.DONE, label: STATUS_LABELS[STATUS_VALUES.DONE] },
]

/**
 * @param {{
 *   task: object,
 *   onStatusChange: (id: number, status: string) => void,
 *   onDeleteRequest: (id: number) => void,
 * }} props
 */
function TaskItem({ task, onStatusChange, onDeleteRequest }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  /** Open the confirmation dialog — no request issued yet. */
  function handleDeleteClick() {
    setIsDialogOpen(true)
  }

  /** User confirmed — delegate delete to parent, close dialog. */
  function handleConfirmDelete() {
    setIsDialogOpen(false)
    onDeleteRequest(task.id)
  }

  /** User cancelled — dismiss dialog, no request. */
  function handleCancelDelete() {
    setIsDialogOpen(false)
  }

  /**
   * Status button clicked — delegate to parent.
   *
   * @param {string} status
   */
  function handleStatusChange(status) {
    onStatusChange(task.id, status)
  }

  return (
    <article className={`${styles.item} ${task.hasError ? styles.hasError : ''}`}>
      {/* Error indicator (Requirement 5.8, 6.4) */}
      {task.hasError && (
        <p className={styles.errorIndicator} role="alert" aria-live="polite">
          Something went wrong. Please try again.
        </p>
      )}

      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{task.title}</h3>
          <TaskStatusBadge status={task.status} />
        </div>

        <button
          type="button"
          className={styles.deleteBtn}
          onClick={handleDeleteClick}
          aria-label={`Delete task: ${task.title}`}
        >
          ✕
        </button>
      </div>

      {task.description && (
        <p className={styles.description}>{task.description}</p>
      )}

      <p className={styles.date}>
        Created {formatDate(task.created_at)}
      </p>

      {/* Status controls — all three always present (Requirement 5.5) */}
      <div className={styles.statusControls} role="group" aria-label="Change task status">
        {STATUS_BUTTONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`${styles.statusBtn} ${task.status === value ? styles.statusBtnActive : ''}`}
            onClick={() => handleStatusChange(value)}
            aria-pressed={task.status === value}
            aria-label={`Set status to ${label}`}
            disabled={task.status === value}
          >
            {label}
          </button>
        ))}
      </div>

      <DeleteConfirmDialog
        isOpen={isDialogOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </article>
  )
}

export default TaskItem
