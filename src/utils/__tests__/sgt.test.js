import { todaySGT, priorityProgress, priorityState } from '../sgt'

test('todaySGT returns YYYY-MM-DD string', () => {
  expect(todaySGT()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('priorityProgress returns 0 when priority is 0', () => {
  expect(priorityProgress(0, null)).toBe(0)
})

test('priorityProgress returns 0 when prioritySetAt is null', () => {
  expect(priorityProgress(1, null)).toBe(0)
})

test('priorityProgress returns ~50 at 1 hour elapsed', () => {
  const setAt = new Date(Date.now() - 3_600_000).toISOString()
  expect(priorityProgress(1, setAt)).toBeCloseTo(50, 0)
})

test('priorityProgress caps at 100 after 2+ hours', () => {
  const setAt = new Date(Date.now() - 9_000_000).toISOString()
  expect(priorityProgress(1, setAt)).toBe(100)
})

test('priorityProgress returns 0 for future timestamp', () => {
  const setAt = new Date(Date.now() + 60_000).toISOString()
  expect(priorityProgress(1, setAt)).toBe(0)
})

test('priorityState returns empty string when priority off', () => {
  expect(priorityState(0, null)).toBe('')
})

test('priorityState returns priority-yellow before 2 hours', () => {
  const setAt = new Date(Date.now() - 3_600_000).toISOString()
  expect(priorityState(1, setAt)).toBe('priority-yellow')
})

test('priorityState returns priority-red at 100%', () => {
  const setAt = new Date(Date.now() - 9_000_000).toISOString()
  expect(priorityState(1, setAt)).toBe('priority-red')
})
