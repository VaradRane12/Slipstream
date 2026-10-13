// Pure functions that turn raw API data into the shapes our pages and charts need.
// "Pure" = same input always gives the same output, and nothing outside is changed.
// That makes them easy to test and easy to reason about.

import { teamColor } from './format'

// "race" (includes sprints), "qualifying" (includes sprint qualifying) or "practice".
// Each kind shows different tabs and a different results table.
export function getSessionKind(session) {
  if (session.session_type === 'Race') return 'race'
  if (session.session_type === 'Qualifying') return 'qualifying'
  return 'practice'
}

// Short names for the session switcher.
const SESSION_LABELS = {
  'Practice 1': 'FP1',
  'Practice 2': 'FP2',
  'Practice 3': 'FP3',
  'Sprint Qualifying': 'Sprint Quali',
  'Sprint Shootout': 'Sprint Shootout',
}
export function getSessionLabel(session) {
  return SESSION_LABELS[session.session_name] ?? session.session_name
}

export function hasStarted(session, now = Date.now()) {
  return new Date(session.date_start) <= now
}

// Is a race finished, live right now, upcoming, or cancelled?
export function getRaceStatus(race, now = Date.now()) {
  if (race.is_cancelled) return 'cancelled'
  if (new Date(race.date_end) < now) return 'finished'
  if (new Date(race.date_start) <= now) return 'live'
  return 'upcoming'
}

// Adds a round number (1, 2, 3...) to each race. Cancelled races don't get a round.
export function addRoundNumbers(races) {
  let round = 0
  return races.map((race) => (race.is_cancelled ? { ...race, round: null } : { ...race, round: ++round }))
}

// [{ driver_number: 1, ... }, ...] → { 1: { driver_number: 1, ... }, ... }
// so we can look a driver up by number instantly: driverMap[1]
export function buildDriverMap(drivers) {
  const map = {}
  for (const driver of drivers) map[driver.driver_number] = driver
  return map
}

