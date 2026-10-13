import { useEffect, useMemo, useState } from 'react'
import { getLapLocation, getLaps, getPitStops, getRaceControl, getStints } from '../../api/f1'
import useFetch from '../../hooks/useFetch'
import { TYRE_COLORS } from '../../utils/constants'
import { teamColor } from '../../utils/format'
import { getFastestLap } from '../../utils/race'
import { buildReplay, getReplayFrame } from '../../utils/replay'
import { toTrackPoints } from '../../utils/track'
import ErrorMessage from '../ErrorMessage'
import Skeleton from '../Skeleton'
import TrackMap from '../TrackMap'

const SPEEDS = [1, 4, 16, 64]
const ROW_HEIGHT = 34 // px, must match .leaderboard__row height in CSS

const STATUS_LABELS = {
  GREEN: 'Green flag',
  SC: 'Safety car',
  VSC: 'Virtual safety car',
  RED: 'Red flag',
  CHEQUERED: 'Chequered flag',
}

// Loads everything the replay needs, then builds the replay model once.
async function loadReplay(sessionKey, drivers, results) {
  const [laps, stints, pits, messages] = await Promise.all([
    getLaps(sessionKey),
    getStints(sessionKey),
    getPitStops(sessionKey),
    getRaceControl(sessionKey),
  ])

  // Reference lap for the track shape: the fastest lap of the highest finisher who set one.
  const referenceLap = results.map((r) => getFastestLap(laps, r.driver_number)).find(Boolean)
  if (!referenceLap) return null

  const location = await getLapLocation(sessionKey, referenceLap)
  const trackPoints = toTrackPoints(location, referenceLap.date_start)
  if (trackPoints.length < 10) return null

  return buildReplay({ laps, drivers, results, stints, pits, messages, trackPoints, referenceLap })
}

export default function ReplayTab({ sessionKey, drivers, results }) {
  const { data: replay, loading, error, retry } = useFetch(
    () => loadReplay(sessionKey, drivers, results),
    [sessionKey],
  )

  if (loading) {
    return (
      <div className="replay-loading">
        <Skeleton rows={1} height={420} />
        <p className="muted">Loading every lap, tyre stint, pit stop and race control message…</p>
      </div>
    )
  }
  if (error) return <ErrorMessage error={error} onRetry={retry} />
  if (!replay) return <p className="empty-state">Not enough data to replay this session.</p>

  return <ReplayPlayer replay={replay} />
}

