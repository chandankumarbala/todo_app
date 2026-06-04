# Task Urgency Highlight — Design Spec

**Date:** 2026-06-05

## Goal

Replace deadline-based urgency colouring with creation-time-based urgency colouring. All pending tasks highlight yellow after 2 hours since creation, red after 4 hours. Deadline field has no effect on highlight colour.

## Current Behaviour (removed)

- `urgencyClass(deadline)` in `src/utils/sgt.js`
- Only highlights tasks where `deadline == today` in SGT
- Yellow if current SGT hour ≥ 12, red if ≥ 16
- `currentSGTHour()` helper used only by this function

## New Behaviour

| Age since `created_at` | Highlight |
|------------------------|-----------|
| < 2 hours              | none      |
| ≥ 2 hours              | yellow    |
| ≥ 4 hours              | red       |

- Applies to **all pending tasks** regardless of deadline
- `created_at` already stored as ISO timestamp in SQLite tasks table
- Age computed in JS: `Date.now() - new Date(createdAt).getTime()`
- No schema change required

## Files Changed

### `src/utils/sgt.js`
- **Delete** `currentSGTHour()` — no longer needed
- **Replace** `urgencyClass(deadline)` with `urgencyClass(createdAt)`:

```js
export function urgencyClass(createdAt) {
  if (!createdAt) return ''
  const ageMs = Date.now() - new Date(createdAt).getTime()
  if (ageMs >= 4 * 60 * 60 * 1000) return 'urgency-red'
  if (ageMs >= 2 * 60 * 60 * 1000) return 'urgency-yellow'
  return ''
}
```

### `src/components/TaskItem.jsx`
- Change `urgencyClass(task.deadline)` → `urgencyClass(task.created_at)`
- No other changes

### `src/hooks/useTasks.js` / API layer
- Confirm `created_at` is included in SELECT and passed through to component
- If missing from API response, add it — no schema migration needed

## Out of Scope

- Live re-render tick (urgency updates on next user interaction / re-render, not on a timer)
- Completed tasks (no urgency colouring on completed items — unchanged)
