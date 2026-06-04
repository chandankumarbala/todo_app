# Task Urgency Highlight — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace deadline-based urgency colouring with creation-time-based urgency — yellow after 2h, red after 4h since task creation, for all pending tasks.

**Architecture:** `urgencyClass` in `src/utils/sgt.js` is the single source of truth for urgency logic. It changes signature from `urgencyClass(deadline)` to `urgencyClass(createdAt)`. `TaskItem.jsx` passes `task.created_at` instead of `task.deadline`. All old deadline-based helpers are deleted. `created_at` already flows through `SELECT *` in `src/lib/api.js`, so no API or schema changes are needed.

**Tech Stack:** JavaScript · Jest (fake timers) · React

---

## File Map

| File | Change |
|------|--------|
| `src/utils/sgt.js` | Delete `currentSGTHour()`, replace `urgencyClass(deadline)` with `urgencyClass(createdAt)` |
| `src/__tests__/sgt.test.js` | Replace all `urgencyClass` tests with creation-time-based tests |
| `src/components/TaskItem.jsx` | Change `urgencyClass(task.deadline)` → `urgencyClass(task.created_at)` |

---

### Task 1: Replace `urgencyClass` in `sgt.js` and update tests

**Files:**
- Modify: `src/utils/sgt.js`
- Modify: `src/__tests__/sgt.test.js`

- [ ] **Step 1: Write failing tests**

Replace the entire contents of `src/__tests__/sgt.test.js`:

```js
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
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test -- --testPathPattern=src/__tests__/sgt
```

Expected: multiple failures because `urgencyClass` still uses the old deadline-based logic.

- [ ] **Step 3: Replace `sgt.js` implementation**

Replace the entire contents of `src/utils/sgt.js`:

```js
/**
 * Returns today's date string in YYYY-MM-DD format using Singapore Time (UTC+8).
 */
export function todaySGT() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Singapore' })
}

/**
 * Returns urgency CSS class for a pending task based on how long ago it was created.
 * Yellow after 2 hours, red after 4 hours. Applies to all pending tasks.
 * @param {string|null|undefined} createdAt - ISO timestamp string
 * @returns {'' | 'urgency-yellow' | 'urgency-red'}
 */
export function urgencyClass(createdAt) {
  if (!createdAt) return ''
  const ageMs = Date.now() - new Date(createdAt).getTime()
  if (ageMs >= 4 * 60 * 60 * 1000) return 'urgency-red'
  if (ageMs >= 2 * 60 * 60 * 1000) return 'urgency-yellow'
  return ''
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
npm test -- --testPathPattern=src/__tests__/sgt
```

Expected: all 8 tests pass (1 `todaySGT` + 7 `urgencyClass`).

- [ ] **Step 5: Commit**

```bash
git add src/utils/sgt.js src/__tests__/sgt.test.js
git commit -m "feat: urgency based on task age (2h yellow, 4h red)"
```

---

### Task 2: Update `TaskItem.jsx` to pass `created_at`

**Files:**
- Modify: `src/components/TaskItem.jsx:13`

- [ ] **Step 1: Change the urgency call**

In `src/components/TaskItem.jsx`, find line 13:

```js
  const urgency = urgencyClass(task.deadline)
```

Change to:

```js
  const urgency = urgencyClass(task.created_at)
```

No other changes to this file.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass. No test directly tests `TaskItem` with urgency, but the sgt tests confirm the logic is correct.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev` and open `http://localhost:3847`. Create a task. It should have no highlight initially. (To test the colours without waiting 2h, temporarily change the thresholds in `sgt.js` to 1 minute and 2 minutes, verify highlights appear, then revert.)

- [ ] **Step 4: Commit**

```bash
git add src/components/TaskItem.jsx
git commit -m "fix: pass created_at to urgencyClass in TaskItem"
```
