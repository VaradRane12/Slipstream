import { Outlet } from 'react-router-dom'
import Navbar from './components/Navbar'

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="container main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container">
          Data from <a href="https://openf1.org" target="_blank" rel="noreferrer">OpenF1</a> and{' '}
          <a href="https://github.com/jolpica/jolpica-f1" target="_blank" rel="noreferrer">Jolpica</a>.
          Unofficial fan project, not affiliated with Formula 1.
        </div>
      </footer>
    </div>
  )
}
