import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock filesystem before importing accounts
vi.mock('fs', async (orig) => {
  const actual = await orig()
  let store = '{}'
  return {
    ...actual,
    existsSync:    vi.fn((p) => p.includes('accounts') ? store !== '{}' : actual.existsSync(p)),
    readFileSync:  vi.fn((p, enc) => p.includes('accounts') ? store : actual.readFileSync(p, enc)),
    writeFileSync: vi.fn((p, d) => { if (p.includes('accounts') || p.endsWith('.tmp')) store = d }),
    renameSync:    vi.fn(),
    mkdirSync:     vi.fn(),
    _reset:        () => { store = '{}' },
  }
})
vi.mock('../crypto.js', () => ({
  encrypt: vi.fn(text => `ENC:${text}`),
  decrypt: vi.fn(blob => blob.startsWith('ENC:') ? blob.slice(4) : null),
}))
vi.mock('../validate.js', () => ({
  validateApiKey: vi.fn(async (key) => {
    if (key === 'sk-ant-invalid') return { valid: false, reason: 'rejected', hint: 'bad key' }
    return { valid: true }
  }),
}))

import { addApiKeyAccount, addEmailAccount, listAccounts, getActiveAccount, setActiveAccount, removeAccount, updateAccount, getApiKey } from '../accounts.js'

describe('accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store
    const fs = require('fs')
    if (fs._reset) fs._reset()
  })

  it('addApiKeyAccount saves account and returns it', async () => {
    const acct = await addApiKeyAccount('work', 'sk-ant-test-key', 'main account')
    expect(acct.name).toBe('work')
    expect(acct.type).toBe('api_key')
    expect(acct.notes).toBe('main account')
  })

  it('addApiKeyAccount throws on invalid key', async () => {
    await expect(addApiKeyAccount('bad', 'sk-ant-invalid')).rejects.toThrow()
  })

  it('addEmailAccount creates account without validation', () => {
    const acct = addEmailAccount('alice', 'alice@example.com')
    expect(acct.name).toBe('alice')
    expect(acct.type).toBe('email')
    expect(acct.email).toBe('alice@example.com')
  })

  it('listAccounts returns all accounts as array', async () => {
    await addApiKeyAccount('a1', 'sk-ant-key-1')
    addEmailAccount('a2', 'a@b.com')
    const list = listAccounts()
    expect(list).toHaveLength(2)
  })

  it('setActiveAccount marks only one account active', async () => {
    await addApiKeyAccount('w1', 'sk-ant-key-1')
    await addApiKeyAccount('w2', 'sk-ant-key-2')
    setActiveAccount('w1')
    const list = listAccounts()
    expect(list.filter(a => a.active)).toHaveLength(1)
    expect(list.find(a => a.active)?.name).toBe('w1')
  })

  it('getActiveAccount returns the active account', async () => {
    await addApiKeyAccount('main', 'sk-ant-key-main')
    setActiveAccount('main')
    const active = getActiveAccount()
    expect(active?.name).toBe('main')
  })

  it('getActiveAccount returns null when none active', () => {
    expect(getActiveAccount()).toBeNull()
  })

  it('removeAccount removes the account', async () => {
    await addApiKeyAccount('toRemove', 'sk-ant-key-x')
    removeAccount('toRemove')
    const list = listAccounts()
    expect(list.find(a => a.name === 'toRemove')).toBeUndefined()
  })

  it('updateAccount updates fields', async () => {
    await addApiKeyAccount('upd', 'sk-ant-key-upd', 'old note')
    updateAccount('upd', { notes: 'new note', disabled: true })
    const list = listAccounts()
    const acct = list.find(a => a.name === 'upd')
    expect(acct?.notes).toBe('new note')
    expect(acct?.disabled).toBe(true)
  })

  it('getApiKey decrypts the key', async () => {
    await addApiKeyAccount('keytest', 'sk-ant-mykey')
    const list = listAccounts()
    const acct = list.find(a => a.name === 'keytest')
    expect(getApiKey(acct)).toBe('sk-ant-mykey')
  })

  it('new account has priority field set', async () => {
    await addApiKeyAccount('p1', 'sk-ant-key-p1')
    const [acct] = listAccounts()
    expect(typeof acct.priority).toBe('number')
  })
})
