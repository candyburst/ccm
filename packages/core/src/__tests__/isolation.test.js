import { describe, it, expect, vi } from 'vitest'
import { getIsolationEnv, ISOLATION_METHODS } from '../isolation.js'

describe('getIsolationEnv', () => {
  it('returns object with CLAUDE_CONFIG_DIR for email accounts', () => {
    const account = { name: 'alice', type: 'email', sessionDir: '/tmp/ccm-alice' }
    const env = getIsolationEnv(account)
    expect(typeof env).toBe('object')
    expect(Object.keys(env)).toContain('CLAUDE_CONFIG_DIR')
  })

  it('sessionDir is used as CLAUDE_CONFIG_DIR', () => {
    const account = { name: 'bob', type: 'email', sessionDir: '/Users/bob/.ccm/sessions/bob' }
    const env = getIsolationEnv(account)
    expect(env.CLAUDE_CONFIG_DIR).toBe('/Users/bob/.ccm/sessions/bob')
  })
})

describe('ISOLATION_METHODS', () => {
  it('exports ENV and SYMLINK constants', () => {
    expect(ISOLATION_METHODS.ENV).toBeDefined()
    expect(ISOLATION_METHODS.SYMLINK).toBeDefined()
    expect(typeof ISOLATION_METHODS.ENV).toBe('string')
    expect(typeof ISOLATION_METHODS.SYMLINK).toBe('string')
  })
})
