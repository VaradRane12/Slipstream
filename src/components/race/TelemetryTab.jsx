import { memo, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getLapTelemetry, getLaps } from '../../api/f1'
import useFetch from '../../hooks/useFetch'
import { formatLapTime } from '../../utils/format'
import { getFastestLap } from '../../utils/race'
import { analyseLaps } from '../../utils/telemetry'
import ErrorMessage from '../ErrorMessage'
import Skeleton from '../Skeleton'
import TrackMap from '../TrackMap'

// When both drivers are teammates (same colour), driver B gets this grey instead.
const FALLBACK_COLOR = '#9a9aa8'
const GEAR_COLORS = ['#555', '#6e40c9', '#3b5bdb', '#1098ad', '#2b8a3e', '#94d82d', '#fab005', '#f76707', '#e03131']

// Step 1: load the session's laps and let the user pick two laps to compare.
export default function TelemetryTab({ sessionKey, drivers, lineStyles }) {
  const { data: laps, loading, error, retry } = useFetch(() => getLaps(sessionKey), [sessionKey])

  // { driver: number, lap: number | null }. lap = null means "their fastest lap".
  const [choiceA, setChoiceA] = useState({ driver: drivers[0]?.driver_number, lap: null })
  const [choiceB, setChoiceB] = useState(
    drivers[1] ? { driver: drivers[1].driver_number, lap: null } : null,
  )

  if (loading) return <Skeleton rows={3} height={160} />
  if (error) return <ErrorMessage error={error} onRetry={retry} />

  const lapA = resolveLap(laps, choiceA)
  const lapB = choiceB ? resolveLap(laps, choiceB) : null
  const driverA = drivers.find((d) => d.driver_number === choiceA?.driver)
  const driverB = drivers.find((d) => d.driver_number === choiceB?.driver)

  const colorA = lineStyles[choiceA?.driver]?.color ?? '#e10600'
  let colorB = lineStyles[choiceB?.driver]?.color ?? FALLBACK_COLOR
  if (colorB === colorA) colorB = FALLBACK_COLOR

  return (
    <div>
      <div className="lap-pickers">
        <LapPicker label="Driver A" color={colorA} drivers={drivers} laps={laps} value={choiceA} onChange={setChoiceA} />
        <span className="lap-pickers__vs">vs</span>
        <LapPicker label="Driver B" color={colorB} drivers={drivers} laps={laps} value={choiceB} onChange={setChoiceB} allowNone />
      </div>

      {lapA ? (
        <TelemetryView
          sessionKey={sessionKey}
          lapA={lapA}
          lapB={lapB}
          nameA={driverA?.name_acronym}
          nameB={driverB?.name_acronym}
          colorA={colorA}
          colorB={colorB}
        />
      ) : (
        <p className="empty-state">This driver has no timed laps in this session.</p>
      )}
    </div>
  )
}

function resolveLap(laps, choice) {
  if (!choice) return null
  if (choice.lap != null) {
    const lap = laps.find((l) => l.driver_number === choice.driver && l.lap_number === choice.lap)
    if (lap?.lap_duration && lap.date_start) return lap
  }
  return getFastestLap(laps, choice.driver)
}

