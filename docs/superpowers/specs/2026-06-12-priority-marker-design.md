# Priority Marker — Design Spec

**Date:** 2026-06-12

## Goal

Add a per-task priority toggle that floats the task to the top of the list, starts a 2-hour countdown, and visually escalates (yellow → blinking red) if not completed in time. Remove all existing age-based urgency highlighting. Add tooltips to all task controls.

---

## Behaviour Summary

| State | Row background | Priority marker | Tooltip on marker |
|-------|---------------|-----------------|-------------------|
| `priority=0` | `bg-gray-800` | Grey flag ⚑ | "Set priority" |
| `priority=1`, age < 2h | `bg-yellow-300` | Yellow flag ⚑ | "Remove priority" |
| `priority=1`, age ≥ 2h | `bg-red-100` | Blinking red flag ⚑ | "Remove priority — overdue!" |

**Toggle on:** task floats to top of pending list, timer starts from `priority_set_at`.
**Toggle off:** task drops back to its natural `position` slot, timer cleared, no highlight.
**Resolved by:** removing priority, deleting task, or marking complete — all stop blinking.

---

## Data Layer

### Schema migration (both SQLite paths)

Add two columns to `tasks`:

```sql
ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN priority_set_at TEXT;
```

- `priority`: `0` = normal, `1` = prioritised
- `priority_set_at`: ISO timestamp set when `priority` toggled on; `NULL` when off

**server/db.js:** Add `ALTER TABLE` statements guarded by column-existence check (SQLite does not support `IF NOT EXISTS` on `ALTER TABLE` — use `PRAGMA table_info` check or wrap in try/catch).

**src-tauri/src/lib.rs:** Add version 2 migration:
```rust
Migration {
    version: 2,
    description: "add_priority",
    sql: "ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0; ALTER TABLE tasks ADD COLUMN priority_set_at TEXT;",
    kind: MigrationKind::Up,
}
```

---

## Priority State Logic

**`src/utils/sgt.js`** — replace `urgencyClass` with `priorityState`:

```js
/**
 * Returns priority state for a pending task.
 * @param {number} priority - 0 or 1
 * @param {string|null} prioritySetAt - ISO timestamp when priority was set
 * @returns {'' | 'priority-yellow' | 'priority-red'}
 */
export function priorityState(priority, prioritySetAt) {
  if (!priority || !prioritySetAt) return ''
  const ageMs = Date.now() - new Date(prioritySetAt).getTime()
  if (ageMs >= 2 * 60 * 60 * 1000) return 'priority-red'
  return 'priority-yellow'
}
```

`todaySGT()` is retained (used by deadline date picker).
`urgencyClass` is deleted.

---

## API Layer

### `src/lib/api.js` — add `togglePriority`

```js
export async function togglePriority(id, priorityOn) {
  const changes = priorityOn
    ? { priority: 1, priority_set_at: nowSGT() }
    : { priority: 0, priority_set_at: null }

  if (isTauri()) {
    const db = await getDB()
    await db.execute(
      'UPDATE tasks SET priority=$1, priority_set_at=$2 WHERE id=$3',
      [changes.priority, changes.priority_set_at, id]
    )
    return
  }
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  if (!res.ok) throw new Error('Failed to toggle priority')
}
```

### `server/routes/tasks.js` — update PATCH handler

Add `priority` and `priority_set_at` to the fields merged in `PATCH /:id`:

```js
const { text, deadline, completed, completed_at, position, priority, priority_set_at } = req.body
const updated = {
  ...existing fields...,
  priority: priority !== undefined ? priority : task.priority,
  priority_set_at: priority_set_at !== undefined ? priority_set_at : task.priority_set_at,
}
// UPDATE query must include priority, priority_set_at columns
```

### `src/hooks/useTasks.js` — add `togglePriority`

```js
async function togglePriority(id) {
  const task = (data || []).find(t => t.id === id)
  if (!task) return
  await apiTogglePriority(id, !task.priority)
  await mutate()
}
// expose in return object
```

---

## List Sorting

**`src/components/TaskList.jsx`** — sort pending tasks before render:

```js
const sorted = [
  ...tasks.filter(t => t.priority).sort((a, b) =>
    new Date(b.priority_set_at) - new Date(a.priority_set_at)
  ),
  ...tasks.filter(t => !t.priority),
]
```

Non-priority tasks retain their existing `position`-based order (already sorted server-side). Priority tasks appear above them, most recently prioritised first.

**dnd-kit drag-and-drop** operates on `sorted` array. Dragging a priority task reorders among priority tasks; dragging non-priority reorders among non-priority. (Existing `onReorder` only updates `position`, not `priority` — no change needed.)

---

## UI — `src/components/TaskItem.jsx`

### Remove
- Import of `urgencyClass` from `sgt.js`
- All `urgencyBg` / `textColor` urgency logic

### Add
- Import `priorityState` from `@/utils/sgt`
- Compute `const pState = priorityState(task.priority, task.priority_set_at)`
- Row background and text colour driven by `pState`:
  ```js
  const rowBg = pState === 'priority-yellow' ? 'bg-yellow-300 border-yellow-400'
              : pState === 'priority-red'    ? 'bg-red-100 border-red-300'
              : 'bg-gray-800 border-gray-700'
  const textColor = pState ? 'text-gray-800' : 'text-gray-100'
  ```

### Priority marker button (insert before ✓ button)
```jsx
<button
  onClick={() => onTogglePriority(task.id)}
  title={
    pState === 'priority-red' ? 'Remove priority — overdue!' :
    pState === 'priority-yellow' ? 'Remove priority' :
    'Set priority'
  }
  className={[
    'text-sm px-1',
    pState === 'priority-red'    ? 'text-red-500 animate-pulse' :
    pState === 'priority-yellow' ? 'text-yellow-600' :
    'text-gray-500 hover:text-yellow-400',
  ].join(' ')}
>⚑</button>
```

### Tooltips on all controls (add/update `title` attribute)
| Control | Tooltip |
|---------|---------|
| Drag handle ⠿ | "Drag to reorder" (already exists) |
| Task text | "Click to edit" |
| Date field | "Set deadline" |
| Priority ⚑ | Dynamic (see above) |
| ✓ | "Mark complete" (already exists) |
| 🗑 | "Delete task" (already exists) |

---

## Removed

- `urgencyClass` function and all references (`sgt.js`, `TaskItem.jsx`, tests)
- Age-based row colouring (the 2h/4h since creation logic)

---

## Testing

**`src/__tests__/sgt.test.js`** — replace `urgencyClass` tests with `priorityState` tests:
- `priority=0` → `''`
- `priority=1`, `prioritySetAt=null` → `''`
- `priority=1`, age < 2h → `'priority-yellow'`
- `priority=1`, age = exactly 2h → `'priority-red'`
- `priority=1`, age > 2h → `'priority-red'`

**`server/__tests__/tasks.test.js`** — add tests for PATCH with `priority` / `priority_set_at` fields.
