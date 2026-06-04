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
