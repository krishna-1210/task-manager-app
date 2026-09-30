/**
 * TaskStatusBadge — renders a styled pill showing the task's current status.
 *
 * @param {{ status: string }} props
 */

import { STATUS_LABELS, STATUS_VALUES } from '../../constants/taskStatus'

import styles from './TaskStatusBadge.module.css'

/** Map status value → CSS module class for the pill colour. */
const STATUS_CLASS = {
  [STATUS_VALUES.PENDING]: styles.pending,
  [STATUS_VALUES.IN_PROGRESS]: styles.inProgress,
  [STATUS_VALUES.DONE]: styles.done,
}

/**
 * @param {{ status: string }} props
 */
function TaskStatusBadge({ status }) {
  const label = STATUS_LABELS[status] ?? status
  const colorClass = STATUS_CLASS[status] ?? ''

  return (
    <span className={`${styles.badge} ${colorClass}`} aria-label={`Status: ${label}`}>
      {label}
    </span>
  )
}

export default TaskStatusBadge
