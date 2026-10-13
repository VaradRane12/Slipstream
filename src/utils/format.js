// Small helpers that turn raw API values into text for the screen.

// 83.456 → "1:23.456"
export function formatLapTime(seconds) {
  if (seconds == null) return '–'
  const minutes = Math.floor(seconds / 60)
  const rest = (seconds % 60).toFixed(3).padStart(6, '0')
  return `${minutes}:${rest}`
}

// 6126.304 → "1:42:06.304"
export function formatRaceTime(seconds) {
  if (seconds == null) return '–'
  const hours = Math.floor(seconds / 3600)
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const rest = (seconds % 60).toFixed(3).padStart(6, '0')
  return `${hours}:${minutes}:${rest}`
}

// The API gives the gap as a number of seconds, or as text like "+1 LAP" for lapped cars.
export function formatGap(gap) {
  if (gap == null) return '–'
  if (typeof gap === 'number') return `+${gap.toFixed(3)}s`
  return gap
}

// "2025-03-16T04:00:00+00:00" → "16 Mar 2025"
export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// OpenF1 gives team colours without the "#", e.g. "3671C6".
export function teamColor(hex) {
  return hex ? `#${hex}` : '#888888'
}
