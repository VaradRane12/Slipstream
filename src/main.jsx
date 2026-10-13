import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App.jsx'
import HomePage from './pages/HomePage.jsx'
import StandingsPage from './pages/StandingsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import Skeleton from './components/Skeleton.jsx'
import './index.css'

// Code splitting: the session page (and the big chart library it uses) is only
// downloaded when someone actually opens a session, so the home page loads faster.
const SessionPage = lazy(() => import('./pages/SessionPage.jsx'))

// All the pages of the app. <App /> is the shared layout (navbar + footer),
// and the matching page is drawn inside it where App puts <Outlet />.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="standings" element={<StandingsPage />} />
          <Route
            path="session/:sessionKey"
            element={
              <Suspense fallback={<Skeleton rows={6} height={64} />}>
                <SessionPage />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
