// src/hooks/__tests__/useWindowSlide.test.js
import { makeSlideTo } from '../useWindowSlide'

describe('makeSlideTo token guard', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('aborts old animation when new slideTo called', () => {
    const positions = []
    const mockSetPosition = jest.fn((x) => positions.push(x))

    const { slideTo } = makeSlideTo({
      startX: 100,
      setPosition: mockSetPosition,
      stepPx: 30,
      intervalMs: 8,
    })

    slideTo(400)          // start sliding right
    jest.advanceTimersByTime(8)   // one tick: currentX moves toward 400
    slideTo(100)          // interrupt — slide back left
    const countAfterInterrupt = mockSetPosition.mock.calls.length
    jest.advanceTimersByTime(200) // run out remaining ticks
    const countAfterDrain = mockSetPosition.mock.calls.length

    // After interrupt, only the NEW animation's ticks should fire
    const newAnimationCalls = countAfterDrain - countAfterInterrupt
    expect(newAnimationCalls).toBeGreaterThan(0) // new animation ran
    // After drain, position is near 100 (slid back), not 400
    const lastPos = positions[positions.length - 1]
    expect(lastPos).toBeLessThanOrEqual(102)
  })

  it('settles at exact targetX', () => {
    const positions = []
    const mockSetPosition = jest.fn((x) => positions.push(x))

    const { slideTo } = makeSlideTo({
      startX: 0,
      setPosition: mockSetPosition,
      stepPx: 30,
      intervalMs: 8,
    })

    slideTo(50)
    jest.runAllTimers()

    const lastPos = positions[positions.length - 1]
    expect(lastPos).toBe(50)
  })
})
