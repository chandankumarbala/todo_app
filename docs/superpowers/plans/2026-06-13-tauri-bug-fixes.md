# Tauri Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two critical bugs — "Failed to load tasks" flash on launch and window blink/loop when focus is lost.

**Architecture:** Two isolated single-file fixes. Task 1 adds SWR retry config. Task 2 replaces async position polling in the slide hook with synchronous JS-tracked position + slide token + blur debounce.

**Tech Stack:** React, SWR, @tauri-apps/api/window, Jest

---

## File Map

| File | Change |
|------|--------|
| `src/hooks/useTasks.js` | Add `errorRetryCount: 5, errorRetryInterval: 1000` to SWR options |
| `src/hooks/useWindowSlide.js` | Replace async `slideTo` with sync closure-tracked `currentX` + `slideToken` + 150ms blur debounce |
| `src/hooks/__tests__/useTasks.test.js` | New: verify SWR retry options |
| `src/hooks/__tests__/useWindowSlide.test.js` | New: verify token abort + debounce logic |

---

## Task 1: SWR Retry Config for Task Loader

**Files:**
- Modify: `src/hooks/useTasks.js:7-9`
- Create: `src/hooks/__tests__/useTasks.test.js`

### Context

`useTasks.js` uses SWR to fetch tasks. On Tauri startup, the SQLite plugin isn't ready when the component first mounts, so `getTasks()` throws. SWR surfaces the error immediately. Adding `errorRetryCount` and `errorRetryInterval` makes SWR silently retry before showing an error.

- [ ] **Step 1: Create the test file**

```js
// src/hooks/__tests__/useTasks.test.js
import { renderHook } from '@testing-library/react'
import { useTasks } from '../useTasks'

jest.mock('@/lib/api', () => ({
  getTasks: jest.fn().mockResolvedValue([]),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  reorderTasks: jest.fn(),
  togglePriority: jest.fn(),
}))

jest.mock('swr', () => {
  const actual = jest.requireActual('swr')
  const useSWRSpy = jest.fn(actual.default)
  return { __esModule: true, default: useSWRSpy }
})

import useSWR from 'swr'

describe('useTasks SWR config', () => {
  it('passes errorRetryCount: 5 to SWR', () => {
    renderHook(() => useTasks())
    const [, , options] = useSWR.mock.calls[0]
    expect(options.errorRetryCount).toBe(5)
  })

  it('passes errorRetryInterval: 1000 to SWR', () => {
    renderHook(() => useTasks())
    const [, , options] = useSWR.mock.calls[0]
    expect(options.errorRetryInterval).toBe(1000)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/chandankumarbala/projects/task_list
npx jest src/hooks/__tests__/useTasks.test.js --no-coverage
```

Expected: FAIL — `errorRetryCount` and `errorRetryInterval` are undefined.

- [ ] **Step 3: Apply the fix to `useTasks.js`**

Replace lines 7–9:

```js
  const { data, error, mutate } = useSWR('/api/tasks', fetcher, {
    refreshInterval: 60000,
    errorRetryCount: 5,
    errorRetryInterval: 1000,
  })
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/hooks/__tests__/useTasks.test.js --no-coverage
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTasks.js src/hooks/__tests__/useTasks.test.js
git commit -m "fix: add SWR retry config to suppress startup task load error"
```

---

## Task 2: Fix Window Blink Loop in useWindowSlide

**Files:**
- Modify: `src/hooks/useWindowSlide.js` (full rewrite of `slideTo` + blur listener)
- Create: `src/hooks/__tests__/useWindowSlide.test.js`

### Context

Current `slideTo()` polls `win.outerPosition()` (async) inside a chained `setTimeout`. When blur and focus events fire in quick succession, multiple async `step()` coroutines run concurrently and write conflicting positions → window oscillates.

Fix: track `currentX` as a plain JS number (no async reads). Use `setInterval` instead of chained `setTimeout` — clearing is deterministic. Increment `slideToken` on each `slideTo()` call; each interval tick checks its token is still current before writing. Add 150ms debounce on blur so rapid focus→blur within 150ms doesn't start a slide.

- [ ] **Step 1: Create the test file — extract and test the pure slide logic**

