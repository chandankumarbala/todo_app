# Tauri App Bug Fixes Design

**Goal:** Fix two critical bugs — startup "Failed to load tasks" flash and window blink/loop on blur.

**Architecture:** Two isolated fixes, one per file. No shared state changes.

**Tech Stack:** Tauri, React, SWR, @tauri-apps/api/window

---

## Bug 1: "Failed to load tasks" on Launch

**Root cause:** SWR fires `getTasks()` on mount before Tauri's SQLite plugin is fully initialized. The call throws, SWR surfaces the error state briefly, then auto-retries and succeeds.

**Fix:** Add retry configuration to SWR in `useTasks.js`:

```js
const { data, error, mutate } = useSWR('/api/tasks', fetcher, {
  refreshInterval: 60000,
  errorRetryCount: 5,
  errorRetryInterval: 1000,
})
```

SWR silently retries up to 5 times at 1-second intervals before surfacing a persistent error. This covers the ~500ms window during which the SQLite plugin is not yet ready.

**File:** `src/hooks/useTasks.js` — 1 line change.

---

## Bug 2: Window Blink/Loop on Blur

**Root cause:** `slideTo()` in `useWindowSlide.js` uses `win.outerPosition()` (async) inside a `setTimeout` loop. Multiple blur/focus events fire before the animation settles, spawning concurrent async `step()` coroutines. Each coroutine reads a stale position and writes conflicting positions → window oscillates.

**Fix:** Remove async position polling. Track `currentX` in a closure variable (known at init, updated each step). Animation becomes synchronous — no await mid-step, no concurrent coroutine overlap.

Add a slide generation token (`slideToken`) to abort any running animation when a new one starts. Use `setInterval` (not chained `setTimeout`) so clearing is deterministic.

Add 150ms debounce on blur event to absorb accidental rapid blur/focus during normal use.

```js
let currentX = screenWidth - winWidth  // known from init, updated each step
let slideToken = 0                     // incremented each slideTo() call

function slideTo(targetX) {
  const token = ++slideToken
  if (intervalId) { clearInterval(intervalId); intervalId = null }

  intervalId = setInterval(() => {
    if (token !== slideToken) { clearInterval(intervalId); return }
    const diff = targetX - currentX
    if (Math.abs(diff) < 2) {
      currentX = targetX
      win.setPosition(new LogicalPosition(targetX, MENU_BAR))
      clearInterval(intervalId); intervalId = null
      return
    }
    currentX += diff > 0 ? Math.min(30, diff) : Math.max(-30, diff)
    win.setPosition(new LogicalPosition(Math.round(currentX), MENU_BAR))
  }, 8)
}

// Blur with 150ms debounce
let blurTimer = null
unlistenBlur = await win.listen('tauri://blur', () => {
  clearTimeout(blurTimer)
  blurTimer = setTimeout(() => slideTo(screenWidth - 3), 150)
})

unlistenFocus = await win.listen('tauri://focus', () => {
  clearTimeout(blurTimer)
  slideTo(screenWidth - winWidth)
})
```

`setPosition` calls are fire-and-forget (no await) — sync interval tick, no overlap possible.

**File:** `src/hooks/useWindowSlide.js` — rewrite `slideTo` + blur debounce (~25 lines net change).

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useTasks.js` | Add `errorRetryCount: 5, errorRetryInterval: 1000` to SWR options |
| `src/hooks/useWindowSlide.js` | Replace async `slideTo` with sync JS-tracked position + slide token + blur debounce |

## Testing

- Launch binary → no "Failed to load tasks" message visible
- Click another window → app slides to 3px strip, no loop
- Click app strip → slides back to full width
- Rapid click in/out → no oscillation
- Minimize → window hides normally
