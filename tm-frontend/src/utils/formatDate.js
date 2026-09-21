/**
 * Date formatting helpers for the Task Manager UI.
 */

/**
 * Format an ISO 8601 date string into a human-readable date.
 *
 * @param {string} isoString - ISO 8601 date string from the API (e.g. "2024-01-15T10:30:00Z")
 * @returns {string} Formatted date string (e.g. "Jan 15, 2024")
 */
export function formatDate(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format an ISO 8601 date string into a human-readable date and time.
 *
 * @param {string} isoString - ISO 8601 date string from the API
 * @returns {string} Formatted date-time string (e.g. "Jan 15, 2024, 10:30 AM")
 */
export function formatDateTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
