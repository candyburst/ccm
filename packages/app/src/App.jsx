import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Onboard from './pages/Onboard.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Projects from './pages/Projects.jsx'
import Sessions from './pages/Sessions.jsx'
import Settings from './pages/Settings.jsx'
import AddAccount from './pages/AddAccount.jsx'
import RunSession from './pages/RunSession.jsx'
import Sync from './pages/Sync.jsx'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [needsSetup, setNeedsSetup] = useState(null) // null = loading

  // On mount: check if any accounts exist. If not, show onboarding.
  useEffect(() => {
    window.ccm.accounts
      .list()
      .then(res => {
        const accounts = res?.data ?? res ?? []
        setNeedsSetup(accounts.length === 0)
      })
      .catch(() => setNeedsSetup(false)) // on IPC error, skip setup (don't block the app)
  }, [])

  // Still loading
  if (needsSetup === null)
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--text3)',
          fontSize: 13,
        }}
      >
        Loading...
      </div>
    )

  // First-run: show full-screen onboarding wizard
  if (needsSetup) return <Onboard onComplete={() => setNeedsSetup(false)} />

  const pages = {
    dashboard: <Dashboard onAdd={() => setPage('add-account')} />,
    run: <RunSession />,
    sync: <Sync />,
    projects: <Projects />,
    sessions: <Sessions />,
    settings: <Settings />,
    'add-account': <AddAccount onDone={() => setPage('dashboard')} />,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar page={page} setPage={setPage} />
      <main
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg2)',
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {pages[page] || pages.dashboard}
      </main>
    </div>
  )
}
