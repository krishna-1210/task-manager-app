/**
 * StatusSummary — displays task counts grouped by status.
 *
 * Derives counts from the full task array passed via props.
 * Uses data-testid attributes for test assertions (Property 9).
 *
 * @param {{ tasks: Array<{status: string}> }} props
 */

import { STATUS_LABELS, STATUS_VALUES } from '../../constants/taskStatus'

import styles from './StatusSummary.module.css'

/**
 * @param {{ tasks: Array<{status: string}> }} props
 */
function StatusSummary({ tasks }) {
  const pendingCount = tasks.filter((t) => t.status === STATUS_VALUES.PENDING).length
  const inProgressCount = tasks.filter((t) => t.status === STATUS_VALUES.IN_PROGRESS).length
  const doneCount = tasks.filter((t) => t.status === STATUS_VALUES.DONE).length

  return (
    <div className={styles.bar} role="region" aria-label="Task status summary">
      <div className={styles.item}>
        <span className={`${styles.dot} ${styles.dotPending}`} aria-hidden="true" />
        <span className={styles.label}>{STATUS_LABELS[STATUS_VALUES.PENDING]}</span>
        <span className={styles.count} data-testid="count-pending">
          {pendingCount}
        </span>
      </div>

      <div className={styles.item}>
        <span className={`${styles.dot} ${styles.dotProgress}`} aria-hidden="true" />
        <span className={styles.label}>{STATUS_LABELS[STATUS_VALUES.IN_PROGRESS]}</span>
        <span className={styles.count} data-testid="count-in_progress">
          {inProgressCount}
        </span>
      </div>

      <div className={styles.item}>
        <span className={`${styles.dot} ${styles.dotDone}`} aria-hidden="true" />
        <span className={styles.label}>{STATUS_LABELS[STATUS_VALUES.DONE]}</span>
        <span className={styles.count} data-testid="count-done">
          {doneCount}
        </span>
      </div>
    </div>
  )
}

export default StatusSummary
