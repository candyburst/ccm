// Integration tests — multi-module flows
// These tests exercise the critical paths end-to-end with minimal mocking

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdirSync, writeFileSync, existsSync } from 'fs'

// ── Full switch flow ──────────────────────────────────────────────────────────
// Mock claude binary: first invocation prints credit-limit error, second exits 0

vi.mock('../sessions.js',         () => ({ startSession: vi.fn(() => 'sess-1'), endSession: vi.fn(), cleanupOrphanedSessions: vi.fn() }))
vi.mock('../checkpoint.js',       () => ({ loadSyncConfig: vi.fn(() => ({ autoSwitch: true, smartResume: false, gitCheckpoint: false })), backupSessionFile: vi.fn() }))
vi.mock('../session-transfer.js', () => ({ findLatestSession: vi.fn(() => null), transferSession: vi.fn() }))
vi.mock('../github-sync.js',      () => ({ pushProject: vi.fn() }))
vi.mock('../isolation.js',        () => ({ getIsolationEnv: vi.fn(() => ({})), prepareIsolation: vi.fn(() => () => {}), getIsolationMethod: vi.fn(() => 'env') }))
vi.mock('../plugins.js',          () => ({ loadPlugins: vi.fn(async () => []), firePluginEvent: vi.fn(async () => {}) }))
vi.mock('../hooks.js',            () => ({ ensureHooksRegistered: vi.fn() }))
vi.mock('../context-injector.js', () => ({ buildContextMessage: vi.fn(() => null) }))
vi.mock('../resume-verify.js',    () => ({ detectResumeOutcome: vi.fn(() => 'unknown'), extractSessionSummary: vi.fn(() => null) }))
vi.mock('../crypto.js',           () => ({ encrypt: vi.fn(k => `ENC:${k}`), decrypt: vi.fn(b => b.startsWith('ENC:') ? b.slice(4) : null) }))

import { runClaude }   from '../runner.js'
import { spawn }       from 'child_process'
import { EventEmitter } from 'events'

vi.mock('child_process', () => ({ spawn: vi.fn() }))

vi.mock('../accounts.js', () => ({
  getApiKey:         vi.fn(() => 'sk-ant-key'),
  setActiveAccount:  vi.fn(),
  listAccounts:      vi.fn(),
}))

function mockProcess(exitCode, stderrData = []) {
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdin  = { write: vi.fn(), end: vi.fn() }
  setTimeout(() => {
    for (const d of stderrData) child.stderr.emit('data', Buffer.from(d))
    child.stdout.emit('data', Buffer.from(''))
    child.emit('close', exitCode)
  }, 5)
  return child
}

describe('full account switch flow', () => {
  const work   = { name: 'work',   type: 'api_key', provider: 'anthropic', disabled: false, priority: 0 }
  const backup = { name: 'backup', type: 'api_key', provider: 'anthropic', disabled: false, priority: 1 }

  beforeEach(() => vi.clearAllMocks())

  it('switches to backup when work hits credit limit, resumes on backup', async () => {
    const { listAccounts } = await import('../accounts.js')
    listAccounts
      .mockReturnValueOnce([work, backup]) // initial call
      .mockReturnValue([work, backup])     // rotation calls

    let call = 0
    spawn.mockImplementation(() => {
      call++
      return call === 1
        ? mockProcess(1, ['Error: credit balance is too low'])
        : mockProcess(0)
    })

    const onSwitch = vi.fn()
    const result   = await runClaude(work, [], { autoSwitch: true, onSwitch })

    expect(onSwitch).toHaveBeenCalledWith('work', 'backup')
    expect(result.code).toBe(0)
  })

  it('exits cleanly with exhausted=true when all accounts are exhausted', async () => {
    const { listAccounts } = await import('../accounts.js')
    listAccounts.mockReturnValue([work])

    spawn.mockImplementation(() => mockProcess(1, ['Error: insufficient credits']))

    const result = await runClaude(work, [], { autoSwitch: true })
    expect(result.exhausted).toBe(true)
  })

  it('never passes CCM_SECRET to subprocess env', async () => {
    process.env.CCM_SECRET = 'topsecret'
    const { listAccounts } = await import('../accounts.js')
    listAccounts.mockReturnValue([work])
    spawn.mockImplementation(() => mockProcess(0))

    await runClaude(work, [], {})

    const spawnedEnv = spawn.mock.calls[0][2].env
    expect(spawnedEnv.CCM_SECRET).toBeUndefined()
    delete process.env.CCM_SECRET
  })

  it('never passes CCM_DEBUG to subprocess env', async () => {
    process.env.CCM_DEBUG = '1'
    const { listAccounts } = await import('../accounts.js')
    listAccounts.mockReturnValue([work])
    spawn.mockImplementation(() => mockProcess(0))

    await runClaude(work, [], {})

    const spawnedEnv = spawn.mock.calls[0][2].env
    expect(spawnedEnv.CCM_DEBUG).toBeUndefined()
    delete process.env.CCM_DEBUG
  })
})

// ── Export/import round-trip ──────────────────────────────────────────────────
describe('export → import round-trip', () => {
  it('API keys survive export with passphrase and reimport', async () => {
    const { exportAccounts, importAccounts } = await import('../export-import.js')
    const { loadAccounts, getApiKey }        = await import('../accounts.js')

    // Mock account data
    loadAccounts.mockReturnValue({
      work: {
        name: 'work', type: 'api_key', notes: 'test',
        disabled: false, priority: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    })
    // getApiKey returns the raw key
    getApiKey.mockReturnValue('sk-ant-test-real-key')

    const json = exportAccounts({ passphrase: 'testpass123' })
    const payload = JSON.parse(json)

    expect(payload.encrypted).toBe(true)
    expect(payload.accounts[0].keyEncryption).toBe('passphrase')
    expect(payload.accounts[0]).not.toHaveProperty('plaintextKey')

    // Import with correct passphrase
    loadAccounts.mockReturnValue({}) // empty — no conflicts
    const { importAccounts: imp } = await import('../export-import.js')
    const result = imp(json, 'testpass123')
    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('wrong passphrase returns error per-account, does not throw', async () => {
    const { exportAccounts, importAccounts } = await import('../export-import.js')
    const { loadAccounts, getApiKey } = await import('../accounts.js')

    loadAccounts.mockReturnValue({
      work: { name: 'work', type: 'api_key', notes: '', disabled: false, priority: 0, createdAt: '2026-01-01T00:00:00.000Z' },
    })
    getApiKey.mockReturnValue('sk-ant-key')

    const json = exportAccounts({ passphrase: 'correct' })

    loadAccounts.mockReturnValue({})
    const { importAccounts: imp } = await import('../export-import.js')
    const result = imp(json, 'wrong')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.imported).toBe(0)
  })
})
