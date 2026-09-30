/**
 * DeleteConfirmDialog — confirmation modal shown before a task delete request.
 *
 * Rules (Requirements 6.5, 6.6):
 * - Does NOT submit any API request itself — delegates to caller via onConfirm.
 * - Renders only when isOpen is true.
 * - Cancel dismisses without any network call.
 *
 * @param {{
 *   isOpen: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */

import styles from './DeleteConfirmDialog.module.css'

/**
 * @param {{ isOpen: boolean, onConfirm: () => void, onCancel: () => void }} props
 */
function DeleteConfirmDialog({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null

  return (
    /* Backdrop */
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className={styles.dialog}>
        <h2 id="delete-dialog-title" className={styles.title}>
          Delete task?
        </h2>
        <p className={styles.body}>This action cannot be undone.</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            aria-label="Cancel delete"
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
            aria-label="Confirm delete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmDialog
