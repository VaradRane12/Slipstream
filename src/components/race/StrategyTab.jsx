import { useState } from 'react'
import { getStints } from '../../api/f1'
import useFetch from '../../hooks/useFetch'
import { TYRE_COLORS } from '../../utils/constants'
import { teamColor } from '../../utils/format'
import ErrorMessage from '../ErrorMessage'
import Skeleton from '../Skeleton'

// This chart is plain HTML + CSS (no chart library).
// Each stint is a box whose left position and width are percentages of the race distance.
export default function StrategyTab({ sessionKey, drivers, results }) {
  const { data: stints, loading, error, retry } = useFetch(() => getStints(sessionKey), [sessionKey])
  const [activeStint, setActiveStint] = useState(null)

  if (loading) return <Skeleton rows={10} height={28} />
  if (error) return <ErrorMessage error={error} onRetry={retry} />
  if (!stints.length) return <p className="muted">No tyre data for this race.</p>

  const totalLaps = Math.max(
    ...stints.map((s) => s.lap_end ?? 0),
    ...results.map((r) => r.number_of_laps ?? 0),
  )
  const percent = (laps) => `${(laps / totalLaps) * 100}%`
  const lapMarkers = Array.from({ length: Math.floor(totalLaps / 10) }, (_, i) => (i + 1) * 10)

  return (
    <div>
      <div className="tab-toolbar">
        <p className="muted">Hover or tab through a stint to see its details.</p>
        <div className="tyre-legend">
          {Object.entries(TYRE_COLORS).map(([compound, color]) => (
            <span key={compound}>
              <span className="tyre-dot" style={{ background: color }} />
              {compound.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="stint-info" aria-live="polite">
        {activeStint ? (
          <>
            <strong>{activeStint.driver.name_acronym}</strong> · Stint {activeStint.stint_number} ·{' '}
            {activeStint.compound ?? 'Unknown'} · Laps {activeStint.lap_start}–{activeStint.lap_end} (
            {activeStint.lap_end - activeStint.lap_start + 1} laps)
            {activeStint.tyre_age_at_start > 0 && ` · used tyres (${activeStint.tyre_age_at_start} laps old)`}
          </>
        ) : (
          <span className="muted">No stint selected</span>
        )}
      </div>

      <div className="strategy">
        <div className="strategy__axis">
          {lapMarkers.map((lap) => (
            <span key={lap} style={{ left: percent(lap) }}>
              {lap}
            </span>
          ))}
        </div>

        {drivers.map((driver) => {
          const driverStints = stints
            .filter((s) => s.driver_number === driver.driver_number && s.lap_end)
            .sort((a, b) => a.stint_number - b.stint_number)
          const stops = Math.max(0, driverStints.length - 1)

          return (
            <div key={driver.driver_number} className="strategy__row">
              <span className="strategy__driver">
                <span className="team-bar" style={{ background: teamColor(driver.team_colour) }} />
                {driver.name_acronym}
              </span>
              <div className="strategy__track">
                {driverStints.map((stint) => (
                  <button
                    key={stint.stint_number}
                    className="stint"
                    style={{
                      left: percent(stint.lap_start - 1),
                      width: percent(stint.lap_end - stint.lap_start + 1),
                      '--tyre-color': TYRE_COLORS[stint.compound] ?? '#777',
                    }}
                    onMouseEnter={() => setActiveStint({ ...stint, driver })}
                    onFocus={() => setActiveStint({ ...stint, driver })}
                    aria-label={`${driver.name_acronym} stint ${stint.stint_number}: ${stint.compound}, laps ${stint.lap_start} to ${stint.lap_end}`}
                  >
                    {stint.compound?.[0]}
                  </button>
                ))}
              </div>
              <span className="strategy__stops muted">
                {stops} {stops === 1 ? 'stop' : 'stops'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
