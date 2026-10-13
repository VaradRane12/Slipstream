# 🏁 Slipstream: F1 Race Explorer

An interactive Formula 1 data explorer built with **React**. Pick any session since 2023 (practice,
qualifying, sprint or race) and replay it live, compare drivers' telemetry corner by corner, and dig into
results, lap times and tyre strategies.

## Features

- **Race calendar** for every season since 2023, with search, a season picker and a live countdown to the next race
- **Every session of the weekend**: FP1–3, Sprint Qualifying, Sprint, Qualifying (Q1 / Q2 / Q3) and the Race
- **Live replay**: watch the race play back with cars moving around the track, a leaderboard where
  overtakes slide into place, gaps, tyres, pit stops, safety cars and race control messages
  (play / pause, 1×–64× speed, scrub the timeline, follow a driver)
- **Telemetry**: compare two laps by speed, throttle, brake, gear, RPM and DRS, plus the time gap
  around the lap. Hovering the charts moves both cars on a track map coloured by speed, gear or who's faster
- **Results** with a team-coloured podium and full classification (DNF / DNS / DSQ)
- **Position chart**: every driver's position on every lap; click drivers to highlight their battles
- **Lap time comparison**: pick any drivers and compare pace, fastest lap, average and consistency,
  with an option to hide pit stop and safety car laps
- **Tyre strategy**: a timeline of every stint, built with plain HTML/CSS
- **Championship standings** for drivers and constructors
- Dark / light mode (remembered), responsive down to phone size, loading skeletons, error + retry, keyboard accessible

## Tech

| | |
|---|---|
| UI | React 19 (function components + hooks), JavaScript |
| Routing | React Router (URL params, search params, lazy-loaded routes) |
| Charts | Recharts (positions, lap times) and hand-made CSS (tyre strategy, standings bars) |
| Styling | Plain CSS with CSS variables for theming, Grid and Flexbox for layout |
| Build | Vite |
| Data | [OpenF1](https://openf1.org) and [Jolpica](https://github.com/jolpica/jolpica-f1) public APIs (no backend, no API key) |

## Run it

```bash
npm install
npm run dev
```

## Deploy with Docker

```bash
docker compose up -d --build
```

This builds the app with Node, then serves the static files with nginx (final image ~78 MB).
It runs on port 8080 by default; use `PORT=3000 docker compose up -d --build` to change it.

## Project structure

```
src/
  api/f1.js           all network requests, with caching and retry on rate limits
  hooks/useFetch.js   reusable loading / error / data hook
  hooks/useTheme.js   dark / light mode
  utils/race.js       pure functions that turn raw API data into chart data
  utils/telemetry.js  distance calculation, resampling and lap comparison
  utils/replay.js     the replay engine: where every car is at any moment
  utils/track.js      track map maths (interpolation, binary search)
  utils/format.js     lap time, date and gap formatting
  pages/              one component per route (Home, Standings, Session, 404)
  components/         reusable UI (cards, countdown, skeletons...)
  components/race/    the session tabs (results, replay, positions, lap times, telemetry, tyres)
  styles/             page-specific CSS
```

## How it works

**Position chart.** The API gives each driver's lap start times. A driver finishes lap N when they start
lap N+1, so for every lap I sort the drivers by when they crossed the line. (`computeLapPositions` in
`src/utils/race.js`.)

**Telemetry.** Cars send data ~4 times a second at different moments, so two laps can't be compared by
time. I work out distance (speed × time, added up), resample both laps every 10 m, and compare them
point by point. Each lap is pinned to its official start and finish, so the gap at the line matches the
official lap times exactly. (`src/utils/telemetry.js`.)

**Live replay.** Downloading GPS for every car for a whole race would be ~50 MB. Instead, lap timing
tells me how far through its lap each car is (say 40%), and one reference lap's GPS trace tells me where
on track that is. (`src/utils/replay.js`.)

---
Unofficial fan project. Not affiliated with Formula 1.
