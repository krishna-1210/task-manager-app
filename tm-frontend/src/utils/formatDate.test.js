// Feature: task-manager-app, Task 10.2: formatDate utility sanity checks

import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime } from './formatDate'

describe('formatDate', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })

  it('formats an ISO date string to a readable date', () => {
    const result = formatDate('2024-01-15T10:30:00Z')
    expect(result).toContain('2024')
    expect(result).toContain('15')
  })
})

describe('formatDateTime', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDateTime('')).toBe('')
  })

  it('formats an ISO date string to a readable date-time', () => {
    const result = formatDateTime('2024-01-15T10:30:00Z')
    expect(result).toContain('2024')
  })
})
