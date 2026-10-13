// Grey placeholder blocks shown while data is loading.
// They feel faster than a spinner because the page already has its shape.
export default function Skeleton({ rows = 4, height = 56 }) {
  return (
    <div className="skeleton-list" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  )
}
