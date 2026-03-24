// Watch mode — auto-restart Claude Code on non-credit exits (crashes, network drops).
// Wraps runClaude with exponential backoff and a failure threshold.

import { runClaude } from './runner.js'
import { debug } from './debug.js'

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000] // cap at 30s
const MAX_FAILURES = 5 // stop after this many consecutive non-credit failures
const FAILURE_WINDOW_MS = 120000 // 2 minutes — reset counter after this

/**
 * Run Claude Code with automatic restart on non-credit failures.
 * @param {object}   account  - Account to run with
 * @param {string[]} args     - CLI args to pass to Claude
 * @param {object}   opts     - Same opts as runClaude, plus:
 * @param {Function} [opts.onRestart]  - Called before each restart: (attempt, delaySec) => void
 * @param {number}   [opts.maxFailures] - Override MAX_FAILURES
 */
export async function watchClaude(account, args = [], opts = {}) {
  const { onRestart, maxFailures = MAX_FAILURES, ...runOpts } = opts

  let attempt = 0
  let consecutiveFails = 0
  let lastFailTime = null
  let resumeSessionId = runOpts.resumeSessionId ?? null

  while (true) {
    debug(`watch: attempt ${attempt + 1}, consecutive fails: ${consecutiveFails}`)

    const result = await runClaude(account, args, {
      ...runOpts,
      resumeSessionId,
    })

    // Normal exit or credit exhaustion — stop watching
    if (result.code === 0) {
      debug('watch: normal exit — stopping')
      return result
    }

    if (result.exhausted) {
      debug('watch: all accounts exhausted — stopping')
      return result
    }

    // Credit limit switch handled internally by runClaude — if we get here
    // without exhaustion it means a credit switch succeeded; update resume id
    if (result.sessionId) {
      resumeSessionId = result.sessionId
    }

    const now = Date.now()

    // Reset failure counter if outside the failure window
    if (lastFailTime && now - lastFailTime > FAILURE_WINDOW_MS) {
      consecutiveFails = 0
    }

    consecutiveFails++
    lastFailTime = now
    attempt++

    if (consecutiveFails >= maxFailures) {
      process.stderr.write(
        `\n[ccm] ${maxFailures} consecutive failures within 2 minutes — stopping watch mode\n`
      )
      return result
    }

    // Exponential backoff
    const delaySec = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)] / 1000
    process.stderr.write(
      `\n[ccm] Session exited (code ${result.code}) — restarting in ${delaySec}s ` +
        `(attempt ${attempt}, ${maxFailures - consecutiveFails} retries left)\n`
    )

    onRestart?.(attempt, delaySec)
    await new Promise(r => setTimeout(r, delaySec * 1000))
  }
}
