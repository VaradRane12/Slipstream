import { useEffect, useState } from 'react'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export default function Countdown({ targetDate }) {
  const [now, setNow] = useState(() => Date.now())

  // Tick every second. The cleanup function clears the timer when the component
  // disappears, otherwise it would keep running in the background forever.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), SECOND)
    return () => clearInterval(id)
  }, [])

  const msLeft = Math.max(0, new Date(targetDate).getTime() - now)
  const parts = [
    { label: 'Days', value: Math.floor(msLeft / DAY) },
    { label: 'Hrs', value: Math.floor((msLeft % DAY) / HOUR) },
    { label: 'Min', value: Math.floor((msLeft % HOUR) / MINUTE) },
    { label: 'Sec', value: Math.floor((msLeft % MINUTE) / SECOND) },
  ]

  return (
    <div className="countdown">
      {parts.map((part) => (
        <div key={part.label} className="countdown__part">
          <span className="countdown__value">{String(part.value).padStart(2, '0')}</span>
          <span className="countdown__label">{part.label}</span>
        </div>
      ))}
    </div>
  )
}
