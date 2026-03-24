import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { SESSION_LOG, CCM_DIR, EXIT_REASONS } from './config.js'

function loadLog() {
  mkdirSync(CCM_DIR, { recursive: true })
  if (!existsSync(SESSION_LOG)) return []
  try {
    return JSON.parse(readFileSync(SESSION_LOG, 'utf8'))
  } catch {
    return []
  }
}

function saveLog(entries) {
  writeFileSync(SESSION_LOG, JSON.stringify(entries.slice(-500), null, 2))
}

export function startSession({ account, projectName, projectRoot }) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const entry = {
    id,
    account,
    projectName: projectName || null,
    projectRoot: projectRoot || null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationSec: null,
    exitCode: null,
    exitReason: EXIT_REASONS.RUNNING,
    switched: false,
    switchedTo: null,
    tokens: null, // { input, output } parsed from session output
  }
  const log = loadLog()
  log.push(entry)
  saveLog(log)
  return id
}

export function endSession(
  id,
  {
    exitCode,
    exitReason = EXIT_REASONS.NORMAL,
    switched = false,
    switchedTo = null,
    tokens = null,
  } = {}
) {
  const log = loadLog()
  const entry = log.find(e => e.id === id)
  if (!entry) return
  entry.endedAt = new Date().toISOString()
  entry.durationSec = Math.round((Date.now() - new Date(entry.startedAt).getTime()) / 1000)
  entry.exitCode = exitCode
  entry.exitReason = exitReason
  entry.switched = switched
  entry.switchedTo = switchedTo
  if (tokens) entry.tokens = tokens
  saveLog(log)
}

export function getSessions({
  limit = 50,
  account = null,
  from = null,
  to = null,
  exitReason = null,
} = {}) {
  let log = loadLog().reverse()
  if (account) log = log.filter(e => e.account === account)
  if (from) log = log.filter(e => e.startedAt && new Date(e.startedAt) >= new Date(from))
  if (to) log = log.filter(e => e.startedAt && new Date(e.startedAt) <= new Date(to))
  if (exitReason) log = log.filter(e => e.exitReason === exitReason)
  return log.slice(0, limit)
}

export function clearSessions() {
  saveLog([])
}

export function getSessionStats() {
  const log = loadLog()
  const byAccount = {}
  let totalSec = 0
  let switches = 0
  for (const e of log) {
    if (!byAccount[e.account]) byAccount[e.account] = { count: 0, totalSec: 0, switches: 0 }
    byAccount[e.account].count++
    byAccount[e.account].totalSec += e.durationSec || 0
    if (e.switched) {
      byAccount[e.account].switches++
      switches++
    }
    totalSec += e.durationSec || 0
  }
  return { total: log.length, totalSec, switches, byAccount }
}

export function cleanupOrphanedSessions(maxAgeMinutes = 60) {
  const log = loadLog()
  const cutoff = Date.now() - maxAgeMinutes * 60 * 1000
  let changed = false
  for (const e of log) {
    if (e.exitReason === EXIT_REASONS.RUNNING && new Date(e.startedAt).getTime() < cutoff) {
      e.exitReason = EXIT_REASONS.INTERRUPTED
      e.endedAt = e.endedAt || new Date().toISOString()
      e.durationSec =
        e.durationSec || Math.round((Date.now() - new Date(e.startedAt).getTime()) / 1000)
      changed = true
    }
  }
  if (changed) saveLog(log)
}
