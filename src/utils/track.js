// Helpers for the car's position on track (used by the telemetry map and the live replay).
//
// OpenF1 sends the car's x / y position about 4 times per second.
// The units are 1/10 of a metre, but we only use them to draw, so the unit doesn't matter.

// Location samples → [{ x, y, time }], where time = seconds since the lap started.
export function toTrackPoints(locations, lapStart) {
  const startMs = new Date(lapStart).getTime()
  return locations
    .filter((p) => p.x !== 0 || p.y !== 0) // (0, 0) means "no signal"
    .map((p) => ({ x: p.x, y: p.y, time: (new Date(p.date).getTime() - startMs) / 1000 }))
    .sort((a, b) => a.time - b.time)
}

// Where was the car at this moment (seconds since lap start)?
// We only have a sample every ~0.25s, so we find the samples just before and after
// and blend between them ("linear interpolation").
export function pointAtTime(points, time) {
  if (points.length === 0) return null
  if (time <= points[0].time) return points[0]
  const last = points[points.length - 1]
  if (time >= last.time) return last

  // Binary search: halve the search range each step instead of checking every point.
  let low = 0
  let high = points.length - 1
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (points[middle].time <= time) low = middle
    else high = middle
  }

  const a = points[low]
  const b = points[high]
  const progress = (time - a.time) / (b.time - a.time) // 0 = at a, 1 = at b
  return {
    x: a.x + (b.x - a.x) * progress,
    y: a.y + (b.y - a.y) * progress,
  }
}

// The smallest box that contains every point, used to size the SVG.
export function getBounds(points) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}
