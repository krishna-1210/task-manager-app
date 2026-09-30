/**
 * TaskList — renders a list of TaskItem components.
 *
 * Rules (Requirements 3.2, 3.6):
 * - Renders one TaskItem per task in the `tasks` prop (already capped at 100 by useTasks).
 * - When hasMore is true, shows a disclosure indicator with the total count.
 * - Passes onStatusChange and onDeleteRequest down to each TaskItem.
 *
 * @param {{
 *   tasks: Array<object>,
 *   hasMore: boolean,
 *   totalCount: number,
 *   onStatusChange: (id: number, status: string) => void,
 *   onDeleteRequest: (id: number) => void,
 * }} props
 */

import TaskItem from './TaskItem'

import styles from './TaskList.module.css'

/** The cap applied by useTasks (mirrored here for the disclosure message). */
const DISPLAY_CAP = 100

/**
 * @param {{
 *   tasks: Array<object>,
 *   hasMore: boolean,
 *   totalCount: number,
 *   onStatusChange: (id: number, status: string) => void,
 *   onDeleteRequest: (id: number) => void,
 * }} props
 */
function TaskList({ tasks, hasMore, totalCount, onStatusChange, onDeleteRequest }) {
  if (tasks.length === 0) {
    return (
      <p className={styles.emptyState} data-testid="empty-task-list">
        No tasks yet. Add one above to get started.
      </p>
    )
  }

  return (
    <section aria-label="Task list">
      <ul className={styles.list} role="list">
        {tasks.map((task) => (
          <li key={task.id} className={styles.listItem}>
            <TaskItem
              task={task}
              onStatusChange={onStatusChange}
              onDeleteRequest={onDeleteRequest}
            />
          </li>
        ))}
      </ul>

      {/* Disclosure indicator when more than DISPLAY_CAP tasks exist (Requirement 3.6) */}
      {hasMore && (
        <p className={styles.disclosure} data-testid="task-list-disclosure">
          Showing {DISPLAY_CAP} of {totalCount} tasks. Older tasks are not displayed.
        </p>
      )}
    </section>
  )
}

export default TaskList
