// Overnight task queue — run multiple Claude tasks back-to-back unattended.
// Persists to ~/.ccm/queue.json so it survives process restarts.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { CCM_DIR, TASK_STATUS } from './config.js'
import { runClaude } from './runner.js'
import { getActiveAccount, listAccounts } from './accounts.js'
import { debug } from './debug.js'

const QUEUE_FILE = join(CCM_DIR, 'queue.json')
const MAX_RETRIES = 3

// ── Persistence ───────────────────────────────────────────────────────────────

function loadQueue() {
  try {
    return JSON.parse(readFileSync(QUEUE_FILE, 'utf8'))
  } catch {
    return []
  }
}

function saveQueue(tasks) {
  mkdirSync(CCM_DIR, { recursive: true })
  writeFileSync(QUEUE_FILE, JSON.stringify(tasks, null, 2))
}

// ── Queue management ──────────────────────────────────────────────────────────

export function addTask(prompt, { projectRoot, name } = {}) {
  const tasks = loadQueue()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  tasks.push({
    id,
    name: name || prompt.slice(0, 40),
    prompt,
    projectRoot: projectRoot || null,
    status: TASK_STATUS.PENDING,
    retries: 0,
    accountUsed: null,
    startedAt: null,
    completedAt: null,
    exitReason: null,
  })
  saveQueue(tasks)
  return id
}

export function listTasks() {
  return loadQueue()
}

export function clearQueue() {
  saveQueue([])
}

export function removeTask(id) {
  const tasks = loadQueue().filter(t => t.id !== id)
  saveQueue(tasks)
}

// ── Execution ─────────────────────────────────────────────────────────────────

let _paused = false

export function pauseQueue() {
  _paused = true
}
export function resumeQueue() {
  _paused = false
}

/**
 * Work through the task queue unattended.
 * Rotates accounts on credit limit, retries on error (up to MAX_RETRIES).
 *
 * @param {object} [opts]
 * @param {Function} [opts.onTaskStart]    (task) => void
 * @param {Function} [opts.onTaskComplete] (task, result) => void
 * @param {Function} [opts.onTaskError]    (task, error) => void
 */
export async function runQueue(opts = {}) {
  const { onTaskStart, onTaskComplete, onTaskError } = opts

  while (true) {
    if (_paused) {
      await new Promise(r => setTimeout(r, 1000))
      continue
    }

    const tasks = loadQueue()
    const pending = tasks.find(t => t.status === 'pending')
    if (!pending) {
      debug('queue: all tasks complete')
      break
    }

    const account = getActiveAccount()
    if (!account) {
      debug('queue: no active account — stopping')
      break
    }

    // Mark as running
    pending.status = TASK_STATUS.RUNNING
    pending.startedAt = new Date().toISOString()
    pending.accountUsed = account.name
    saveQueue(tasks)

    onTaskStart?.(pending)
    debug(`queue: running task "${pending.name}" on ${account.name}`)

    try {
      // Queue tasks run Claude Code with the prompt written to a temp file
      // and passed via --message flag (supported in Claude Code ≥ 1.0.0).
      // If --message is not available on older versions, the session runs
      // interactively and the user must paste the prompt manually.
      const result = await runClaude(account, ['--message', pending.prompt], {
        projectRoot: pending.projectRoot,
        autoSwitch: true,
      })

      pending.status = result.exhausted ? TASK_STATUS.FAILED : TASK_STATUS.DONE
      pending.exitReason = result.exhausted ? 'all_accounts_exhausted' : 'normal'
      pending.completedAt = new Date().toISOString()
      saveQueue(loadQueue().map(t => (t.id === pending.id ? pending : t)))
      onTaskComplete?.(pending, result)
    } catch (e) {
      pending.retries++
      if (pending.retries >= MAX_RETRIES) {
        pending.status = TASK_STATUS.FAILED
        pending.exitReason = `error: ${e.message}`
        pending.completedAt = new Date().toISOString()
        onTaskError?.(pending, e)
      } else {
        pending.status = TASK_STATUS.PENDING // retry
        debug(`queue: task "${pending.name}" failed, retrying (${pending.retries}/${MAX_RETRIES})`)
      }
      saveQueue(loadQueue().map(t => (t.id === pending.id ? pending : t)))
    }
  }
}