The token and debounce logic can be tested in isolation by extracting `makeSlideTo` as a named export (added in Step 3). Write the test now so it fails:

```js
// src/hooks/__tests__/useWindowSlide.test.js
import { makeSlideTo } from '../useWindowSlide'

describe('makeSlideTo token guard', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('aborts old animation when new slideTo called', () => {
    const positions = []
    const mockSetPosition = jest.fn((x) => positions.push(x))

    const { slideTo, getCurrentX } = makeSlideTo({
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
    // The old animation must not add more calls after interrupt
    const newAnimationCalls = countAfterDrain - countAfterInterrupt
    expect(newAnimationCalls).toBeGreaterThan(0) // new animation ran
    // Verify: after drain, position is near 100 (slid back), not 400
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
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx jest src/hooks/__tests__/useWindowSlide.test.js --no-coverage
```

Expected: FAIL — `makeSlideTo` not exported.

- [ ] **Step 3: Rewrite `useWindowSlide.js`**

Replace the entire file:

```js
'use client'
import { useEffect } from 'react'

/**
 * Pure slide engine — exported for testing.
 * Returns { slideTo, getCurrentX }.
 * setPosition(x) is called fire-and-forget each tick.
 */
export function makeSlideTo({ startX, setPosition, stepPx = 30, intervalMs = 8 }) {
  let currentX = startX
  let slideToken = 0
  let intervalId = null

  function slideTo(targetX) {
    const token = ++slideToken
    if (intervalId) { clearInterval(intervalId); intervalId = null }

    intervalId = setInterval(() => {
      if (token !== slideToken) { clearInterval(intervalId); return }
      const diff = targetX - currentX
      if (Math.abs(diff) < 2) {
        currentX = targetX
        setPosition(targetX)
        clearInterval(intervalId); intervalId = null
        return
      }
      currentX += diff > 0 ? Math.min(stepPx, diff) : Math.max(-stepPx, diff)
      setPosition(Math.round(currentX))
    }, intervalMs)
  }

  function getCurrentX() { return currentX }

  return { slideTo, getCurrentX }
}

export function useWindowSlide() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return

    let unlistenBlur = null
    let unlistenFocus = null
    let blurTimer = null
    let aborted = false

    async function init() {
      const { getCurrentWindow, currentMonitor } = await import('@tauri-apps/api/window')
      const { LogicalSize, LogicalPosition } = await import('@tauri-apps/api/dpi')

      const win = getCurrentWindow()
      const monitor = await currentMonitor()
      if (!monitor) return

      const scaleFactor = monitor.scaleFactor
      const screenWidth = monitor.size.width / scaleFactor
      const screenHeight = monitor.size.height / scaleFactor
      const winWidth = Math.round(screenWidth * 0.3)
      const MENU_BAR = 28

      await win.setSize(new LogicalSize(winWidth, screenHeight - MENU_BAR))
      await win.setPosition(new LogicalPosition(screenWidth - winWidth, MENU_BAR))

      const { slideTo } = makeSlideTo({
        startX: screenWidth - winWidth,
        setPosition: (x) => win.setPosition(new LogicalPosition(x, MENU_BAR)),
      })

      unlistenBlur = await win.listen('tauri://blur', () => {
        clearTimeout(blurTimer)
        blurTimer = setTimeout(() => slideTo(screenWidth - 3), 150)
      })

      unlistenFocus = await win.listen('tauri://focus', () => {
        clearTimeout(blurTimer)
        slideTo(screenWidth - winWidth)
      })

      if (aborted) {
        clearTimeout(blurTimer)
        if (unlistenBlur) unlistenBlur()
        if (unlistenFocus) unlistenFocus()
      }
    }

    init()

    return () => {
      aborted = true
      clearTimeout(blurTimer)
      if (unlistenBlur) unlistenBlur()
      if (unlistenFocus) unlistenFocus()
    }
  }, [])
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/hooks/__tests__/useWindowSlide.test.js --no-coverage
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass (no regressions).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useWindowSlide.js src/hooks/__tests__/useWindowSlide.test.js
git commit -m "fix: replace async position polling with sync slide token to stop blink loop"
```
