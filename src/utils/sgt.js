/**
 * Returns today's date string in YYYY-MM-DD format using Singapore Time (UTC+8).
 */
export function todaySGT() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Singapore' })
}

/**
 * Returns progress display state for a pending task.
 * @param {number} progress - 0, 20, 40, 60, 80, or 100
 * @returns {'' | 'progress-yellow' | 'progress-red'}
 */
export function progressState(progress) {
  if (!progress || progress <= 0) return ''
  if (progress >= 100) return 'progress-red'
  return 'progress-yellow'
}

const PROGRESS_STEPS = [0, 20, 40, 60, 80, 100]

/**
 * Returns the next progress step after current (wraps 100 → 0).
 * @param {number} current - current progress value
 * @returns {number} next step
 */
export function nextProgress(current) {
  const idx = PROGRESS_STEPS.indexOf(current)
  if (idx === -1) return 0
  return PROGRESS_STEPS[(idx + 1) % PROGRESS_STEPS.length]
}