function ReplayPlayer({ replay }) {
  const [time, setTime] = useState(replay.startTime) // the replay clock, in ms
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(16)
  const [focused, setFocused] = useState(null) // driver number being followed

  // Derived value: once the clock reaches the end, playback stops by itself.
  const atEnd = time >= replay.endTime
  const isPlaying = playing && !atEnd

  // The animation loop. requestAnimationFrame calls `tick` before every screen refresh
  // (~60 times a second). We move the clock forward by the real time that passed × speed.
  useEffect(() => {
    if (!isPlaying) return

    let frameId
    let previous = performance.now()
    function tick(now) {
      const elapsed = now - previous
      previous = now
      setTime((t) => Math.min(replay.endTime, t + elapsed * speed))
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)

    // Stop the loop when paused, when the speed changes, or when leaving the page.
    return () => cancelAnimationFrame(frameId)
  }, [isPlaying, speed, replay.endTime])


  // Space bar = play / pause (unless you're typing in a field or focused on a button).
  useEffect(() => {
    function onKeyDown(e) {
      if (e.code !== 'Space' || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return
      e.preventDefault()
      setPlaying((p) => !p)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function togglePlay() {
    if (atEnd) {
      setTime(replay.startTime) // replay from the start
      setPlaying(true)
    } else {
      setPlaying(!playing)
    }
  }

  const frame = useMemo(() => getReplayFrame(replay, time), [replay, time])
  const carsByNumber = Object.fromEntries(frame.cars.map((car) => [car.driver.driver_number, car]))

  const markers = frame.cars
    .filter((car) => !car.out && car.point)
    .map((car) => ({
      id: car.driver.driver_number,
      x: car.point.x,
      y: car.point.y,
      color: teamColor(car.driver.team_colour),
      label: car.driver.name_acronym,
      highlighted: car.driver.driver_number === focused,
      dimmed: focused != null && car.driver.driver_number !== focused,
    }))
    // SVG draws in order, so the followed car goes last to sit on top.
    .sort((a, b) => Number(a.highlighted) - Number(b.highlighted))

  return (
    <div className="replay">
      <div className="replay__stage">
        <div className="replay__map-card">
          <div className="replay__hud">
            <span className="replay__lap">
              {frame.finished ? 'FINISHED' : `LAP ${frame.lap}`}
              <small>/{replay.totalLaps}</small>
            </span>
            <span className={`track-status track-status--${frame.trackStatus.toLowerCase()}`}>
              {STATUS_LABELS[frame.trackStatus]}
            </span>
          </div>
          <TrackMap points={replay.trackPoints} markers={markers} className="track-map--replay" />
        </div>

        <div className="replay__controls">
          <button className="play-button" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <input
            className="timeline"
            type="range"
            min={replay.startTime}
            max={replay.endTime}
            step={1000}
            value={time}
            onChange={(e) => setTime(Number(e.target.value))}
            aria-label="Race timeline"
            style={{ '--progress': `${((time - replay.startTime) / (replay.endTime - replay.startTime)) * 100}%` }}
          />
          <span className="replay__clock mono">{formatClock(time - replay.startTime)}</span>
          <div className="segmented segmented--small" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
        </div>
        <p className="muted replay__hint">Space to play / pause. Click a driver to follow them.</p>
      </div>

      <div className="replay__side">
        {/* Every row is absolutely positioned and moved with translateY.
            When positions change, the CSS transition slides the rows past each other.
            Rows are always rendered in the same order so React never moves DOM nodes. */}
        <ol className="leaderboard" style={{ height: frame.cars.length * ROW_HEIGHT }}>
          {replay.drivers.map((driver) => {
            const car = carsByNumber[driver.driver_number]
            if (!car) return null
            const isFocused = focused === driver.driver_number
            return (
              <li
                key={driver.driver_number}
                className={`leaderboard__row ${isFocused ? 'is-focused' : ''} ${car.out ? 'is-out' : ''}`}
                style={{ transform: `translateY(${(car.position - 1) * ROW_HEIGHT}px)` }}
              >
                <button onClick={() => setFocused(isFocused ? null : driver.driver_number)} aria-pressed={isFocused}>
                  <span className="leaderboard__pos">{car.position}</span>
                  <span className="team-bar" style={{ background: teamColor(driver.team_colour) }} />
                  <span className="leaderboard__name">{driver.name_acronym}</span>
                  {car.inPit && <span className="pill pill--pit">PIT</span>}
                  <span className="leaderboard__gap mono">{car.gap}</span>
                  {car.compound && (
                    <span
                      className="tyre-badge"
                      style={{ '--tyre-color': TYRE_COLORS[car.compound] ?? '#777' }}
                      title={`${car.compound} · ${car.tyreAge} laps old`}
                    >
                      {car.compound[0]}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>

        <div className="race-control">
          <p className="race-control__title">Race control</p>
          {frame.recentMessages.length === 0 ? (
            <p className="muted">No messages yet.</p>
          ) : (
            <ul>
              {frame.recentMessages.map((m, i) => (
                <li key={`${m.time}-${i}`}>
                  <span className={`flag-dot flag-dot--${(m.flag ?? m.category).toLowerCase().replace(/\s/g, '-')}`} />
                  {m.lap_number && <span className="muted">L{m.lap_number} </span>}
                  {m.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// 2723000 ms → "0:45:23"
function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}
