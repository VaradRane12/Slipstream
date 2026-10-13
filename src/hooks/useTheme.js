import { useEffect, useState } from 'react'

// Reads the saved theme, or falls back to the operating system's preference.
function getInitialTheme() {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage can be blocked (e.g. private browsing). That's fine, just use the default.
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export default function useTheme() {
  // Passing a function to useState means getInitialTheme only runs on the first render.
  const [theme, setTheme] = useState(getInitialTheme)

  // Whenever the theme changes, put it on <html data-theme="..."> so the CSS variables switch,
  // and remember it for next time.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  return { theme, toggleTheme }
}
