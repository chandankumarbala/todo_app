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

  it('returns empty string when no deadline', () => {
    jest.setSystemTime(new Date('2026-05-29T08:00:00+08:00'))
    expect(urgencyClass(null)).toBe('')
  })

  it('returns empty string when deadline is not today SGT', () => {
    jest.setSystemTime(new Date('2026-05-29T14:00:00+08:00'))
    expect(urgencyClass('2026-05-30')).toBe('')
  })

  it('returns empty string before 12:00 SGT on deadline day', () => {
    jest.setSystemTime(new Date('2026-05-29T11:59:00+08:00'))
    expect(urgencyClass('2026-05-29')).toBe('')
  })

  it('returns yellow between 12:00 and 16:00 SGT', () => {
    jest.setSystemTime(new Date('2026-05-29T13:00:00+08:00'))
    expect(urgencyClass('2026-05-29')).toBe('urgency-yellow')
  })

  it('returns red at and after 16:00 SGT', () => {
    jest.setSystemTime(new Date('2026-05-29T16:00:00+08:00'))
    expect(urgencyClass('2026-05-29')).toBe('urgency-red')
  })

  it('returns red after 16:00 SGT', () => {
    jest.setSystemTime(new Date('2026-05-29T20:00:00+08:00'))
    expect(urgencyClass('2026-05-29')).toBe('urgency-red')
  })
})
