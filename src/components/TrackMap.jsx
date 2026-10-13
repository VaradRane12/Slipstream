import { useMemo } from 'react'
import { getBounds } from '../utils/track'

// Draws a circuit as an SVG from a list of { x, y } points.
//
// - points:        the shape of the track
// - segmentColors: optional colour for each piece of track (speed, gear, fastest driver...)
// - markers:       optional dots on top, e.g. cars: { id, x, y, color, label, highlighted }
export default function TrackMap({ points, segmentColors, markers = [], className = '' }) {
  // Working out the size of the track only needs to happen when the points change.
  const box = useMemo(() => {
    const { minX, maxX, minY, maxY } = getBounds(points)
    const size = Math.max(maxX - minX, maxY - minY)
    const padding = size * 0.06
    return {
      // SVG's y axis points down, the track data's y axis points up, so we flip y (use -y).
      viewBox: `${minX - padding} ${-maxY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`,
      dotRadius: size * 0.013,
    }
  }, [points])

  if (points.length < 2) return null

  const outline = points.map((p) => `${p.x},${-p.y}`).join(' ')

  return (
    <svg className={`track-map ${className}`} viewBox={box.viewBox} role="img" aria-label="Track map">
      {/* vectorEffect keeps the line width in screen pixels, whatever the track's size */}
      <polyline className="track-map__outline" points={outline} vectorEffect="non-scaling-stroke" />

      {segmentColors
        ? points.slice(1).map((p, i) => (
            <line
              key={i}
              x1={points[i].x}
              y1={-points[i].y}
              x2={p.x}
              y2={-p.y}
              stroke={segmentColors[i]}
              className="track-map__segment"
              vectorEffect="non-scaling-stroke"
            />
          ))
        : (
          <polyline className="track-map__line" points={outline} vectorEffect="non-scaling-stroke" />
        )}

      {/* Start / finish line marker */}
      <circle className="track-map__start" cx={points[0].x} cy={-points[0].y} r={box.dotRadius * 0.6} />

      {markers.map((m) => (
        <g
          key={m.id}
          transform={`translate(${m.x} ${-m.y})`}
          className={`track-map__marker ${m.highlighted ? 'is-highlighted' : ''} ${m.dimmed ? 'is-dimmed' : ''}`}
        >
          <circle r={box.dotRadius * (m.highlighted ? 1.5 : 1)} fill={m.color} />
          {m.label && (
            <text x={box.dotRadius * 1.6} y={box.dotRadius * 0.6} fontSize={box.dotRadius * 2.2}>
              {m.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
