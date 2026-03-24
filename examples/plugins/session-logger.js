// Example CCM plugin: session-logger.js
// Logs all session events to ~/.ccm/plugin-session-log.json
//
// Install: copy to ~/.ccm/plugins/session-logger.js

import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const LOG_FILE = join(homedir(), '.ccm', 'plugin-session-log.json')

function log(event, data) {
  mkdirSync(join(homedir(), '.ccm'), { recursive: true })
  const entry = JSON.stringify({ event, ts: new Date().toISOString(), ...data }) + '\n'
  appendFileSync(LOG_FILE, entry)
}

export function onSessionStart({ account, projectRoot, flags }) {
  log('session_start', { account, projectRoot, flags })
}

export function onSessionEnd({ account, exitReason, durationSec }) {
  log('session_end', { account, exitReason, durationSec })
}

export function onSwitch({ from, to, sessionId }) {
  log('switch', { from, to, sessionId })
}

export function onCheckpoint({ commitHash, projectRoot, account }) {
  log('checkpoint', { commitHash, projectRoot, account })
}
