const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const isDev = !app.isPackaged
const notifications = require('./notifications.js')

// Auto-updater — only active in packaged builds
// electron-updater checks GitHub Releases for new versions
let autoUpdater = null
if (!isDev) {
  try {
    const { autoUpdater: au } = require('electron-updater')
    autoUpdater = au
    autoUpdater.autoDownload    = true   // download in background
    autoUpdater.autoInstallOnAppQuit = false  // prompt user before installing
  } catch { /* electron-updater not available — skip */ }
}

// ── Core module cache ─────────────────────────────────────────────────────────
// Import once and cache — avoids ~20ms re-import penalty on every IPC call
let _core = null
async function getCoreOnce() {
  if (!_core) _core = await import('../../core/src/index.js')
  return _core
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return win
}

// ── Single instance lock ──────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) { if (win.isMinimized()) win.restore(); win.focus() }
  })

  app.whenReady().then(() => {
    const win = createWindow()

    // Check for updates 3 seconds after launch (non-blocking)
    if (autoUpdater) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {})
      }, 3000)

      autoUpdater.on('update-downloaded', () => {
        // Notify user that an update is ready
        const cfg = null  // cfg will be loaded lazily if needed
        if (BrowserWindow.getAllWindows().length > 0) {
          BrowserWindow.getAllWindows()[0].webContents
            .send('update:ready', {})
        }
      })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

// ── IPC helper ────────────────────────────────────────────────────────────────
// Wraps every handler in try/catch — an unhandled throw in a handler
// would otherwise crash the main process silently.

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { ok: true, data: await fn(event, ...args) }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })
}

// ── IPC: Accounts ─────────────────────────────────────────────────────────────

handle('accounts:list', async () => {
  const { listAccounts } = await getCoreOnce()
  return listAccounts()
})

handle('accounts:add-api-key', async (_, { name, apiKey, notes }) => {
  const { addApiKeyAccount } = await getCoreOnce()
  return addApiKeyAccount(name, apiKey, notes)
})

handle('accounts:add-email', async (_, { name, email, notes }) => {
  const { addEmailAccount } = await getCoreOnce()
  return addEmailAccount(name, email, notes)
})

handle('accounts:remove', async (_, name) => {
  const { removeAccount } = await getCoreOnce()
  return removeAccount(name)
})

handle('accounts:set-active', async (_, name) => {
  const { setActiveAccount } = await getCoreOnce()
  return setActiveAccount(name)
})

handle('accounts:get-active', async () => {
  const { getActiveAccount } = await getCoreOnce()
  return getActiveAccount()
})

handle('accounts:login-email', async (_, name) => {
  const { getAccount, loginEmailAccount } = await getCoreOnce()
  const account = getAccount(name)
  return loginEmailAccount(account)
})

handle('accounts:update', async (_, { name, updates }) => {
  const { updateAccount } = await getCoreOnce()
  return updateAccount(name, updates)
})

// ── IPC: Projects ─────────────────────────────────────────────────────────────

handle('projects:scan', async (_, rootDir) => {
  const { scanProjectsUnder, scanAllProjects } = await getCoreOnce()
  return rootDir ? scanProjectsUnder(rootDir) : scanAllProjects()
})

handle('projects:bind', async (_, { projectRoot, accountName }) => {
  const { bindProject } = await getCoreOnce()
  return bindProject(projectRoot, accountName)
})

handle('projects:init', async (_, { dir, accountName, name }) => {
  const { initProject } = await getCoreOnce()
  // If no dir provided, open native folder picker
  let targetDir = dir
  if (!targetDir) {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return { ok: false, error: 'cancelled' }
    targetDir = result.filePaths[0]
  }
  return initProject(targetDir, accountName, name || '')
})

handle('projects:check-gitignore', async (_, { projectDir, autoAdd }) => {
  const { ensureGitignore } = await getCoreOnce()
  return ensureGitignore(projectDir, { autoAdd })
})

handle('projects:get-scan-roots', async () => {
  const { loadSyncConfig } = await getCoreOnce()
  const cfg = loadSyncConfig()
  return cfg.projectScanRoots || []
})

handle('projects:set-scan-roots', async (_, roots) => {
  const { loadSyncConfig, saveSyncConfig } = await getCoreOnce()
  const cfg = loadSyncConfig()
  cfg.projectScanRoots = roots
  saveSyncConfig(cfg)
})

// ── IPC: Sessions ─────────────────────────────────────────────────────────────

handle('sessions:list', async (_, opts) => {
  const { getSessions } = await getCoreOnce()
  return getSessions(opts)
})

handle('sessions:stats', async () => {
  const { getSessionStats } = await getCoreOnce()
  return getSessionStats()
})

handle('sessions:clear', async () => {
  const { clearSessions } = await getCoreOnce()
  return clearSessions()
})

// ── IPC: Sync ─────────────────────────────────────────────────────────────────

handle('sync:load-config', async () => {
  const { loadSyncConfig } = await getCoreOnce()
  return loadSyncConfig()
})

handle('sync:save-config', async (_, cfg) => {
  const { saveSyncConfig } = await getCoreOnce()
  return saveSyncConfig(cfg)
})

handle('sync:git-status', async (_, root) => {
  const { getGitStatus } = await getCoreOnce()
  return getGitStatus(root)
})

handle('sync:checkpoint', async (_, root) => {
  const { gitCheckpoint } = await getCoreOnce()
  return gitCheckpoint(root)
})

handle('sync:list-checkpoints', async (_, account) => {
  const { listCheckpoints } = await getCoreOnce()
  return listCheckpoints(account)
})

