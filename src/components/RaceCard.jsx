import { Link } from 'react-router-dom'
import { formatDate } from '../utils/format'
import { getRaceStatus } from '../utils/race'

const STATUS_LABELS = {
  finished: 'Results',
  live: 'Live',
  upcoming: 'Upcoming',
  cancelled: 'Cancelled',
}

export default function RaceCard({ race }) {
  const status = getRaceStatus(race)

  const content = (
    <>
      <div className="race-card__top">
        <span className="race-card__round">{race.round ? `Round ${race.round}` : '–'}</span>
        <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>
      </div>
      <h3 className="race-card__country">{race.country_name}</h3>
      <p className="muted">{race.circuit_short_name}</p>
      <p className="race-card__date">{formatDate(race.date_start)}</p>
    </>
  )

  // Only finished races have data to show, so only they are links.
  if (status === 'finished') {
    return (
      <Link to={`/session/${race.session_key}`} className="race-card race-card--link">
        {content}
      </Link>
    )
  }
  return <div className={`race-card race-card--${status}`}>{content}</div>
}
