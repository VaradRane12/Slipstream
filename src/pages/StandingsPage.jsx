import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getConstructorStandings, getDriverStandings } from '../api/f1'
import useFetch from '../hooks/useFetch'
import { CONSTRUCTOR_COLORS, CURRENT_SEASON } from '../utils/constants'
import ErrorMessage from '../components/ErrorMessage'
import SeasonSelect from '../components/SeasonSelect'
import Skeleton from '../components/Skeleton'
import '../styles/standings.css'

// The two APIs return differently shaped rows. These functions turn both into
// the same simple shape, so one list component can draw either of them.
function toDriverRow(row) {
  const team = row.Constructors.at(-1) // a driver who switched teams lists all of them
  return {
    id: row.Driver.driverId,
    position: row.position ?? row.positionText,
    name: `${row.Driver.givenName} ${row.Driver.familyName}`,
    subtitle: team?.name,
    color: CONSTRUCTOR_COLORS[team?.constructorId],
    points: Number(row.points),
    wins: Number(row.wins),
  }
}

function toTeamRow(row) {
  return {
    id: row.Constructor.constructorId,
    position: row.position ?? row.positionText,
    name: row.Constructor.name,
    subtitle: row.Constructor.nationality,
    color: CONSTRUCTOR_COLORS[row.Constructor.constructorId],
    points: Number(row.points),
    wins: Number(row.wins),
  }
}

export default function StandingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const season = Number(searchParams.get('season')) || CURRENT_SEASON
  const [view, setView] = useState('drivers')

  const { data, loading, error, retry } = useFetch(
    () => (view === 'drivers' ? getDriverStandings(season) : getConstructorStandings(season)),
    [season, view],
  )

  const rows = data ? data.rows.map(view === 'drivers' ? toDriverRow : toTeamRow) : []
  const leaderPoints = rows[0]?.points || 1

  return (
    <div>
      <div className="section-header">
        <div>
          <p className="eyebrow">{data?.round ? `After round ${data.round}` : 'Championship'}</p>
          <h1>{season} Standings</h1>
        </div>
        <div className="filters">
          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={view === 'drivers'} onClick={() => setView('drivers')}>
              Drivers
            </button>
            <button
              role="tab"
              aria-selected={view === 'constructors'}
              onClick={() => setView('constructors')}
            >
              Constructors
            </button>
          </div>
          <SeasonSelect value={season} onChange={(year) => setSearchParams({ season: year })} />
        </div>
      </div>

      {loading ? (
        <Skeleton rows={10} height={64} />
      ) : error ? (
        <ErrorMessage error={error} onRetry={retry} />
      ) : rows.length === 0 ? (
        <p className="empty-state">No standings yet for {season}.</p>
      ) : (
        <ol className="standings">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="standings__row"
              style={{ '--team-color': row.color ?? '#888', '--delay': `${index * 30}ms` }}
            >
              <span className="standings__pos">{row.position}</span>
              <div className="standings__main">
                <div className="standings__names">
                  <strong>{row.name}</strong>
                  <span className="muted">{row.subtitle}</span>
                </div>
                {/* Bar length = points compared with the leader */}
                <div className="standings__bar">
                  <span style={{ width: `${(row.points / leaderPoints) * 100}%` }} />
                </div>
              </div>
              <span className="standings__wins muted hide-mobile">
                {row.wins} {row.wins === 1 ? 'win' : 'wins'}
              </span>
              <span className="standings__points">
                {row.points}
                <small>PTS</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
