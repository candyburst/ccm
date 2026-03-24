// Credit burn rate predictor — estimates time remaining on each account
// based on token usage from session history.
//
// Uses a weighted average over the last 5 sessions (most recent weighted higher).
// Degrades gracefully: when token data is unavailable, returns null — never NaN.

import { getSessions } from './sessions.js'
import { EXIT_REASONS } from './config.js'

const MAX_SESSIONS      = 5
const WARN_THRESHOLDS   = [1800, 600]  // 30 min, 10 min in seconds

/**
 * Compute weighted average tokens per second for an account.
 * Returns null if not enough data to make a meaningful estimate.
 *
 * @param {string} accountName
 * @returns {number|null} tokens per second, or null
 */
export function accountBurnRate(accountName) {
  const sessions = getSessions({ account: accountName, limit: MAX_SESSIONS * 3 })
    .filter(s => s.tokens && s.durationSec > 0 && s.exitReason !== EXIT_REASONS.RUNNING)
    .slice(0, MAX_SESSIONS)

  if (sessions.length === 0) return null

  // Weighted average: most recent session has weight MAX_SESSIONS, oldest has weight 1
  let weightedSum  = 0
  let totalWeight  = 0

  sessions.forEach((s, i) => {
    const totalTokens = (s.tokens.input || 0) + (s.tokens.output || 0)
    if (totalTokens === 0 || s.durationSec === 0) return
    const tps    = totalTokens / s.durationSec
    const weight = sessions.length - i  // most recent = highest weight
    weightedSum  += tps * weight
    totalWeight  += weight
  })

  if (totalWeight === 0) return null
  const rate = weightedSum / totalWeight
  return isFinite(rate) && !isNaN(rate) ? rate : null
}

/**
 * Estimate seconds remaining on an account given its remaining token budget.
 *
 * @param {string} accountName
 * @param {number} remainingTokens
 * @returns {number|null} seconds remaining, or null if unknown
 */
export function estimateTimeRemaining(accountName, remainingTokens) {
  if (!remainingTokens || remainingTokens <= 0) return null
  const tps = accountBurnRate(accountName)
  if (!tps || tps <= 0) return null
  return Math.round(remainingTokens / tps)
}

/**
 * Format seconds into a human-readable string: "2h 20m", "45m", "8m"
 */
export function formatTimeRemaining(seconds) {
  if (seconds === null || seconds === undefined) return null
  if (seconds <= 0) return 'exhausted'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `~${h}h ${m}m`
  if (m > 0) return `~${m}m`
  return '<1m'
}

/**
 * Check whether a time estimate crosses a warning threshold.
 * Returns 'critical' (≤10 min), 'warning' (≤30 min), or null.
 *
 * @param {number|null} secondsRemaining
 * @param {number[]} thresholds  [warn_sec, critical_sec] — default [1800, 600]
 */
export function burnRateAlertLevel(secondsRemaining, thresholds = WARN_THRESHOLDS) {
  if (secondsRemaining === null) return null
  const [warnSec, critSec] = thresholds
  if (secondsRemaining <= critSec)  return 'critical'
  if (secondsRemaining <= warnSec)  return 'warning'
  return null
}

/**
 * Get burn rate summary for all accounts — used by Dashboard.
 * Returns an array of { name, tps, secondsRemaining, label, alertLevel }
 *
 * @param {object[]} accounts  - from listAccounts()
 * @param {object}   cfg       - sync config (for burnWarnThresholds)
 */
export function getAllBurnRates(accounts, cfg = {}) {
  const thresholds = cfg.burnWarnThresholds || WARN_THRESHOLDS
  return accounts.map(account => {
    const tps = accountBurnRate(account.name)
    // remainingTokens not yet tracked per-account — returns null until usage tracking is implemented
    const secondsRemaining = null
    return {
      name:           account.name,
      tps:            tps ? Math.round(tps) : null,
      secondsRemaining,
      label:          secondsRemaining !== null ? formatTimeRemaining(secondsRemaining) : null,
      alertLevel:     burnRateAlertLevel(secondsRemaining, thresholds),
      hasData:        tps !== null,
    }
  })
}
