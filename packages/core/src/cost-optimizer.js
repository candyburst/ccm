// Account cost optimizer — select the best account for each session
// based on a configurable strategy driven by real session data.

import { listAccounts } from './accounts.js'
import { getSessions } from './sessions.js'
import { accountBurnRate } from './burn-rate.js'

const STRATEGIES = ['round-robin', 'cheapest', 'fastest', 'reserved', 'random']

/**
 * Get the next non-exhausted account using the specified strategy.
 *
 * @param {Set}    exhausted  - Account names already exhausted this cycle
 * @param {object} opts
 * @param {string} [opts.strategy]      - Strategy name (default: 'round-robin')
 * @param {string} [opts.reservedName]  - For 'reserved' strategy: the account name
 * @param {string} [opts.currentName]   - Current account (for round-robin offset)
 * @returns {object|null} Next account or null if all exhausted
 */
export function selectAccount(exhausted = new Set(), opts = {}) {
  const strategy = opts.strategy || 'round-robin'
  const accounts = listAccounts()
    .filter(a => !a.disabled && !exhausted.has(a.name))

  if (accounts.length === 0) return null

  switch (strategy) {
    case 'round-robin': {
      const sorted = accounts.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      if (!opts.currentName) return sorted[0]
      const idx = sorted.findIndex(a => a.name === opts.currentName)
      return sorted[(idx + 1) % sorted.length] || sorted[0]
    }

    case 'cheapest': {
      // Prefer accounts with the most remaining tokens (lowest recent burn rate = most left)
      // Since we don't track remaining tokens directly, lowest burn rate = most remaining
      const withRates = accounts.map(a => ({
        ...a,
        tps: accountBurnRate(a.name) ?? Infinity,
      }))
      // Lower tps = slower burn = more tokens remaining
      return withRates.sort((a, b) => a.tps - b.tps)[0]
    }

    case 'fastest': {
      // Prefer accounts with lowest observed latency
      const sessions = getSessions({ limit: 200 })
      const latency  = {}
      for (const s of sessions) {
        if (s.firstTokenLatencyMs && s.account) {
          if (!latency[s.account]) latency[s.account] = []
          latency[s.account].push(s.firstTokenLatencyMs)
        }
      }
      const withLatency = accounts.map(a => {
        const lats = latency[a.name] || []
        const p50  = lats.length > 0
          ? lats.sort((x, y) => x - y)[Math.floor(lats.length / 2)]
          : Infinity
        return { ...a, p50 }
      })
      return withLatency.sort((a, b) => a.p50 - b.p50)[0]
    }

    case 'reserved': {
      const reserved = accounts.find(a => a.name === opts.reservedName)
      if (reserved) return reserved
      // Fall back to round-robin if reserved account is unavailable
      return selectAccount(exhausted, { ...opts, strategy: 'round-robin' })
    }

    case 'random': {
      return accounts[Math.floor(Math.random() * accounts.length)]
    }

    default:
      return accounts.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))[0]
  }
}

export { STRATEGIES }
