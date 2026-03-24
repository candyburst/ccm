const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ccm', {
  accounts: {
    list:       ()               => ipcRenderer.invoke('accounts:list'),
    addApiKey:  (p)              => ipcRenderer.invoke('accounts:add-api-key', p),
    addEmail:   (p)              => ipcRenderer.invoke('accounts:add-email', p),
    remove:     (name)           => ipcRenderer.invoke('accounts:remove', name),
    setActive:  (name)           => ipcRenderer.invoke('accounts:set-active', name),
    getActive:  ()               => ipcRenderer.invoke('accounts:get-active'),
    loginEmail: (name)           => ipcRenderer.invoke('accounts:login-email', name),
    update:     (name, updates)  => ipcRenderer.invoke('accounts:update', { name, updates }),
    export:     (opts)           => ipcRenderer.invoke('accounts:export', opts),
    import:     (jsonStr, pass)  => ipcRenderer.invoke('accounts:import', { jsonStr, passphrase: pass }),
  },
  projects: {
    scan:          (root)                    => ipcRenderer.invoke('projects:scan', root),
    bind:          (projectRoot, accountName) => ipcRenderer.invoke('projects:bind', { projectRoot, accountName }),
    init:          (dir, accountName, name)   => ipcRenderer.invoke('projects:init', { dir, accountName, name }),
    checkGitignore:(projectDir, autoAdd)      => ipcRenderer.invoke('projects:check-gitignore', { projectDir, autoAdd }),
    getScanRoots:  ()                         => ipcRenderer.invoke('projects:get-scan-roots'),
    setScanRoots:  (roots)                    => ipcRenderer.invoke('projects:set-scan-roots', roots),
  },
  sessions: {
    list:  (opts) => ipcRenderer.invoke('sessions:list', opts),
    stats: ()     => ipcRenderer.invoke('sessions:stats'),
    clear: ()     => ipcRenderer.invoke('sessions:clear'),
  },
  sync: {
    loadConfig:      ()        => ipcRenderer.invoke('sync:load-config'),
    saveConfig:      (cfg)     => ipcRenderer.invoke('sync:save-config', cfg),
    gitStatus:       (root)    => ipcRenderer.invoke('sync:git-status', root),
    checkpoint:      (root)    => ipcRenderer.invoke('sync:checkpoint', root),
    listCheckpoints: (account) => ipcRenderer.invoke('sync:list-checkpoints', account),
    testRemote:      (url)     => ipcRenderer.invoke('sync:test-remote', url),
    listSessions:    (opts)    => ipcRenderer.invoke('sync:list-sessions', opts),
    checkpointDiff:  (projectRoot, commitHash) => ipcRenderer.invoke('sync:checkpoint-diff', { projectRoot, commitHash }),
    restoreCheckpoint:(projectRoot, commitHash) => ipcRenderer.invoke('sync:restore-checkpoint', { projectRoot, commitHash }),
    pushAll:         ()        => ipcRenderer.invoke('sync:push-all'),
  },
  config: {
    load: ()    => ipcRenderer.invoke('config:load'),
    save: (cfg) => ipcRenderer.invoke('config:save', cfg),
  },
  shell: {
    open:   (url) => ipcRenderer.invoke('shell:open', url),
    getCwd: ()    => ipcRenderer.invoke('shell:getCwd'),
  },
  updater: {
    check:   () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    onReady: (cb) => {
      const handler = () => cb()
      ipcRenderer.on('update:ready', handler)
      return () => ipcRenderer.removeListener('update:ready', handler)
    },
  },
  runner: {
    start:   (opts)      => ipcRenderer.invoke('runner:start', opts),
    stop:    (sessionId) => ipcRenderer.invoke('runner:stop', sessionId),
    onEvent: (cb) => {
      const handler = (_, payload) => cb(payload)
      ipcRenderer.on('runner:event', handler)
      return () => ipcRenderer.removeListener('runner:event', handler)
    },
  },
})
