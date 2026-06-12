import { todaySGT, progressState, nextProgress } from '../utils/sgt'

describe('todaySGT', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns YYYY-MM-DD string in SGT', () => {
    jest.setSystemTime(new Date('2026-05-29T16:30:00Z')) // 00:30 May 30 SGT
    expect(todaySGT()).toBe('2026-05-30')
  })
})

describe('progressState', () => {
  it('returns empty string when progress is 0', () => {
    expect(progressState(0)).toBe('')
  })

  it('returns empty string when progress is negative', () => {
    expect(progressState(-1)).toBe('')
  })

  it('returns progress-yellow when progress is 20', () => {
    expect(progressState(20)).toBe('progress-yellow')
  })

  it('returns progress-yellow when progress is 80', () => {
    expect(progressState(80)).toBe('progress-yellow')
  })

  it('returns progress-red when progress is 100', () => {
    expect(progressState(100)).toBe('progress-red')
  })
})

describe('nextProgress', () => {
  it('0 → 20', () => expect(nextProgress(0)).toBe(20))
  it('20 → 40', () => expect(nextProgress(20)).toBe(40))
  it('40 → 60', () => expect(nextProgress(40)).toBe(60))
  it('60 → 80', () => expect(nextProgress(60)).toBe(80))
  it('80 → 100', () => expect(nextProgress(80)).toBe(100))
  it('100 → 0 (wrap)', () => expect(nextProgress(100)).toBe(0))
  it('invalid value → 0', () => expect(nextProgress(99)).toBe(0))
})
