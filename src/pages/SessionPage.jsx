import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getDrivers, getMeeting, getResults, getSession, getWeekendSessions } from '../api/f1'
import useFetch from '../hooks/useFetch'
import { formatDate } from '../utils/format'
import {
  buildDriverMap,
  buildLineStyles,
  getSessionKind,
  getSessionLabel,
  hasStarted,
  sortResults,
} from '../utils/race'
import ErrorMessage from '../components/ErrorMessage'
import Skeleton from '../components/Skeleton'
import ResultsTab from '../components/race/ResultsTab'
import ReplayTab from '../components/race/ReplayTab'
import PositionsTab from '../components/race/PositionsTab'
import LapTimesTab from '../components/race/LapTimesTab'
import TelemetryTab from '../components/race/TelemetryTab'
import StrategyTab from '../components/race/StrategyTab'
import '../styles/race.css'

// Which tabs each kind of session gets. Positions and the replay only make sense
// for races, where everyone is on track at the same time racing each other.
const TABS = [
  { id: 'results', label: 'Results', kinds: ['race', 'qualifying', 'practice'] },
  { id: 'replay', label: 'Live Replay', kinds: ['race'] },
  { id: 'positions', label: 'Positions', kinds: ['race'] },
  { id: 'laps', label: 'Lap Times', kinds: ['race', 'qualifying', 'practice'] },
  { id: 'telemetry', label: 'Telemetry', kinds: ['race', 'qualifying', 'practice'] },
  { id: 'strategy', label: 'Tyres', kinds: ['race', 'qualifying', 'practice'] },
]

async function loadSession(sessionKey) {
  const session = await getSession(sessionKey)
  const [drivers, results, weekend, meeting] = await Promise.all([
    getDrivers(sessionKey),
    getResults(sessionKey),
    getWeekendSessions(session.meeting_key),
    getMeeting(session.meeting_key),
  ])
  return { session, drivers, results, weekend, meeting }
}

export default function SessionPage() {
  // Reads ":sessionKey" from the URL /session/:sessionKey
  const { sessionKey } = useParams()
  // The open tab is kept in the URL (?tab=telemetry), so you can share or refresh it.
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, loading, error, retry } = useFetch(() => loadSession(sessionKey), [sessionKey])

  if (loading) return <Skeleton rows={6} height={64} />
  if (error) return <ErrorMessage error={error} onRetry={retry} />

  const { session, drivers: driverList, results: rawResults, weekend, meeting } = data
  const kind = getSessionKind(session)
  const driverMap = buildDriverMap(driverList)
  const results = sortResults(rawResults)

  // Drivers in finishing order, used by the charts and pickers.
  const drivers = results.map((r) => driverMap[r.driver_number]).filter(Boolean)
  const lineStyles = buildLineStyles(drivers)

  const tabs = TABS.filter((tab) => tab.kinds.includes(kind))
  const requestedTab = searchParams.get('tab')
  const activeTab = tabs.some((t) => t.id === requestedTab) ? requestedTab : 'results'

  // The same props go to every chart tab, so collect them once.
  const tabProps = { sessionKey, drivers, driverMap, lineStyles, kind }

  return (
    <div>
      <Link to={`/?season=${session.year}`} className="back-link">
        ← {session.year} calendar
      </Link>

      <header className="race-header">
        <p className="eyebrow">
          {session.year} · {session.circuit_short_name} · {formatDate(session.date_start)}
        </p>
        <h1>{meeting?.meeting_name ?? session.country_name}</h1>
      </header>

      {/* Weekend switcher: every session of this Grand Prix */}
      <nav className="session-switcher" aria-label="Sessions this weekend">
        {weekend.map((s) => {
          if (!hasStarted(s)) {
            return (
              <span key={s.session_key} className="session-pill is-disabled">
                {getSessionLabel(s)}
              </span>
            )
          }
          return (
            <Link
              key={s.session_key}
              to={`/session/${s.session_key}?tab=${activeTab}`}
              className={`session-pill ${s.session_key === session.session_key ? 'is-active' : ''}`}
              aria-current={s.session_key === session.session_key ? 'page' : undefined}
            >
              {getSessionLabel(s)}
            </Link>
          )
        })}
      </nav>

      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tabs__tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setSearchParams({ tab: tab.id }, { replace: true })}
          >
            {tab.id === 'replay' && <span className="live-dot" />}
            {tab.label}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="empty-state">No data for this session yet.</p>
      ) : (
        // Conditional rendering: only the active tab is on the page (and loads data).
        // key={sessionKey} gives each session a fresh tab, so old selections don't carry over.
        <section className="tab-panel" role="tabpanel" key={sessionKey}>
          {activeTab === 'results' && <ResultsTab results={results} driverMap={driverMap} kind={kind} />}
          {activeTab === 'replay' && <ReplayTab sessionKey={sessionKey} drivers={drivers} results={results} />}
          {activeTab === 'positions' && <PositionsTab {...tabProps} />}
          {activeTab === 'laps' && <LapTimesTab {...tabProps} />}
          {activeTab === 'telemetry' && <TelemetryTab {...tabProps} />}
          {activeTab === 'strategy' && <StrategyTab {...tabProps} results={results} />}
        </section>
      )}
    </div>
  )
}
