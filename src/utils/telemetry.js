// Turns raw car telemetry into data we can chart and compare.
//
// The problem: two drivers' samples are taken at different moments, so we can't just put
// them side by side by time. Instead we compare them by *distance* around the lap:
// "at 1,200 m into the lap, driver A was doing 290 km/h and driver B 284 km/h".

import { pointAtTime, toTrackPoints } from './track'

// OpenF1 DRS values: 10, 12 and 14 mean the flap is open.
const isDrsOpen = (drs) => drs >= 10

// The car doesn't send its distance, so we work it out ourselves:
// distance travelled = speed × time, added up sample by sample.
//
// Samples only arrive every ~0.27 s, so the first one is a bit after the lap starts and
// the last one a bit before it ends. We add a point at exactly 0 s and exactly the
// official lap time, so comparing two laps gives exactly the official gap at the line.
export function addDistance(carData, lapStart, lapDuration) {
  const startMs = new Date(lapStart).getTime()
  const sorted = [...carData].sort((a, b) => new Date(a.date) - new Date(b.date))
  if (sorted.length < 2) return []

  const samples = sorted.map((sample) => ({
    ...sample,
    time: (new Date(sample.date).getTime() - startMs) / 1000, // seconds into the lap
  }))
  samples.unshift({ ...samples[0], time: 0 })
  samples.push({ ...samples[samples.length - 1], time: lapDuration })

  let distance = 0
  return samples.map((sample, i) => {
    if (i > 0) {
      const previous = samples[i - 1]
      const seconds = sample.time - previous.time
      const averageSpeed = (sample.speed + previous.speed) / 2 / 3.6 // km/h → m/s
      distance += averageSpeed * seconds
    }
    return { ...sample, distance }
  })
}

// Our distance is slightly off (speed is rounded and only sampled ~4 times a second),
// so two laps of the same track come out a few metres different.
// We stretch the second lap so both are exactly the same length.
function scaleDistance(samples, targetLength) {
  const factor = targetLength / samples[samples.length - 1].distance
  return samples.map((s) => ({ ...s, distance: s.distance * factor }))
}

// Produces one reading every `step` metres (0 m, 10 m, 20 m...), so both drivers'
// data lines up row by row. Smooth values (speed, time) are blended between the
// two nearest samples; on/off values (brake, gear, DRS) just take the nearest sample.
function resampleByDistance(samples, step = 10) {
  const result = []
  const total = samples[samples.length - 1].distance
  let i = 0

  for (let distance = 0; distance <= total; distance += step) {
    while (i < samples.length - 2 && samples[i + 1].distance < distance) i++
    const a = samples[i]
    const b = samples[i + 1]
    const span = b.distance - a.distance
    const t = span > 0 ? Math.min(1, Math.max(0, (distance - a.distance) / span)) : 0
    const blend = (key) => a[key] + (b[key] - a[key]) * t
    const nearest = t < 0.5 ? a : b

    result.push({
      distance,
      time: blend('time'),
      speed: Math.round(blend('speed')),
      throttle: Math.min(100, Math.round(blend('throttle'))),
      rpm: Math.round(blend('rpm')),
      brake: nearest.brake > 0 ? 100 : 0,
      gear: nearest.n_gear,
      drs: isDrsOpen(nearest.drs) ? 1 : 0,
    })
  }
  return result
}

// Headline numbers for one lap.
function summarizeLap(samples, lap) {
  const percentOf = (count) => Math.round((count / samples.length) * 100)
  return {
    lapTime: lap.lap_duration,
    topSpeed: Math.max(...samples.map((s) => s.speed)),
    fullThrottle: percentOf(samples.filter((s) => s.throttle >= 98).length),
    braking: percentOf(samples.filter((s) => s.brake > 0).length),
    gearShifts: samples.filter((s, i) => i > 0 && s.n_gear !== samples[i - 1].n_gear).length,
    drsOpen: percentOf(samples.filter((s) => isDrsOpen(s.drs)).length),
  }
}

// Splits the lap into equal "mini-sectors" and works out who was quicker through each.
// Returns 'A' or 'B' for every row.
function compareMiniSectors(gridA, gridB, count = 25) {
  const length = Math.min(gridA.length, gridB.length)
  const size = Math.ceil(length / count)
  const winners = []
  for (let start = 0; start < length; start += size) {
    const end = Math.min(length - 1, start + size)
    const timeA = gridA[end].time - gridA[start].time
    const timeB = gridB[end].time - gridB[start].time
    const winner = timeA <= timeB ? 'A' : 'B'
    for (let i = start; i < start + size && i < length; i++) winners[i] = winner
  }
  return winners
}

// The main function: takes one or two laps of raw telemetry ({ lap, car, location })
// and returns everything the Telemetry tab needs.
export function analyseLaps(a, b) {
  const samplesA = addDistance(a.car, a.lap.date_start, a.lap.lap_duration)
  let samplesB = b ? addDistance(b.car, b.lap.date_start, b.lap.lap_duration) : null
  if (samplesA.length < 2 || (samplesB && samplesB.length < 2)) return null

  if (samplesB) samplesB = scaleDistance(samplesB, samplesA[samplesA.length - 1].distance)

  const gridA = resampleByDistance(samplesA)
  const gridB = samplesB ? resampleByDistance(samplesB) : null
  const trackA = toTrackPoints(a.location, a.lap.date_start)
  const trackB = b ? toTrackPoints(b.location, b.lap.date_start) : null

  // One row per 10 m. Keys ending in A / B belong to each driver.
  const rows = gridA.map((pointA, i) => {
    const pointB = gridB?.[i]
    const row = {
      distance: pointA.distance,
      speedA: pointA.speed,
      throttleA: pointA.throttle,
      brakeA: pointA.brake,
      gearA: pointA.gear,
      rpmA: pointA.rpm,
      drsA: pointA.drs,
      positionA: pointAtTime(trackA, pointA.time),
    }
    if (pointB) {
      Object.assign(row, {
        speedB: pointB.speed,
        throttleB: pointB.throttle,
        brakeB: pointB.brake,
        gearB: pointB.gear,
        rpmB: pointB.rpm,
        drsB: pointB.drs,
        positionB: pointAtTime(trackB, pointB.time),
        // How far behind B is at this point of the lap (positive = A is ahead).
        delta: pointB.time - pointA.time,
      })
    }
    return row
  })

  return {
    rows,
    summaryA: summarizeLap(samplesA, a.lap),
    summaryB: samplesB ? summarizeLap(samplesB, b.lap) : null,
    miniSectors: gridB ? compareMiniSectors(gridA, gridB) : null,
  }
}
