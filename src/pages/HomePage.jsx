import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getRaces } from '../api/f1'
import useFetch from '../hooks/useFetch'
import { CURRENT_SEASON } from '../utils/constants'
import { formatDate } from '../utils/format'
import { addRoundNumbers, getRaceStatus } from '../utils/race'
import Countdown from '../components/Countdown'
import ErrorMessage from '../components/ErrorMessage'
import RaceCard from '../components/RaceCard'
import SeasonSelect from '../components/SeasonSelect'
import Skeleton from '../components/Skeleton'
import '../styles/home.css'

export default function HomePage() {
  // The season lives in the URL (?season=2024), so refreshing or sharing the link keeps it.
  const [searchParams, setSearchParams] = useSearchParams()
  const season = Number(searchParams.get('season')) || CURRENT_SEASON
  const [search, setSearch] = useState('')

  const { data, loading, error, retry } = useFetch(() => getRaces(season), [season])
  const races = data ? addRoundNumbers(data) : []

  // "Derived state": calculated from existing data on each render instead of stored in useState.
  const nextRace = races.find((race) => getRaceStatus(race) === 'upcoming')
  const lastRace = races.findLast((race) => getRaceStatus(race) === 'finished')

  const query = search.trim().toLowerCase()
  const visibleRaces = races.filter((race) =>
    `${race.country_name} ${race.circuit_short_name} ${race.location}`.toLowerCase().includes(query),
  )

  return (
    <div>
      <section className="hero">
        <div>
          <p className="eyebrow">Formula 1 · {season} season</p>
          <h1 className="hero__title">
            Every race,
            <br />
            <span>lap by lap.</span>
          </h1>
          <p className="hero__text">
            Replay races live, compare drivers' telemetry corner by corner, and dig into every
            practice, qualifying and race session since 2023.
          </p>
          {lastRace && (
            <Link to={`/session/${lastRace.session_key}`} className="button">
              Latest race: {lastRace.country_name} →
            </Link>
          )}
        </div>

        {nextRace && (
          <div className="next-race">
            <p className="eyebrow">Next race</p>
            <h2>{nextRace.country_name}</h2>
            <p className="muted">
              {nextRace.circuit_short_name} · {formatDate(nextRace.date_start)}
            </p>
            <Countdown targetDate={nextRace.date_start} />
          </div>
        )}
      </section>

      <div className="section-header">
        <h2>Race calendar</h2>
        <div className="filters">
          <input
            className="search"
            type="search"
            placeholder="Search country or circuit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search races"
          />
          <SeasonSelect value={season} onChange={(year) => setSearchParams({ season: year })} />
        </div>
      </div>

      {loading ? (
        <div className="race-grid">
          <Skeleton rows={8} height={150} />
        </div>
      ) : error ? (
        <ErrorMessage error={error} onRetry={retry} />
      ) : visibleRaces.length === 0 ? (
        <p className="empty-state">No races match “{search}”.</p>
      ) : (
        <div className="race-grid">
          {visibleRaces.map((race) => (
            <RaceCard key={race.session_key} race={race} />
          ))}
        </div>
      )}
    </div>
  )
}