function LapPicker({ label, color, drivers, laps, value, onChange, allowNone = false }) {
  const fastest = value ? getFastestLap(laps, value.driver) : null
  const driverLaps = value
    ? laps
        .filter((l) => l.driver_number === value.driver && l.lap_duration && l.date_start)
        .sort((a, b) => a.lap_number - b.lap_number)
    : []

  return (
    <div className="lap-picker" style={{ '--picker-color': color }}>
      <span className="lap-picker__label">{label}</span>
      <select
        aria-label={`${label} driver`}
        value={value?.driver ?? ''}
        onChange={(e) => onChange(e.target.value ? { driver: Number(e.target.value), lap: null } : null)}
      >
        {allowNone && <option value="">None</option>}
        {drivers.map((d) => (
          <option key={d.driver_number} value={d.driver_number}>
            {d.name_acronym} · {d.full_name}
          </option>
        ))}
      </select>
      {value && driverLaps.length > 0 && (
        <select
          aria-label={`${label} lap`}
          value={value.lap ?? fastest?.lap_number}
          onChange={(e) => onChange({ ...value, lap: Number(e.target.value) })}
        >
          {driverLaps.map((l) => (
            <option key={l.lap_number} value={l.lap_number}>
              Lap {l.lap_number} · {formatLapTime(l.lap_duration)}
              {l === fastest ? ' ★ fastest' : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

// Step 2: load the telemetry for the chosen laps and show charts + map.
function TelemetryView({ sessionKey, lapA, lapB, nameA, nameB, colorA, colorB }) {
  const { data, loading, error, retry } = useFetch(
    () => Promise.all([getLapTelemetry(sessionKey, lapA), lapB ? getLapTelemetry(sessionKey, lapB) : null]),
    [sessionKey, lapA.driver_number, lapA.lap_number, lapB?.driver_number, lapB?.lap_number],
  )

  // The heavy maths only re-runs when new telemetry arrives, not when the mouse moves.
  const analysis = useMemo(() => (data ? analyseLaps(data[0], data[1]) : null), [data])
  const [hoverIndex, setHoverIndex] = useState(null)
  const [mapMode, setMapMode] = useState('speed')

  if (loading) return <Skeleton rows={4} height={140} />
  if (error) return <ErrorMessage error={error} onRetry={retry} />
  if (!analysis) return <p className="empty-state">No telemetry was recorded for this lap.</p>

  const { rows, summaryA, summaryB, miniSectors } = analysis
  const hasB = Boolean(summaryB)
  const mode = mapMode === 'faster' && !hasB ? 'speed' : mapMode
  const hovered = hoverIndex != null ? rows[hoverIndex] : null

  return (
    <div className="telemetry">
      <div className="telemetry__charts">
        <div className="summary-row">
          <LapSummary name={nameA} color={colorA} summary={summaryA} />
          {hasB && <LapSummary name={nameB} color={colorB} summary={summaryB} />}
        </div>
        <TelemetryCharts rows={rows} hasB={hasB} colorA={colorA} colorB={colorB} onHover={setHoverIndex} />
      </div>

      {/* Sticky side panel: stays on screen while you scroll the charts */}
      <aside className="telemetry__side">
        <div className="map-card">
          <div className="segmented segmented--small" role="tablist" aria-label="Colour the track by">
            {['speed', 'gear', ...(hasB ? ['faster'] : [])].map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMapMode(m)}>
                {m === 'faster' ? 'Who’s faster' : m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <TelemetryMap
            rows={rows}
            mode={mode}
            miniSectors={miniSectors}
            colorA={colorA}
            colorB={colorB}
            hovered={hovered}
            nameA={nameA}
            nameB={nameB}
          />
          <MapLegend mode={mode} rows={rows} nameA={nameA} nameB={nameB} colorA={colorA} colorB={colorB} />
        </div>
        <Readout hovered={hovered} hasB={hasB} nameA={nameA} nameB={nameB} colorA={colorA} colorB={colorB} />
      </aside>
    </div>
  )
}

function LapSummary({ name, color, summary }) {
  const items = [
    ['Lap time', formatLapTime(summary.lapTime)],
    ['Top speed', `${summary.topSpeed} km/h`],
    ['Full throttle', `${summary.fullThrottle}%`],
    ['Braking', `${summary.braking}%`],
    ['Gear shifts', summary.gearShifts],
    ['DRS open', `${summary.drsOpen}%`],
  ]
  return (
    <div className="lap-summary" style={{ '--team-color': color }}>
      <p className="lap-summary__name">{name}</p>
      <dl>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// The channels we draw, top to bottom. "step" lines jump straight between values
// (a gear is 5 or 6, never 5.5), instead of drawing a slope.
const CHANNELS = [
  { key: 'speed', label: 'Speed (km/h)', height: 190 },
  { key: 'delta', label: 'Gap (s)', height: 110, onlyWithB: true },
  { key: 'throttle', label: 'Throttle (%)', height: 100, domain: [0, 100] },
  { key: 'brake', label: 'Brake', height: 56, domain: [0, 100], step: true, hideTicks: true },
  { key: 'gear', label: 'Gear', height: 100, domain: [1, 8], step: true },
  { key: 'rpm', label: 'RPM', height: 100 },
  { key: 'drs', label: 'DRS', height: 50, domain: [0, 1], step: true, hideTicks: true },
]

// memo(): React skips re-rendering these 7 charts unless their props change.
// Moving the mouse only changes hoverIndex in the parent, so the charts stay put
// and only the map dot and readout update. Without this the hover would feel laggy.
const TelemetryCharts = memo(function TelemetryCharts({ rows, hasB, colorA, colorB, onHover }) {
  const channels = CHANNELS.filter((c) => !c.onlyWithB || hasB)

  function handleMouseMove(state) {
    const index = Number(state?.activeTooltipIndex)
    if (Number.isFinite(index)) onHover(index)
  }

  return (
    <div className="telemetry-charts" onMouseLeave={() => onHover(null)}>
      {channels.map((channel, i) => {
        const isLast = i === channels.length - 1
        const lineType = channel.step ? 'stepAfter' : 'linear'
        return (
          <div key={channel.key} className="telemetry-chart">
            <span className="telemetry-chart__label">
              {channel.label}
              {channel.key === 'delta' && <span className="muted"> · above 0 = A ahead</span>}
            </span>
            <ResponsiveContainer width="100%" height={channel.height + (isLast ? 24 : 0)}>
              {/* syncId links all charts: hovering one moves the cursor on all of them */}
              <LineChart data={rows} syncId="telemetry" onMouseMove={handleMouseMove} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="distance"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  hide={!isLast}
                  tickFormatter={(m) => `${(m / 1000).toFixed(1)} km`}
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  domain={channel.domain ?? ['auto', 'auto']}
                  width={44}
                  fontSize={10}
                  tickLine={false}
                  tick={!channel.hideTicks}
                  allowDecimals={channel.key === 'delta'}
                />
                <Tooltip content={() => null} cursor={{ stroke: '#888', strokeWidth: 1 }} />
                {channel.key === 'delta' ? (
                  <>
                    <ReferenceLine y={0} stroke="#888" />
                    <Line dataKey="delta" stroke={colorB} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  </>
                ) : (
                  <>
                    <Line dataKey={`${channel.key}A`} type={lineType} stroke={colorA} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                    {hasB && (
                      <Line dataKey={`${channel.key}B`} type={lineType} stroke={colorB} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                    )}
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
})

// Slow = blue, fast = red.
function speedColor(speed, min, max) {
  const fraction = (speed - min) / (max - min || 1)
  return `hsl(${Math.round(230 - 230 * fraction)} 85% 55%)`
}

function TelemetryMap({ rows, mode, miniSectors, colorA, colorB, hovered, nameA, nameB }) {
  // Keep only rows where we know the car's position, and remember each row's index
  // (the mini-sector winners are stored by row index).
  const mapRows = useMemo(
    () => rows.map((row, index) => ({ ...row.positionA, row, index })).filter((p) => p.x != null),
    [rows],
  )

  const segmentColors = useMemo(() => {
    const speeds = rows.map((r) => r.speedA)
    const min = Math.min(...speeds)
    const max = Math.max(...speeds)
    return mapRows.slice(1).map(({ row, index }) => {
      if (mode === 'gear') return GEAR_COLORS[row.gearA] ?? '#888'
      if (mode === 'faster') return miniSectors[index] === 'A' ? colorA : colorB
      return speedColor(row.speedA, min, max)
    })
  }, [rows, mapRows, mode, miniSectors, colorA, colorB])

  const markers = []
  if (hovered?.positionA) markers.push({ id: 'a', ...hovered.positionA, color: colorA, label: nameA })
  if (hovered?.positionB) markers.push({ id: 'b', ...hovered.positionB, color: colorB, label: nameB })

  return <TrackMap points={mapRows} segmentColors={segmentColors} markers={markers} />
}

function MapLegend({ mode, rows, nameA, nameB, colorA, colorB }) {
  if (mode === 'gear') {
    return (
      <div className="map-legend">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
          <span key={g}>
            <span className="dot" style={{ background: GEAR_COLORS[g] }} />
            {g}
          </span>
        ))}
      </div>
    )
  }
  if (mode === 'faster') {
    return (
      <div className="map-legend">
        <span><span className="dot" style={{ background: colorA }} />{nameA} faster</span>
        <span><span className="dot" style={{ background: colorB }} />{nameB} faster</span>
      </div>
    )
  }
  const speeds = rows.map((r) => r.speedA)
  return (
    <div className="map-legend map-legend--gradient">
      <span>{Math.min(...speeds)} km/h</span>
      <span className="speed-gradient" />
      <span>{Math.max(...speeds)} km/h</span>
    </div>
  )
}

function Readout({ hovered, hasB, nameA, nameB, colorA, colorB }) {
  if (!hovered) {
    return <p className="readout readout--empty muted">Hover over the charts to follow the car around the track.</p>
  }
  const drivers = [{ key: 'A', name: nameA, color: colorA }, ...(hasB ? [{ key: 'B', name: nameB, color: colorB }] : [])]
  return (
    <div className="readout">
      <p className="readout__distance">
        {Math.round(hovered.distance)} m
        {hasB && hovered.delta != null && (
          <span className="muted">
            {' '}· {hovered.delta >= 0 ? nameA : nameB} ahead by {Math.abs(hovered.delta).toFixed(3)}s
          </span>
        )}
      </p>
      <table>
        <thead>
          <tr>
            <th />
            <th>Speed</th>
            <th>Gear</th>
            <th>Throttle</th>
            <th>Brake</th>
            <th>DRS</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map(({ key, name, color }) => (
            <tr key={key}>
              <th><span className="dot" style={{ background: color }} />{name}</th>
              <td>{hovered[`speed${key}`]}</td>
              <td>{hovered[`gear${key}`]}</td>
              <td>{hovered[`throttle${key}`]}%</td>
              <td>{hovered[`brake${key}`] ? <span className="pill pill--brake">ON</span> : '–'}</td>
              <td>{hovered[`drs${key}`] ? <span className="pill pill--drs">OPEN</span> : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
