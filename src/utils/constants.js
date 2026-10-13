// OpenF1 only has data from the 2023 season onwards.
export const FIRST_SEASON = 2023
export const CURRENT_SEASON = new Date().getFullYear()

// [2026, 2025, 2024, 2023]
export const SEASONS = Array.from(
  { length: CURRENT_SEASON - FIRST_SEASON + 1 },
  (_, i) => CURRENT_SEASON - i,
)

export const TYRE_COLORS = {
  SOFT: '#ff3333',
  MEDIUM: '#ffd12e',
  HARD: '#ebebeb',
  INTERMEDIATE: '#43b02a',
  WET: '#0067ad',
}

// The standings API doesn't send colours, so we keep our own list (keyed by its team id).
export const CONSTRUCTOR_COLORS = {
  red_bull: '#3671C6',
  ferrari: '#E8002D',
  mercedes: '#27F4D2',
  mclaren: '#FF8000',
  aston_martin: '#229971',
  alpine: '#00A1E8',
  williams: '#64C4FF',
  rb: '#6692FF',
  alphatauri: '#5E8FAA',
  sauber: '#52E252',
  alfa: '#C92D4B',
  audi: '#BB0A30',
  haas: '#B6BABD',
  cadillac: '#C9A227',
}
