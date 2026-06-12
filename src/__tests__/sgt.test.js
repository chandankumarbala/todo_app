import { todaySGT, priorityState } from '../utils/sgt'

describe('todaySGT', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns YYYY-MM-DD string in SGT', () => {
    jest.setSystemTime(new Date('2026-05-29T16:30:00Z')) // 00:30 May 30 SGT
    expect(todaySGT()).toBe('2026-05-30')
  })
})

describe('priorityState', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns empty string when priority is 0', () => {
    expect(priorityState(0, '2026-05-29T10:00:00Z')).toBe('')
  })

  it('returns empty string when prioritySetAt is null', () => {
    expect(priorityState(1, null)).toBe('')
  })

  it('returns empty string when prioritySetAt is undefined', () => {
    expect(priorityState(1, undefined)).toBe('')
  })

  it('returns priority-yellow when age is less than 2 hours', () => {
    const setAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T11:59:59Z'))
    expect(priorityState(1, setAt)).toBe('priority-yellow')
  })

  it('returns priority-red when age is exactly 2 hours', () => {
    const setAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T12:00:00Z'))
    expect(priorityState(1, setAt)).toBe('priority-red')
  })

  it('returns priority-red when age is more than 2 hours', () => {
    const setAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T15:00:00Z'))
    expect(priorityState(1, setAt)).toBe('priority-red')
  })
})
