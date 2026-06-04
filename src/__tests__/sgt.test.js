import { todaySGT, urgencyClass } from '../utils/sgt'

describe('todaySGT', () => {
  it('returns YYYY-MM-DD string in SGT', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-29T16:30:00Z')) // 00:30 May 30 SGT
    expect(todaySGT()).toBe('2026-05-30')
    jest.useRealTimers()
  })
})

describe('urgencyClass', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns empty string when createdAt is null', () => {
    expect(urgencyClass(null)).toBe('')
  })

  it('returns empty string when createdAt is undefined', () => {
    expect(urgencyClass(undefined)).toBe('')
  })

  it('returns empty string when task is less than 2 hours old', () => {
    const createdAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T11:59:59Z')) // 1h 59m 59s later
    expect(urgencyClass(createdAt)).toBe('')
  })

  it('returns urgency-yellow when task is exactly 2 hours old', () => {
    const createdAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T12:00:00Z')) // exactly 2h later
    expect(urgencyClass(createdAt)).toBe('urgency-yellow')
  })

  it('returns urgency-yellow when task is between 2 and 4 hours old', () => {
    const createdAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T13:30:00Z')) // 3.5h later
    expect(urgencyClass(createdAt)).toBe('urgency-yellow')
  })

  it('returns urgency-red when task is exactly 4 hours old', () => {
    const createdAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T14:00:00Z')) // exactly 4h later
    expect(urgencyClass(createdAt)).toBe('urgency-red')
  })

  it('returns urgency-red when task is more than 4 hours old', () => {
    const createdAt = new Date('2026-05-29T10:00:00Z').toISOString()
    jest.setSystemTime(new Date('2026-05-29T20:00:00Z')) // 10h later
    expect(urgencyClass(createdAt)).toBe('urgency-red')
  })
})