// Results come back with retired drivers (position = null) mixed in. Put them last.
export function sortResults(results) {
  return [...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
}

export function getResultStatus(result) {
  if (result.dsq) return 'DSQ'
  if (result.dns) return 'DNS'
  if (result.dnf) return 'DNF'
  return null
}

// Teammates share a team colour, so the second driver of each team gets a dashed line.
// Returns { [driverNumber]: { color, dashed } }
export function buildLineStyles(drivers) {
  const seenTeams = new Set()
  const styles = {}
  for (const driver of drivers) {
    const dashed = seenTeams.has(driver.team_name)
    seenTeams.add(driver.team_name)
    styles[driver.driver_number] = { color: teamColor(driver.team_colour), dashed }
  }
  return styles
}

// ---------- Positions chart ----------

// Works out every driver's position at the end of every lap.
//
// Idea: at the end of lap N, the car that crossed the finish line first is P1,
// the second car to cross is P2, and so on.
// A driver finishes lap N at the moment they start lap N+1. For their very last lap
// there is no "next lap", so we use: start of lap + lap duration.
//
// Returns rows for the chart: [{ lap: 1, 4: 1, 81: 2, 1: 3, ... }, { lap: 2, ... }]
export function computeLapPositions(laps) {
  const startTimes = {} // "driver-lap" → start time in milliseconds
  for (const lap of laps) {
    if (lap.date_start) {
      startTimes[`${lap.driver_number}-${lap.lap_number}`] = new Date(lap.date_start).getTime()
    }
  }

  const crossingsByLap = {} // lap number → [{ driverNumber, time }]
  for (const lap of laps) {
    const nextStart = startTimes[`${lap.driver_number}-${lap.lap_number + 1}`]
    const thisStart = startTimes[`${lap.driver_number}-${lap.lap_number}`]

    let finishedAt = null
    if (nextStart) finishedAt = nextStart
    else if (thisStart && lap.lap_duration) finishedAt = thisStart + lap.lap_duration * 1000
    if (finishedAt == null) continue

    crossingsByLap[lap.lap_number] ??= []
    crossingsByLap[lap.lap_number].push({ driverNumber: lap.driver_number, time: finishedAt })
  }

  return Object.keys(crossingsByLap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((lapNumber) => {
      const row = { lap: lapNumber }
      crossingsByLap[lapNumber]
        .sort((a, b) => a.time - b.time)
        .forEach((crossing, index) => {
          row[crossing.driverNumber] = index + 1
        })
      return row
    })
}

// ---------- Lap times chart ----------

// Returns one driver's laps that have a time.
// With hideSlowLaps, it also removes laps that aren't "real" pace:
// lap 1 (standing start), pit in- and out-laps, and anything more than 7% slower
// than a reference lap (safety car laps, spins, cool-down laps...).
//
// The reference lap is different per session type:
// - Race: the driver's typical (median) lap, so wet races (where every lap is slower)
//   still keep most of their laps.
// - Practice / qualifying: the driver's fastest lap. Most laps there are slow
//   out-laps and cool-down laps, so only the real push laps should stay.
export function getDriverLaps(laps, driverNumber, hideSlowLaps, isRace = true) {
  const timed = laps.filter((lap) => lap.driver_number === driverNumber && lap.lap_duration)
  if (!hideSlowLaps || timed.length === 0) return timed

  // The lap *before* a pit out-lap is the in-lap (the driver slows down to enter the pits).
  const inLaps = new Set(timed.filter((lap) => lap.is_pit_out_lap).map((lap) => lap.lap_number - 1))
  const times = timed.map((lap) => lap.lap_duration)
  const reference = isRace ? median(times) : Math.min(...times)

  return timed.filter(
    (lap) =>
      lap.lap_number > 1 &&
      !lap.is_pit_out_lap &&
      !inLaps.has(lap.lap_number) &&
      lap.lap_duration <= reference * 1.07,
  )
}

// The middle value once sorted. Unlike the average, one very slow lap can't drag it up.
function median(numbers) {
  if (numbers.length === 0) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

// Returns rows for the chart: [{ lap: 2, 1: 84.123, 4: 84.456 }, ...]
export function buildLapTimeRows(laps, driverNumbers, hideSlowLaps, isRace) {
  const rowsByLap = {}
  for (const driverNumber of driverNumbers) {
    for (const lap of getDriverLaps(laps, driverNumber, hideSlowLaps, isRace)) {
      rowsByLap[lap.lap_number] ??= { lap: lap.lap_number }
      rowsByLap[lap.lap_number][driverNumber] = lap.lap_duration
    }
  }
  return Object.values(rowsByLap).sort((a, b) => a.lap - b.lap)
}

// Fastest lap, average of clean laps, and how consistent the driver was.
export function getLapStats(laps, driverNumber, isRace) {
  const all = getDriverLaps(laps, driverNumber, false)
  const clean = getDriverLaps(laps, driverNumber, true, isRace)
  if (clean.length === 0) return null

  const times = clean.map((lap) => lap.lap_duration)
  const average = times.reduce((sum, t) => sum + t, 0) / times.length
  // Standard deviation: how far, on average, each lap is from the driver's average lap.
  // Smaller = more consistent.
  const variance = times.reduce((sum, t) => sum + (t - average) ** 2, 0) / times.length

  return {
    fastest: Math.min(...all.map((lap) => lap.lap_duration)),
    average,
    consistency: Math.sqrt(variance),
    cleanLaps: clean.length,
  }
}

// A driver's quickest complete lap, or undefined if they didn't set a time.
export function getFastestLap(laps, driverNumber) {
  return laps
    .filter((lap) => lap.driver_number === driverNumber && lap.lap_duration && lap.date_start)
    .reduce((best, lap) => (!best || lap.lap_duration < best.lap_duration ? lap : best), undefined)
}
