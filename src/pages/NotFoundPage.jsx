import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <p className="eyebrow">404</p>
      <h1>Wrong turn into the gravel.</h1>
      <p className="muted">This page doesn't exist.</p>
      <Link to="/" className="button">
        Back to the races
      </Link>
    </div>
  )
}
