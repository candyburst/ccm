import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startSession, endSession, getSessions, getSessionStats, cleanupOrphanedSessions } from '../sessions.js'

// Mock filesystem
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal()
  const store  = { data: '[]' }
  return {
    ...actual,
    existsSync: vi.fn((p) => p.includes('session-log') ? store.data !== '[]' : actual.existsSync(p)),
    readFileSync: vi.fn((p, enc) => p.includes('session-log') ? store.data : actual.readFileSync(p, enc)),
    writeFileSync: vi.fn((p, d) => { if (p.includes('session-log')) store.data = d }),
    renameSync: vi.fn(),
    mkdirSync: vi.fn(),
    _store: store,
  }
})

describe('getSessions filters', () => {
  it('filters by account', () => {
    const id = startSession({ account: 'work' })
    endSession(id, { exitCode: 0 })
    startSession({ account: 'personal' })
    const sessions = getSessions({ account: 'work' })
    expect(sessions.every(s => s.account === 'work')).toBe(true)
  })

  it('filters by exitReason', () => {
    const id1 = startSession({ account: 'work' })
    endSession(id1, { exitCode: 0, exitReason: 'normal' })
    const id2 = startSession({ account: 'work' })
    endSession(id2, { exitCode: 402, exitReason: 'credit_limit' })

    const normals = getSessions({ exitReason: 'normal' })
    expect(normals.every(s => s.exitReason === 'normal')).toBe(true)
  })

  it('respects limit', () => {
    for (let i = 0; i < 5; i++) {
      const id = startSession({ account: 'work' })
      endSession(id, { exitCode: 0 })
    }
    const limited = getSessions({ limit: 3 })
    expect(limited.length).toBeLessThanOrEqual(3)
  })

  it('stores token data when provided', () => {
    const id = startSession({ account: 'work' })
    endSession(id, { exitCode: 0, tokens: { input: 1234, output: 567 } })
    const sessions = getSessions({ limit: 1 })
    expect(sessions[0].tokens).toEqual({ input: 1234, output: 567 })
  })
})

describe('getSessionStats', () => {
  it('returns zero-state with no sessions', () => {
    const stats = getSessionStats()
    expect(stats.total).toBe(0)
    expect(stats.switches).toBe(0)
    expect(typeof stats.totalSec).toBe('number')
  })
})
