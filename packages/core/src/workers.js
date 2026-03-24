// Parallel session manager — named worker processes.
// Each worker runs its own Claude Code session with independent credit rotation.
// Workers share the account pool via file-locking (never same account simultaneously).

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, renameSync } from 'fs'
import { join } from 'path'
import { CCM_DIR } from './config.js'
import { listAccounts, getActiveAccount } from './accounts.js'
import { runClaude } from './runner.js'
import { debug } from './debug.js'

const WORKERS_FILE = join(CCM_DIR, 'workers.json')
const LOCK_DIR = join(CCM_DIR, 'account-locks')

// ── Persistence ───────────────────────────────────────────────────────────────

function loadWorkers() {
  try {
    return JSON.parse(readFileSync(WORKERS_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function saveWorkers(workers) {
  mkdirSync(CCM_DIR, { recursive: true })
  const tmp = WORKERS_FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(workers, null, 2))
  renameSync(tmp, WORKERS_FILE)
}

// ── Account locking ───────────────────────────────────────────────────────────
// File-based lock: one file per account in ~/.ccm/account-locks/<name>.lock

function acquireLock(accountName) {
  mkdirSync(LOCK_DIR, { recursive: true })
  const lockFile = join(LOCK_DIR, `${accountName}.lock`)
  if (existsSync(lockFile)) {
    // Check if the lock is stale (PID no longer running)
    try {
      const { pid } = JSON.parse(readFileSync(lockFile, 'utf8'))
      try {
        process.kill(pid, 0)
      } catch {
        /* PID gone — stale lock */ writeFileSync(lockFile, JSON.stringify({ pid: process.pid }))
        return true
      }
      return false // lock is held by active process
    } catch {
      /* corrupt lock — overwrite */
    }
  }
  writeFileSync(lockFile, JSON.stringify({ pid: process.pid, lockedAt: new Date().toISOString() }))
  return true
}

function releaseLock(accountName) {
  const lockFile = join(LOCK_DIR, `${accountName}.lock`)
  try {
    unlinkSync(lockFile)
  } catch {
    /* already released */
  }
}

// ── Worker API ────────────────────────────────────────────────────────────────

export function listWorkers() {
  const workers = loadWorkers()
  return Object.entries(workers).map(([name, w]) => ({ name, ...w }))
}

export function getWorker(name) {
  return loadWorkers()[name] || null
}

export function stopWorker(name) {
  const workers = loadWorkers()
  const worker = workers[name]
  if (!worker) return false
  try {
    process.kill(worker.pid, 'SIGTERM')
  } catch {
    /* already stopped */
  }
  releaseLock(worker.account)
  delete workers[name]
  saveWorkers(workers)
  return true
}

export function stopAllWorkers() {
  const workers = loadWorkers()
  for (const [name, w] of Object.entries(workers)) {
    try {
      process.kill(w.pid, 'SIGTERM')
    } catch {
      /* already stopped */
    }
    releaseLock(w.account)
  }
  saveWorkers({})
}

/**
 * Start a named worker session.
 * Finds a free account (not locked by another worker) and runs Claude Code.
 *
 * @param {string} workerName
 * @param {string[]} args       - CLI args to pass to claude
 * @param {object} opts         - Same as runClaude opts
 */
export async function startWorker(workerName, args = [], opts = {}) {
  const workers = loadWorkers()
  if (workers[workerName]) throw new Error(`Worker "${workerName}" is already running`)

  // Find a free account
  const allAccounts = listAccounts().filter(a => !a.disabled)
  let account = null
  for (const a of allAccounts) {
    if (acquireLock(a.name)) {
      account = a
      break
    }
  }
  if (!account)
    throw new Error(
      'No free accounts available for worker — all accounts are locked by other workers'
    )

  // Register worker
  workers[workerName] = {
    pid: process.pid,
    account: account.name,
    projectRoot: opts.projectRoot || null,
    startedAt: new Date().toISOString(),
    status: 'running',
  }
  saveWorkers(workers)
  debug(`worker "${workerName}": starting on ${account.name}`)

  try {
    const result = await runClaude(account, args, {
      ...opts,
      autoSwitch: true,
    })

    // Update worker status on completion
    const updated = loadWorkers()
    if (updated[workerName]) {
      updated[workerName].status = 'done'
      updated[workerName].exitCode = result.code
      updated[workerName].completedAt = new Date().toISOString()
      saveWorkers(updated)
    }
    return result
  } finally {
    releaseLock(account.name)
    const final = loadWorkers()
    delete final[workerName]
    saveWorkers(final)
  }
}
