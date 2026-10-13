// Every network request in the app goes through this file.
// Components never call fetch() directly. They call these small functions instead.
//
// Two free, public APIs are used (no API key needed):
//   OpenF1  → sessions, drivers, results, laps, tyres, car telemetry, track positions (2023 onwards)
//   Jolpica → championship standings (the community replacement for the old Ergast API)

const OPENF1_URL = 'https://api.openf1.org/v1'
const JOLPICA_URL = 'https://api.jolpi.ca/ergast/f1'

// Simple in-memory cache: URL → Promise of the parsed JSON.
// We store the *promise* (not the data), so if two components ask for the same URL
// at the same time they share a single network request.
const cache = new Map()

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// OpenF1's free tier allows about 3 requests per second.
// Instead of firing everything at once, each request books the next free "slot",
// so requests go out at most once every 350 ms.
const MIN_GAP_MS = 350
let nextSlot = 0

async function waitForSlot() {
  const now = Date.now()
  const start = Math.max(now, nextSlot)
  nextSlot = start + MIN_GAP_MS
  await wait(start - now)
}

async function fetchJSON(url, attempt = 0) {
  if (url.startsWith(OPENF1_URL)) await waitForSlot()
  const response = await fetch(url)

  // 429 = "Too Many Requests". Wait and try again, waiting longer each time (1s, 2s, 4s, 8s).
  // This is called "exponential backoff".
  if (response.status === 429 && attempt < 4) {
    await wait(1000 * 2 ** attempt)
    return fetchJSON(url, attempt + 1)
  }

  // OpenF1 answers 404 when a query simply has no rows, so treat it as an empty list.
  if (response.status === 404) return []

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return response.json()
}

function getJSON(url) {
  if (!cache.has(url)) {
    const promise = fetchJSON(url).catch((error) => {
      cache.delete(url) // don't cache failures, so "Try again" makes a fresh request
      throw error
    })
    cache.set(url, promise)
  }
  return cache.get(url)
}

// ---------- OpenF1: sessions ----------

export async function getRaces(year) {
  const races = await getJSON(`${OPENF1_URL}/sessions?year=${year}&session_name=Race`)
  return [...races].sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
}

export async function getSession(sessionKey) {
  const sessions = await getJSON(`${OPENF1_URL}/sessions?session_key=${sessionKey}`)
  if (sessions.length === 0) throw new Error('Session not found')
  return sessions[0]
}

// All sessions of one race weekend: practice, qualifying, sprint, race.
export async function getWeekendSessions(meetingKey) {
  const sessions = await getJSON(`${OPENF1_URL}/sessions?meeting_key=${meetingKey}`)
  return [...sessions].sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
}

// The "meeting" is the whole weekend, e.g. "Australian Grand Prix".
export async function getMeeting(meetingKey) {
  const meetings = await getJSON(`${OPENF1_URL}/meetings?meeting_key=${meetingKey}`)
  return meetings[0] ?? null
}

// ---------- OpenF1: session data ----------

export function getDrivers(sessionKey) {
  return getJSON(`${OPENF1_URL}/drivers?session_key=${sessionKey}`)
}

export function getResults(sessionKey) {
  return getJSON(`${OPENF1_URL}/session_result?session_key=${sessionKey}`)
}

export function getLaps(sessionKey) {
  return getJSON(`${OPENF1_URL}/laps?session_key=${sessionKey}`)
}

export function getStints(sessionKey) {
  return getJSON(`${OPENF1_URL}/stints?session_key=${sessionKey}`)
}

export function getPitStops(sessionKey) {
  return getJSON(`${OPENF1_URL}/pit?session_key=${sessionKey}`)
}

// Flags, safety cars, penalties, track limits... everything Race Control announces.
export function getRaceControl(sessionKey) {
  return getJSON(`${OPENF1_URL}/race_control?session_key=${sessionKey}`)
}

// ---------- OpenF1: telemetry for one lap ----------

// Builds the query for "this driver, between the start and end of this lap".
// %3E%3D is ">=" and %3C is "<" written in URL-safe form.
function lapQuery(sessionKey, lap) {
  const start = new Date(lap.date_start)
  const end = new Date(start.getTime() + lap.lap_duration * 1000)
  return (
    `session_key=${sessionKey}&driver_number=${lap.driver_number}` +
    `&date%3E%3D${start.toISOString()}&date%3C${end.toISOString()}`
  )
}

// Car position on track (x, y) during one lap, roughly 4 times per second.
export function getLapLocation(sessionKey, lap) {
  return getJSON(`${OPENF1_URL}/location?${lapQuery(sessionKey, lap)}`)
}

// Speed, throttle, brake, gear, RPM and DRS during one lap, plus where the car was.
export async function getLapTelemetry(sessionKey, lap) {
  const [car, location] = await Promise.all([
    getJSON(`${OPENF1_URL}/car_data?${lapQuery(sessionKey, lap)}`),
    getLapLocation(sessionKey, lap),
  ])
  return { lap, car, location }
}

// ---------- Jolpica ----------

// Both standings functions return { round, rows }.
// "round" tells us which race the standings are counted up to.
export async function getDriverStandings(year) {
  const json = await getJSON(`${JOLPICA_URL}/${year}/driverstandings.json`)
  const list = json.MRData.StandingsTable.StandingsLists[0]
  return { round: list?.round, rows: list?.DriverStandings ?? [] }
}

export async function getConstructorStandings(year) {
  const json = await getJSON(`${JOLPICA_URL}/${year}/constructorstandings.json`)
  const list = json.MRData.StandingsTable.StandingsLists[0]
  return { round: list?.round, rows: list?.ConstructorStandings ?? [] }
}
