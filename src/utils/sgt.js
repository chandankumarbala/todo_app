/**
 * Returns today's date string in YYYY-MM-DD format using Singapore Time (UTC+8).
 */
export function todaySGT() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Singapore' })
}

/**
 * Returns current SGT hour (0-23).
 */
export function currentSGTHour() {
  const sgtDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' }))
  return sgtDate.getHours()
}

/**
 * Returns urgency CSS class for a pending task based on deadline and current SGT time.
 * @param {string|null} deadline - YYYY-MM-DD
 * @returns {'' | 'urgency-yellow' | 'urgency-red'}
 */
export function urgencyClass(deadline) {
  if (!deadline) return ''
  if (deadline !== todaySGT()) return ''
  const hour = currentSGTHour()
  if (hour >= 16) return 'urgency-red'
  if (hour >= 12) return 'urgency-yellow'
  return ''
}
