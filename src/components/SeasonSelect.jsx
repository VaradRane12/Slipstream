import { SEASONS } from '../utils/constants'

// A "controlled" select: the parent owns the value and gets told when it changes.
export default function SeasonSelect({ value, onChange }) {
  return (
    <label className="select">
      <span className="select__label">Season</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {SEASONS.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  )
}
