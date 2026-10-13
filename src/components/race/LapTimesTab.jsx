import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getLaps } from '../../api/f1'
import useFetch from '../../hooks/useFetch'
import { formatLapTime } from '../../utils/format'
import { buildLapTimeRows, getLapStats } from '../../utils/race'
import DriverPicker from './DriverPicker'
import ErrorMessage from '../ErrorMessage'
import Skeleton from '../Skeleton'

export default function LapTimesTab({ sessionKey, drivers, driverMap, lineStyles, kind }) {
  const isRace = kind === 'race'
  // getLaps is cached in api/f1.js, so if the Positions tab already loaded the laps
  // this is instant: no second network request.
  const { data: laps, loading, error, retry } = useFetch(() => getLaps(sessionKey), [sessionKey])

  // Start by comparing the top two finishers.
  const [selected, setSelected] = useState(() => drivers.slice(0, 2).map((d) => d.driver_number))
  const [hideSlowLaps, setHideSlowLaps] = useState(true)

  const rows = useMemo(
    () => (laps ? buildLapTimeRows(laps, selected, hideSlowLaps, isRace) : []),
    [laps, selected, hideSlowLaps, isRace],
  )

  function toggleDriver(number) {
    setSelected((current) =>
      current.includes(number) ? current.filter((n) => n !== number) : [...current, number],
    )
  }

  if (loading) return <Skeleton rows={1} height={420} />
  if (error) return <ErrorMessage error={error} onRetry={retry} />

  return (
    <div>
      <div className="tab-toolbar">
        <p className="muted">Pick drivers to compare their pace lap by lap.</p>
        <label className="toggle">
          <input
            type="checkbox"
            checked={hideSlowLaps}
            onChange={(e) => setHideSlowLaps(e.target.checked)}
          />
          {isRace ? 'Hide pit stop & safety car laps' : 'Hide out-laps & cool-down laps'}
        </label>
      </div>
      <DriverPicker
        drivers={drivers}
        selected={selected}
        onToggle={toggleDriver}
        lineStyles={lineStyles}
      />

      {selected.length === 0 ? (
        <p className="empty-state">Select at least one driver above.</p>
      ) : (
        <>
          <div className="stat-grid">
            {selected.map((number) => {
              const stats = getLapStats(laps, number, isRace)
              const driver = driverMap[number]
              return (
                <div
                  key={number}
                  className="stat-card"
                  style={{ '--team-color': lineStyles[number]?.color }}
                >
                  <p className="stat-card__name">{driver?.full_name}</p>
                  {stats ? (
                    <dl>
                      <div>
                        <dt>Fastest</dt>
                        <dd>{formatLapTime(stats.fastest)}</dd>
                      </div>
                      <div>
                        <dt>Average</dt>
                        <dd>{formatLapTime(stats.average)}</dd>
                      </div>
                      <div title="Standard deviation of clean laps. Lower = more consistent.">
                        <dt>Consistency</dt>
                        <dd>±{stats.consistency.toFixed(2)}s</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="muted">No timed laps</p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="chart-card">
            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={rows} margin={{ top: 10, right: 16, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="lap" tickLine={false} />
                <YAxis
                  domain={[(min) => Math.floor(min), (max) => Math.ceil(max)]}
                  tickFormatter={formatLapTime}
                  tickLine={false}
                  fontSize={11}
                  width={60}
                />
                <Tooltip content={<LapTooltip driverMap={driverMap} />} />
                {selected.map((number) => (
                  <Line
                    key={number}
                    dataKey={String(number)}
                    stroke={lineStyles[number]?.color}
                    strokeDasharray={lineStyles[number]?.dashed ? '6 3' : undefined}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

function LapTooltip({ active, payload, label, driverMap }) {
  if (!active || !payload?.length) return null
  const entries = payload.filter((e) => e.value != null).sort((a, b) => a.value - b.value)

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">Lap {label}</p>
      <ul className="chart-tooltip__list">
        {entries.map((entry) => (
          <li key={entry.dataKey}>
            <span className="dot" style={{ background: entry.stroke }} />
            {driverMap[entry.dataKey]?.name_acronym}
            <span className="mono">{formatLapTime(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
