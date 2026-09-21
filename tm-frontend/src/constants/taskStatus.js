/**
 * Single source of truth for task status values and display labels.
 * Always import from here — never hard-code status strings in components.
 */

/** @type {{ PENDING: string, IN_PROGRESS: string, DONE: string }} */
export const STATUS_VALUES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
}

/** Human-readable labels for each status value. */
export const STATUS_LABELS = {
  [STATUS_VALUES.PENDING]: 'Pending',
  [STATUS_VALUES.IN_PROGRESS]: 'In Progress',
  [STATUS_VALUES.DONE]: 'Done',
}
