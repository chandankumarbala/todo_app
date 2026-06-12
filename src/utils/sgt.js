/**
 * Returns today's date string in YYYY-MM-DD format using Singapore Time (UTC+8).
 */
export function todaySGT() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Singapore' })
}

/**
 * Returns 0–100 fill percentage based on elapsed time since prioritySetAt.
 * Fills over 2 hours (7200000ms). Returns 0 if priority is off or timestamp missing.
 * @param {number} priority - 0 or 1
 * @param {string|null} prioritySetAt - ISO timestamp string
 * @param {number} now - current time in ms (default: Date.now())
 * @returns {number} 0–100
 */
export function priorityProgress(priority, prioritySetAt, now = Date.now()) {
  if (!priority || !prioritySetAt) return 0
  const elapsed = now - new Date(prioritySetAt).getTime()
  if (isNaN(elapsed) || elapsed < 0) return 0
  return Math.min(100, (elapsed / 7_200_000) * 100)
}

/**
 * Returns row/circle display state based on priority timer.
 * @param {number} priority - 0 or 1
 * @param {string|null} prioritySetAt - ISO timestamp string
 * @param {number} now - current time in ms (default: Date.now())
 * @returns {'' | 'priority-yellow' | 'priority-red'}
 */
export function priorityState(priority, prioritySetAt, now = Date.now()) {
  if (!priority || !prioritySetAt) return ''
  return priorityProgress(priority, prioritySetAt, now) >= 100 ? 'priority-red' : 'priority-yellow'
}
