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
import { computeLapPositions } from '../../utils/race'
import DriverPicker from './DriverPicker'
import ErrorMessage from '../ErrorMessage'
import Skeleton from '../Skeleton'

export default function PositionsTab({ sessionKey, drivers, driverMap, lineStyles }) {
  const { data: laps, loading, error, retry } = useFetch(() => getLaps(sessionKey), [sessionKey])
  const [highlighted, setHighlighted] = useState([])

  // useMemo: only redo this calculation when the laps change, not on every re-render
  // (e.g. clicking a driver chip shouldn't recalculate 1000+ laps).
  const rows = useMemo(() => (laps ? computeLapPositions(laps) : []), [laps])

  function toggleDriver(number) {
    setHighlighted((current) =>
      current.includes(number) ? current.filter((n) => n !== number) : [...current, number],
    )
  }

  if (loading) return <Skeleton rows={1} height={480} />
  if (error) return <ErrorMessage error={error} onRetry={retry} />
  if (rows.length === 0) return <p className="muted">No lap data for this race.</p>

  const positions = Array.from({ length: drivers.length }, (_, i) => i + 1)
  const anyHighlighted = highlighted.length > 0

  return (
    <div>
      <div className="tab-toolbar">
        <p className="muted">Click drivers to highlight them. Hover the chart to see the order on each lap.</p>
        {anyHighlighted && (
          <button className="button button--ghost" onClick={() => setHighlighted([])}>
            Clear
          </button>
        )}
      </div>
      <DriverPicker
        drivers={drivers}
        selected={highlighted}
        onToggle={toggleDriver}
        lineStyles={lineStyles}
      />

      <div className="chart-card">
        <ResponsiveContainer width="100%" height={520}>
          <LineChart data={rows} margin={{ top: 10, right: 16, bottom: 10, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="lap" tickLine={false} />
            <YAxis
              reversed
              domain={[1, drivers.length]}
              ticks={positions}
              interval={0}
              tickFormatter={(p) => `P${p}`}
              tickLine={false}
              fontSize={11}
            />
            <Tooltip content={<PositionTooltip driverMap={driverMap} highlighted={highlighted} />} />
            {drivers.map((driver) => {
              const number = driver.driver_number
              const style = lineStyles[number]
              const isHighlighted = highlighted.includes(number)
              return (
                <Line
                  key={number}
                  dataKey={String(number)}
                  stroke={style.color}
                  strokeDasharray={style.dashed ? '6 3' : undefined}
                  strokeWidth={isHighlighted ? 3.5 : 2}
                  strokeOpacity={anyHighlighted && !isHighlighted ? 0.12 : 1}
                  dot={false}
                  activeDot={anyHighlighted && !isHighlighted ? false : { r: 4 }}
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Recharts passes "active", "payload" (one entry per line) and "label" (the lap number).
function PositionTooltip({ active, payload, label, driverMap, highlighted }) {
  if (!active || !payload?.length) return null

  const entries = payload
    .filter((entry) => entry.value != null)
    .sort((a, b) => a.value - b.value)

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">Lap {label}</p>
      <ol className="chart-tooltip__grid">
        {entries.map((entry) => {
          const number = Number(entry.dataKey)
          return (
            <li
              key={entry.dataKey}
              className={highlighted.includes(number) ? 'is-highlighted' : ''}
            >
              <span className="dot" style={{ background: entry.stroke }} />
              <span className="muted">P{entry.value}</span> {driverMap[number]?.name_acronym}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
