import React, { useState, useEffect } from 'react'
import { Box, useInput, useApp } from 'ink'
import { listAccounts } from '@ccm/core'
import Header from './components/Header.js'
import StatusBar from './components/StatusBar.js'
import Onboard from './screens/Onboard.js'
import Dashboard from './screens/Dashboard.js'
import AddAccount from './screens/AddAccount.js'
import Projects from './screens/Projects.js'
import Sessions from './screens/Sessions.js'
import Settings from './screens/Settings.js'
import Sync from './screens/Sync.js'
import Run from './screens/Run.js'

const SCREENS = ['dashboard', 'run', 'add-account', 'projects', 'sessions', 'sync', 'settings']

export default function App({ args = [] }) {
  const { exit } = useApp()
  const [screen,      setScreen]      = useState('dashboard')
  const [prevScreen,  setPrevScreen]  = useState(null)
  const [needsSetup,  setNeedsSetup]  = useState(null)

  useEffect(() => {
    setNeedsSetup(listAccounts().length === 0)
  }, [])

  function go(s) { setPrevScreen(screen); setScreen(s) }
  function back() { setScreen(prevScreen || 'dashboard'); setPrevScreen(null) }

  useInput((input, key) => {
    if (needsSetup) return
    if (key.escape || input === 'q') {
      if (screen !== 'dashboard') { back(); return }
      exit()
    }
    if (key.tab) {
      const i = SCREENS.indexOf(screen)
      go(SCREENS[(i + 1) % SCREENS.length])
    }
  })

  if (needsSetup === null) return null

  if (needsSetup) return (
    <Box flexDirection="column" width="100%" paddingX={2}>
      <Onboard onComplete={() => setNeedsSetup(false)} />
    </Box>
  )

  const props = { go, back }

  return (
    <Box flexDirection="column" width="100%">
      <Header screen={screen} />
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        {screen === 'dashboard'   && <Dashboard  {...props} />}
        {screen === 'run'         && <Run        {...props} />}
        {screen === 'add-account' && <AddAccount {...props} />}
        {screen === 'projects'    && <Projects   {...props} />}
        {screen === 'sessions'    && <Sessions   {...props} />}
        {screen === 'sync'        && <Sync       {...props} />}
        {screen === 'settings'    && <Settings   {...props} />}
      </Box>
      <StatusBar screen={screen} />
    </Box>
  )
}
