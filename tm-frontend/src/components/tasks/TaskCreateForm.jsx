/**
 * TaskCreateForm — controlled form for creating a new task.
 *
 * Rules (Requirements 4.3, 4.6, 4.7):
 * - Empty / whitespace title → field-level error, no submit.
 * - Title > 255 chars → field-level error with limit message, no submit.
 * - On valid submit: calls createTask(data) from useTasks (passed as prop).
 * - Clears form on success; shows inline API error on failure.
 * - Never calls the API directly — delegates via the createTask prop.
 *
 * @param {{ createTask: (data: { title: string, description?: string }) => Promise<void> }} props
 */

import { useState } from 'react'

import styles from './TaskCreateForm.module.css'

/** Maximum allowed title length (mirrors backend validation). */
const MAX_TITLE_LENGTH = 255

/** Maximum allowed description length (mirrors backend validation). */
const MAX_DESCRIPTION_LENGTH = 1000

/**
 * @param {{ createTask: (data: object) => Promise<void> }} props
 */
function TaskCreateForm({ createTask }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [titleError, setTitleError] = useState('')
  const [apiError, setApiError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  /**
   * Validate the title field.
   * Returns an error string, or empty string when valid.
   *
   * @param {string} value
   * @returns {string}
   */
  function validateTitle(value) {
    if (!value.trim()) {
      return 'Title is required.'
    }
    if (value.length > MAX_TITLE_LENGTH) {
      return `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`
    }
    return ''
  }

  /** Clear field-level error on change so it doesn't linger while typing. */
  function handleTitleChange(e) {
    setTitle(e.target.value)
    if (titleError) setTitleError('')
  }

  function handleDescriptionChange(e) {
    setDescription(e.target.value)
  }

  /**
   * Handle form submission.
   * Validates client-side first; only POSTs when valid.
   *
   * @param {React.FormEvent} e
   */
  async function handleSubmit(e) {
    e.preventDefault()
    setApiError('')

    const error = validateTitle(title)
    if (error) {
      setTitleError(error)
      return
    }

    setIsSubmitting(true)
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
      })
      // Clear form on success
      setTitle('')
      setDescription('')
      setTitleError('')
    } catch (err) {
      setApiError(err.response?.data?.detail ?? 'Failed to create task. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.heading}>New task</h2>

      {/* API-level error */}
      {apiError && (
        <p className={styles.apiError} role="alert">
          {apiError}
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor="task-title" className={styles.label}>
          Title <span aria-hidden="true">*</span>
        </label>
        <input
          id="task-title"
          type="text"
          className={`${styles.input} ${titleError ? styles.inputError : ''}`}
          value={title}
          onChange={handleTitleChange}
          placeholder="What needs to be done?"
          aria-describedby={titleError ? 'task-title-error' : undefined}
          aria-invalid={!!titleError}
          maxLength={MAX_TITLE_LENGTH + 1}
          disabled={isSubmitting}
        />
        {titleError && (
          <p id="task-title-error" className={styles.fieldError} role="alert">
            {titleError}
          </p>
        )}
        <p className={styles.charCount} aria-live="polite">
          {title.length}/{MAX_TITLE_LENGTH}
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor="task-description" className={styles.label}>
          Description <span className={styles.optional}>(optional)</span>
        </label>
        <textarea
          id="task-description"
          className={styles.textarea}
          value={description}
          onChange={handleDescriptionChange}
          placeholder="Add more detail…"
          rows={3}
          maxLength={MAX_DESCRIPTION_LENGTH}
          disabled={isSubmitting}
        />
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? 'Adding…' : 'Add task'}
      </button>
    </form>
  )
}

export default TaskCreateForm
