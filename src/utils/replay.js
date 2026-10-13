// The live replay engine.
//
// Downloading every car's GPS position for a whole race would be ~50 MB, far too much.
// Instead we use a trick that needs very little data:
//
//   1. From the lap data we know exactly when each driver started and finished every lap.
//   2. So at any moment we know how far through their current lap each driver is (e.g. 40%).
//   3. We download the GPS trace of ONE reference lap, which gives the shape of the track and
//      how long it takes to reach each point (cars are slow in corners, fast on straights).
//   4. A driver who is 40% of the way through their lap is drawn where the reference car
//      was at 40% of its lap time.
//
// Everything below is plain data processing, so it can be tested without React.

import { pointAtTime } from './track'

const toMs = (iso) => new Date(iso).getTime()

// Everything that never changes during playback is worked out once, here.
export function buildReplay({ laps, drivers, results, stints, pits, messages, trackPoints, referenceLap }) {
  // 1. Every driver's laps as { lap, start, end } in milliseconds.
  const lapsByDriver = {}
  for (const lap of laps) {
    lapsByDriver[lap.driver_number] ??= []
    lapsByDriver[lap.driver_number].push(lap)
  }

  const timing = {}
  for (const [driverNumber, driverLaps] of Object.entries(lapsByDriver)) {
    driverLaps.sort((a, b) => a.lap_number - b.lap_number)
    timing[driverNumber] = driverLaps
      .map((lap, i) => {
        const next = driverLaps[i + 1]
        const start = toMs(lap.date_start)
        // A lap ends when the next one starts. The last lap ends after its own duration.
        let end = null
        if (next && next.lap_number === lap.lap_number + 1) end = toMs(next.date_start)
        else if (lap.lap_duration) end = start + lap.lap_duration * 1000
        return { lap: lap.lap_number, start, end }
      })
      .filter((lap) => lap.end)
  }

  // 2. The first moment any car crossed the line at the end of each lap (= the race leader).
  // Used for "gap to leader" and to know if someone has been lapped.
  const leaderCrossings = {}
  for (const driverLaps of Object.values(timing)) {
    for (const { lap, end } of driverLaps) {
      leaderCrossings[lap] = Math.min(leaderCrossings[lap] ?? Infinity, end)
    }
  }

  const allLaps = Object.values(timing).flat()
  const resultByDriver = Object.fromEntries(results.map((r) => [r.driver_number, r]))

  return {
    drivers,
    timing,
    leaderCrossings,
    resultByDriver,
    trackPoints,
    referenceDuration: referenceLap.lap_duration,
    startTime: Math.min(...allLaps.map((l) => l.start)),
    endTime: Math.max(...allLaps.map((l) => l.end)) + 5000,
    totalLaps: Math.max(...results.map((r) => r.number_of_laps ?? 0), ...allLaps.map((l) => l.lap)),
    stints,
    pits: pits.map((p) => ({
      ...p,
      start: toMs(p.date),
      end: toMs(p.date) + (p.lane_duration ?? p.pit_duration ?? 25) * 1000,
    })),
    messages: messages
      .map((m) => ({ ...m, time: toMs(m.date) }))
      .sort((a, b) => a.time - b.time),
  }
}

// Where is every driver at time `now`? Called on every animation frame, so it must be fast.
export function getReplayFrame(replay, now) {
  const cars = replay.drivers
    .map((driver) => getCarState(replay, driver, now))
    .filter(Boolean)

  // Running order: most laps (plus lap fraction) first. If two cars are level,
  // whoever crossed the line earlier is ahead. Retired cars go to the bottom.
  cars.sort((a, b) => {
    if (a.out !== b.out) return a.out ? 1 : -1
    if (b.progress !== a.progress) return b.progress - a.progress
    return a.lastCrossing - b.lastCrossing
  })

  const leader = cars[0]
  cars.forEach((car, index) => {
    car.position = index + 1
    car.gap = index === 0 ? null : getGapText(replay, car)
  })

  const pastMessages = replay.messages.filter((m) => m.time <= now)

  return {
    cars,
    lap: leader ? Math.min(replay.totalLaps, leader.completed + 1) : 1,
    finished: leader?.finished ?? false,
    trackStatus: getTrackStatus(pastMessages),
    recentMessages: pastMessages.slice(-6).reverse(),
  }
}

function getCarState(replay, driver, now) {
  const laps = replay.timing[driver.driver_number]
  if (!laps?.length) return null

  const first = laps[0]
  const last = laps[laps.length - 1]
  let completed = 0 // laps finished so far
  let fraction = 0 // how far through the current lap (0 to 1)
  let finished = false

  if (now >= last.end) {
    completed = last.lap
    finished = true
  } else if (now >= first.start) {
    const current = laps.find((l) => now >= l.start && now < l.end)
    if (current) {
      completed = current.lap - 1
      fraction = (now - current.start) / (current.end - current.start)
    } else {
      // A gap in the data (a missing lap): keep the car at the last line it crossed.
      completed = laps.filter((l) => l.end <= now).at(-1)?.lap ?? 0
    }
  }

  const result = replay.resultByDriver[driver.driver_number]
  const out = finished && (!result || result.dnf || result.dns || result.position == null)
  const lastCrossing = completed > 0 ? laps.find((l) => l.lap === completed)?.end ?? first.start : first.start

  const currentLap = Math.min(completed + 1, replay.totalLaps)
  const stint = replay.stints.find(
    (s) => s.driver_number === driver.driver_number && s.lap_start <= currentLap && currentLap <= (s.lap_end ?? Infinity),
  )
  const inPit = replay.pits.some(
    (p) => p.driver_number === driver.driver_number && now >= p.start && now < p.end,
  )

  return {
    driver,
    completed,
    progress: completed + fraction,
    lastCrossing,
    finished,
    out,
    inPit,
    compound: stint?.compound ?? null,
    tyreAge: stint ? currentLap - stint.lap_start + (stint.tyre_age_at_start ?? 0) : null,
    // Map the lap fraction onto the reference lap to get a point on the track.
    point: pointAtTime(replay.trackPoints, fraction * replay.referenceDuration),
  }
}

// "+3.214s", "+1 LAP", or "" before anyone has completed a lap.
function getGapText(replay, car) {
  if (car.out) return 'OUT'
  if (car.completed === 0) return ''

  const myCrossing = car.lastCrossing
  const leaderCrossing = replay.leaderCrossings[car.completed]

  // Count how many more laps the leader had finished by the time this car crossed the line.
  let lapsDown = 0
  while (replay.leaderCrossings[car.completed + lapsDown + 1] <= myCrossing) lapsDown++
  if (lapsDown > 0) return `+${lapsDown} LAP${lapsDown > 1 ? 'S' : ''}`

  return `+${((myCrossing - leaderCrossing) / 1000).toFixed(1)}s`
}

// Reads Race Control messages in order to work out the current track status.
function getTrackStatus(messages) {
  let status = 'GREEN'
  for (const m of messages) {
    const text = m.message.toUpperCase()
    if (m.category === 'SafetyCar') {
      if (text.includes('VIRTUAL') && text.includes('DEPLOYED')) status = 'VSC'
      else if (text.includes('DEPLOYED')) status = 'SC'
      else if (text.includes('ENDING') || text.includes('IN THIS LAP')) status = 'GREEN'
    }
    if (m.category === 'Flag' && m.scope === 'Track') {
      if (m.flag === 'RED') status = 'RED'
      else if (m.flag === 'CHEQUERED') status = 'CHEQUERED'
      else if (m.flag === 'GREEN' && status === 'RED') status = 'GREEN'
    }
  }
  return status
}
