// Feature: task-manager-app, Task 10.2: STATUS_VALUES and STATUS_LABELS sanity checks

import { describe, expect, it } from 'vitest'

import { STATUS_LABELS, STATUS_VALUES } from './taskStatus'

describe('STATUS_VALUES', () => {
  it('exports exactly three status strings', () => {
    expect(Object.keys(STATUS_VALUES)).toHaveLength(3)
  })

  it('contains pending, in_progress, done', () => {
    expect(STATUS_VALUES.PENDING).toBe('pending')
    expect(STATUS_VALUES.IN_PROGRESS).toBe('in_progress')
    expect(STATUS_VALUES.DONE).toBe('done')
  })
})

describe('STATUS_LABELS', () => {
  it('has a label for every STATUS_VALUES entry', () => {
    Object.values(STATUS_VALUES).forEach((value) => {
      expect(STATUS_LABELS[value]).toBeTruthy()
    })
  })

  it('maps values to human-readable strings', () => {
    expect(STATUS_LABELS['pending']).toBe('Pending')
    expect(STATUS_LABELS['in_progress']).toBe('In Progress')
    expect(STATUS_LABELS['done']).toBe('Done')
  })
})
