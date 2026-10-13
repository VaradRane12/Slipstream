import { formatGap, formatLapTime, formatRaceTime, teamColor } from '../../utils/format'
import { getResultStatus } from '../../utils/race'

// Podium order on screen: P2 on the left, P1 in the middle (tallest), P3 on the right.
const PODIUM_ORDER = [1, 0, 2]

// Each session type shows different columns.
// Race:        laps, total time (winner) or gap, points
// Qualifying:  best time in Q1, Q2 and Q3 (the API sends these as a list of 3)
// Practice:    best lap, gap to the fastest, laps
// showsStatus: this column shows DNF / DNS / DSQ instead of a time when that applies.
// (Qualifying has no such column: a driver can set a Q1 time and then retire,
// so there the status goes next to the name instead.)
const COLUMNS = {
  race: [
    { label: 'Laps', render: (r) => r.number_of_laps },
    { label: 'Time / Gap', render: (r) => (r.position === 1 ? formatRaceTime(r.duration) : formatGap(r.gap_to_leader)), mono: true, showsStatus: true },
    { label: 'Pts', render: (r) => <strong>{r.points || ''}</strong> },
  ],
  qualifying: [
    { label: 'Q1', render: (r) => formatLapTime(r.duration?.[0]), mono: true },
    { label: 'Q2', render: (r) => formatLapTime(r.duration?.[1]), mono: true },
    { label: 'Q3', render: (r) => formatLapTime(r.duration?.[2]), mono: true },
    { label: 'Laps', render: (r) => r.number_of_laps, hideMobile: true },
  ],
  practice: [
    { label: 'Best lap', render: (r) => formatLapTime(r.duration), mono: true, showsStatus: true },
    { label: 'Gap', render: (r) => (r.position === 1 ? '' : formatGap(r.gap_to_leader)), mono: true },
    { label: 'Laps', render: (r) => r.number_of_laps },
  ],
}

export default function ResultsTab({ results, driverMap, kind }) {
  const columns = COLUMNS[kind]
  const hasStatusColumn = columns.some((col) => col.showsStatus)
  const podium = results.slice(0, 3)

  return (
    <div className="results-tab">
      {podium.length === 3 && (
        <div className="podium">
          {PODIUM_ORDER.map((index) => {
            const result = podium[index]
            const driver = driverMap[result.driver_number]
            return (
              <div
                key={result.driver_number}
                className={`podium__step podium__step--p${result.position}`}
                style={{ '--team-color': teamColor(driver?.team_colour) }}
              >
                {driver?.headshot_url ? (
                  <img className="podium__photo" src={driver.headshot_url} alt="" loading="lazy" />
                ) : (
                  <div className="podium__photo podium__photo--empty">{driver?.name_acronym}</div>
                )}
                <div className="podium__block">
                  <span className="podium__position">P{result.position}</span>
                  <span className="podium__name">{driver?.last_name ?? result.driver_number}</span>
                  <span className="podium__team">{driver?.team_name}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* The wrapper scrolls sideways on small screens instead of squashing the table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Driver</th>
              <th className="hide-mobile">Team</th>
              {columns.map((col) => (
                <th key={col.label} className={`num ${col.hideMobile ? 'hide-mobile' : ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const driver = driverMap[result.driver_number]
              const status = getResultStatus(result)
              return (
                <tr key={result.driver_number}>
                  <td className="table__pos">{result.position ?? '–'}</td>
                  <td>
                    <span
                      className="team-bar"
                      style={{ background: teamColor(driver?.team_colour) }}
                    />
                    <strong>{driver?.full_name ?? `#${result.driver_number}`}</strong>{' '}
                    <span className="muted">{driver?.name_acronym}</span>
                    {status && !hasStatusColumn && <span className="badge badge--cancelled">{status}</span>}
                  </td>
                  <td className="hide-mobile muted">{driver?.team_name}</td>
                  {columns.map((col) =>
                    status && col.showsStatus ? (
                      <td key={col.label} className="num">
                        <span className="badge badge--cancelled">{status}</span>
                      </td>
                    ) : (
                      <td
                        key={col.label}
                        className={`num ${col.mono ? 'mono' : ''} ${col.hideMobile ? 'hide-mobile' : ''}`}
                      >
                        {col.render(result)}
                      </td>
                    ),
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
