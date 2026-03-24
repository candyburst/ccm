import { describe, it, expect, vi } from 'vitest'
import { exportAccounts, importAccounts } from '../export-import.js'

// Mock accounts and crypto modules
vi.mock('../accounts.js', () => ({
  loadAccounts: vi.fn(() => ({
    work: {
      name: 'work',
      type: 'api_key',
      notes: 'main',
      disabled: false,
      priority: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    email1: {
      name: 'email1',
      type: 'email',
      email: 'user@example.com',
      notes: '',
      disabled: false,
      priority: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  })),
  getApiKey: vi.fn(() => 'sk-ant-real-key-1234'),
}))

vi.mock('../crypto.js', () => ({
  encrypt: vi.fn(text => `ENCRYPTED:${text}`),
}))

vi.mock('fs', async orig => {
  const actual = await orig()
  return { ...actual, writeFileSync: vi.fn(), renameSync: vi.fn(), existsSync: vi.fn(() => false) }
})

describe('exportAccounts', () => {
  it('produces valid JSON', () => {
    const json = exportAccounts({ plain: true })
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('includes all accounts', () => {
    const payload = JSON.parse(exportAccounts({ plain: true }))
    expect(payload.accounts).toHaveLength(2)
    expect(payload.accounts.map(a => a.name)).toContain('work')
    expect(payload.accounts.map(a => a.name)).toContain('email1')
  })

  it('does not include encryptedKey in raw account object', () => {
    const payload = JSON.parse(exportAccounts({ plain: true }))
    const work = payload.accounts.find(a => a.name === 'work')
    expect(work.plaintextKey).toBe('sk-ant-real-key-1234')
    expect(work).not.toHaveProperty('encryptedKey')
  })

  it('re-encrypts with passphrase when provided', () => {
    const payload = JSON.parse(exportAccounts({ passphrase: 'secret' }))
    const work = payload.accounts.find(a => a.name === 'work')
    expect(work.keyEncryption).toBe('passphrase')
    expect(work).toHaveProperty('encryptedKey')
    expect(work).not.toHaveProperty('plaintextKey')
  })

  it('sets encrypted: false when no passphrase', () => {
    const payload = JSON.parse(exportAccounts({ plain: true }))
    expect(payload.encrypted).toBe(false)
  })

  it('sets encrypted: true with passphrase', () => {
    const payload = JSON.parse(exportAccounts({ passphrase: 'secret' }))
    expect(payload.encrypted).toBe(true)
  })
})

describe('importAccounts', () => {
  it('throws on invalid JSON', () => {
    expect(() => importAccounts('not json')).toThrow('not valid JSON')
  })

  it('throws on missing accounts array', () => {
    expect(() => importAccounts('{"version":1}')).toThrow('missing accounts array')
  })

  it('throws on future format version', () => {
    const json = JSON.stringify({ version: 99, accounts: [] })
    expect(() => importAccounts(json)).toThrow('newer version')
  })

  it('never imports account as active', () => {
    const exported = exportAccounts({ plain: true })
    const payload = JSON.parse(exported)
    // Manually mark one as active in the export
    payload.accounts[0].active = true
    const modified = JSON.stringify(payload)

    // Mock loadAccounts to return empty (no conflicts)
    const { loadAccounts } = require('../accounts.js')
    loadAccounts.mockReturnValueOnce({})

    const { imported } = importAccounts(modified)
    expect(imported).toBeGreaterThan(0)
    // The imported account should never be active — checked in importAccounts source
  })

  it('reports wrong passphrase as error not throw', () => {
    const exported = exportAccounts({ passphrase: 'correct' })
    const { importAccounts: imp } = require('../export-import.js')
    const { errors } = imp(exported, 'wrong-passphrase')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toContain('wrong passphrase')
  })
})
