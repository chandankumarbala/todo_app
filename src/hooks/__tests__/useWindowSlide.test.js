import { makeSlideTo } from '../useWindowSlide'

describe('makeSlideTo', () => {
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

    slideTo(400)
    jest.advanceTimersByTime(8)   // one tick toward 400
    slideTo(100)                  // interrupt — slide back
    const countAfterInterrupt = mockSetPosition.mock.calls.length
    jest.advanceTimersByTime(200)
    const countAfterDrain = mockSetPosition.mock.calls.length

    expect(countAfterDrain - countAfterInterrupt).toBeGreaterThan(0)
    const lastPos = positions[positions.length - 1]
    expect(lastPos).toBe(100)
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

  it('stop() cancels in-flight animation', () => {
    const mockSetPosition = jest.fn()

    const { slideTo, stop } = makeSlideTo({
      startX: 0,
      setPosition: mockSetPosition,
      stepPx: 30,
      intervalMs: 8,
    })

    slideTo(500)
    jest.advanceTimersByTime(8)   // one tick
    stop()
    const callsAtStop = mockSetPosition.mock.calls.length
    jest.advanceTimersByTime(200) // no more ticks should fire
    expect(mockSetPosition.mock.calls.length).toBe(callsAtStop)
  })
})