handle('sync:test-remote', async (_, url) => {
  const { testRemote } = await getCoreOnce()
  return testRemote(url)
})

handle('sync:list-sessions', async (_, { accountName, cwd }) => {
  const { getAccount, listSessionFiles } = await getCoreOnce()
  const account = getAccount(accountName)
  return listSessionFiles(account, cwd)
})

// ── IPC: Config ───────────────────────────────────────────────────────────────

handle('config:load', async () => {
  const { loadSyncConfig } = await getCoreOnce()
  return loadSyncConfig()
})

handle('config:save', async (_, cfg) => {
  const { saveSyncConfig } = await getCoreOnce()
  return saveSyncConfig(cfg)
})

// ── IPC: Shell ────────────────────────────────────────────────────────────────

handle('shell:open', async (_, url) => {
  // Validate URL scheme — only https/http allowed; reject file://, javascript:, etc.
  try {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return { ok: false, error: `Blocked URL scheme: ${parsed.protocol}` }
    }
  } catch {
    return { ok: false, error: 'Invalid URL' }
  }
  await shell.openExternal(url)
})

handle('shell:getCwd', async () => {
  return process.cwd()
})

handle('updater:install', async () => {
  if (autoUpdater) autoUpdater.quitAndInstall()
})

handle('updater:check', async () => {
  if (!autoUpdater) return { available: false, reason: 'updater_not_available' }
  try {
    const result = await autoUpdater.checkForUpdates()
    return { available: !!result?.updateInfo, version: result?.updateInfo?.version }
  } catch (e) {
    return { available: false, error: e.message }
  }
})


// ── IPC: Export / Import ──────────────────────────────────────────────────────

handle('accounts:export', async (_, { passphrase, plain, includeLog }) => {
  const { exportAccounts } = await getCoreOnce()
  return exportAccounts({ passphrase, plain, includeLog })
})

handle('accounts:import', async (_, { jsonStr, passphrase }) => {
  const { importAccounts } = await getCoreOnce()
  return importAccounts(jsonStr, passphrase)
})

// ── IPC: Checkpoint diff ──────────────────────────────────────────────────────

handle('sync:checkpoint-diff', async (_, { projectRoot, commitHash }) => {
  // Run git diff between the given commit and HEAD
  const { spawnSync } = require('child_process')
  const r = spawnSync('git', ['diff', commitHash + '..HEAD', '--stat'], {
    cwd: projectRoot, encoding: 'utf8', timeout: 10000,
  })
  return { diff: r.stdout || '', error: r.stderr || '' }
})

handle('sync:restore-checkpoint', async (_, { projectRoot, commitHash }) => {
  const { spawnSync } = require('child_process')
  // Hard reset to the checkpoint commit
  const r = spawnSync('git', ['reset', '--hard', commitHash], {
    cwd: projectRoot, encoding: 'utf8', timeout: 15000,
  })
  return { success: r.status === 0, output: r.stdout + r.stderr }
})

handle('sync:push-all', async () => {
  const { scanAllProjects, pushProject } = await getCoreOnce()
  const projects = scanAllProjects()
  const results  = await Promise.all(
    projects.map(p => pushProject(p.projectRoot, { message: 'push all' })
      .then(r => ({ project: p.name, ...r }))
      .catch(e => ({ project: p.name, success: false, error: e.message }))
    )
  )
  return results
})

// ── IPC: Runner (streaming) ───────────────────────────────────────────────────

const activeSessions = new Map() // sessionId → child process

handle('runner:start', async (event, opts) => {
  // Double-spawn prevention: check AND reserve before any await
  const senderId = event.sender.id
  if (activeSessions.has(senderId)) {
    return { ok: false, error: 'session_already_running' }
  }
  activeSessions.set(senderId, null)  // reserve slot immediately — before any async gap

  const { getAccount, loadSyncConfig, runClaude } = await getCoreOnce()
  const { accountName, flags = [], projectRoot, projectName } = opts

  const account = getAccount(accountName)
  const cfg     = loadSyncConfig()

  const send = (type, payload) => {
    if (!event.sender.isDestroyed()) event.sender.send('runner:event', { type, ...payload })
  }

  // Mark as active before spawning — prevents double-click race
  activeSessions.set(senderId, { accountName, startedAt: Date.now(), pid: null })

  // Notify renderer that session is starting
  send('started', { accountName, projectName })

  runClaude(account, flags, {
    autoSwitch:  true,
    projectRoot,
    projectName,
    onPid:       (pid) => {
      const s = activeSessions.get(senderId)
      if (s) s.pid = pid
    },
    onStdout:    (txt) => send('stdout', { text: txt }),
    onLog:       (txt) => send('stderr', { text: txt }),
    onSwitch:    (from, to) => {
      send('credit-error', { from, to })
      notifications.notifySwitch(from, to, cfg)
    },
    onCheckpoint:(r) => {
      send('checkpoint', { result: r })
      if (r.success) notifications.notifyCheckpoint(r.commitHash, cfg)
    },
  }).then(result => {
    activeSessions.delete(senderId)
    send('closed', { code: result?.code, exhausted: !!result?.exhausted })
    if (result?.exhausted) {
      notifications.notifyAllExhausted(cfg)
    } else {
      notifications.notifySessionEnd(accountName, result?.durationSec ?? 0, cfg)
    }
  }).catch(err => {
    activeSessions.delete(senderId)
    send('error', { message: err.message })
  })
})

handle('runner:stop', async (event) => {
  const senderId = event.sender.id
  const session  = activeSessions.get(senderId)
  if (session?.pid) {
    try { process.kill(session.pid, 'SIGTERM') } catch { /* already exited */ }
  }
  activeSessions.delete(senderId)
})
