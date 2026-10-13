import { NavLink, Link } from 'react-router-dom'
import useTheme from '../hooks/useTheme'

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="navbar__logo">
          <span className="navbar__logo-mark" aria-hidden="true" />
          <span className="navbar__wordmark">
            SLIP<span>STREAM</span>
          </span>
        </Link>

        <nav className="navbar__links">
          {/* NavLink adds an "active" class automatically when its page is open */}
          <NavLink to="/" end>
            Races
          </NavLink>
          <NavLink to="/standings">Standings</NavLink>
        </nav>

        <button
          className="icon-button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}
