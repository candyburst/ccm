import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  accountBurnRate,
  estimateTimeRemaining,
  formatTimeRemaining,
  burnRateAlertLevel,
  getAllBurnRates,
} from '../burn-rate.js'

// Mock getSessions
vi.mock('../sessions.js', () => ({
  getSessions: vi.fn(),
}))
import { getSessions } from '../sessions.js'

describe('accountBurnRate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no sessions', () => {
    getSessions.mockReturnValue([])
    expect(accountBurnRate('work')).toBeNull()
  })

  it('returns null when sessions have no token data', () => {
    getSessions.mockReturnValue([
      { account: 'work', durationSec: 100, exitReason: 'normal', tokens: null },
    ])
    expect(accountBurnRate('work')).toBeNull()
  })

  it('returns null when durationSec is zero', () => {
    getSessions.mockReturnValue([
      {
        account: 'work',
        durationSec: 0,
        exitReason: 'normal',
        tokens: { input: 1000, output: 500 },
      },
    ])
    expect(accountBurnRate('work')).toBeNull()
  })

  it('computes correct tokens-per-second', () => {
    getSessions.mockReturnValue([
      {
        account: 'work',
        durationSec: 100,
        exitReason: 'normal',
        tokens: { input: 800, output: 200 },
      },
    ])
    // 1000 tokens / 100 sec = 10 tps
    expect(accountBurnRate('work')).toBe(10)
  })

  it('weights recent sessions higher', () => {
    // Two sessions: old (slow) and recent (fast)
    // With weights 1 and 2: (5*1 + 20*2) / 3 = 15
    getSessions.mockReturnValue([
      { account: 'x', durationSec: 100, exitReason: 'normal', tokens: { input: 2000, output: 0 } }, // 20 tps, weight 2
      { account: 'x', durationSec: 100, exitReason: 'normal', tokens: { input: 500, output: 0 } }, // 5 tps,  weight 1
    ])
    const rate = accountBurnRate('x')
    expect(rate).toBe(15)
  })

  it('never returns NaN', () => {
    getSessions.mockReturnValue([
      { account: 'x', durationSec: 60, exitReason: 'normal', tokens: { input: 0, output: 0 } },
    ])
    const rate = accountBurnRate('x')
    expect(rate === null || (!isNaN(rate) && isFinite(rate))).toBe(true)
  })
})

describe('estimateTimeRemaining', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no burn rate data', () => {
    getSessions.mockReturnValue([])
    expect(estimateTimeRemaining('work', 100000)).toBeNull()
  })

  it('returns null when remainingTokens is zero', () => {
    expect(estimateTimeRemaining('work', 0)).toBeNull()
  })

  it('computes correct estimate', () => {
    getSessions.mockReturnValue([
      {
        account: 'work',
        durationSec: 100,
        exitReason: 'normal',
        tokens: { input: 1000, output: 0 },
      },
    ])
    // 10 tps, 3000 remaining → 300 seconds
    expect(estimateTimeRemaining('work', 3000)).toBe(300)
  })
})

describe('formatTimeRemaining', () => {
  it('returns null for null input', () => {
    expect(formatTimeRemaining(null)).toBeNull()
  })

  it('formats hours and minutes', () => {
    expect(formatTimeRemaining(9000)).toBe('~2h 30m')
  })

  it('formats minutes only', () => {
    expect(formatTimeRemaining(1800)).toBe('~30m')
  })

  it('formats sub-minute as <1m', () => {
    expect(formatTimeRemaining(45)).toBe('<1m')
  })

  it('returns exhausted for zero', () => {
    expect(formatTimeRemaining(0)).toBe('exhausted')
  })
})

describe('burnRateAlertLevel', () => {
  it('returns null when seconds is null', () => {
    expect(burnRateAlertLevel(null)).toBeNull()
  })

  it('returns critical for <= 10 min', () => {
    expect(burnRateAlertLevel(600)).toBe('critical')
    expect(burnRateAlertLevel(300)).toBe('critical')
  })

  it('returns warning for <= 30 min', () => {
    expect(burnRateAlertLevel(1800)).toBe('warning')
    expect(burnRateAlertLevel(1000)).toBe('warning')
  })

  it('returns null when well above thresholds', () => {
    expect(burnRateAlertLevel(7200)).toBeNull()
  })
})
