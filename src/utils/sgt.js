/**
 * Returns today's date string in YYYY-MM-DD format using Singapore Time (UTC+8).
 */
export function todaySGT() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Singapore' })
}

/**
 * Returns priority display state for a pending task.
 * @param {number} priority - 0 or 1
 * @param {string|null|undefined} prioritySetAt - ISO timestamp when priority was set
 * @returns {'' | 'priority-yellow' | 'priority-red'}
 */
export function priorityState(priority, prioritySetAt) {
  if (priority !== 1 || !prioritySetAt) return ''
  const ageMs = Date.now() - new Date(prioritySetAt).getTime()
  if (isNaN(ageMs)) return ''
  if (ageMs >= 2 * 60 * 60 * 1000) return 'priority-red'
  return 'priority-yellow'
}
