import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all side-effecting modules
vi.mock('../sessions.js',        () => ({ startSession: vi.fn(() => 'sess-1'), endSession: vi.fn(), cleanupOrphanedSessions: vi.fn() }))
vi.mock('../accounts.js',        () => ({ getApiKey: vi.fn(() => 'sk-ant-key'), setActiveAccount: vi.fn(), listAccounts: vi.fn(() => []) }))
vi.mock('../checkpoint.js',      () => ({ loadSyncConfig: vi.fn(() => ({ autoSwitch: true, smartResume: false, gitCheckpoint: false })), backupSessionFile: vi.fn() }))
vi.mock('../session-transfer.js',() => ({ findLatestSession: vi.fn(() => null), transferSession: vi.fn() }))
vi.mock('../github-sync.js',     () => ({ pushProject: vi.fn() }))
vi.mock('../isolation.js',       () => ({ getIsolationEnv: vi.fn(() => ({})), prepareIsolation: vi.fn(() => () => {}), getIsolationMethod: vi.fn(() => 'env') }))
vi.mock('../plugins.js',         () => ({ loadPlugins: vi.fn(async () => []), firePluginEvent: vi.fn(async () => {}) }))
vi.mock('../hooks.js',           () => ({ ensureHooksRegistered: vi.fn() }))
vi.mock('../context-injector.js',() => ({ buildContextMessage: vi.fn(() => null) }))
vi.mock('../resume-verify.js',   () => ({ detectResumeOutcome: vi.fn(() => 'unknown'), extractSessionSummary: vi.fn(() => null) }))

import { runClaude } from '../runner.js'
import { spawn }     from 'child_process'
import { EventEmitter } from 'events'

vi.mock('child_process', () => ({ spawn: vi.fn() }))

function mockChild(exitCode, stderrLines = []) {
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdin  = { write: vi.fn(), end: vi.fn() }

  setTimeout(() => {
    for (const line of stderrLines) child.stderr.emit('data', Buffer.from(line))
    child.stdout.emit('data', Buffer.from(''))
    child.emit('close', exitCode)
  }, 10)
  return child
}

describe('runClaude', () => {
  const account = { name: 'work', type: 'api_key', provider: 'anthropic' }

  beforeEach(() => {
    vi.clearAllMocks()
    spawn.mockImplementation(() => mockChild(0))
  })

  it('resolves with code 0 on clean exit', async () => {
    const result = await runClaude(account, [], {})
    expect(result.code).toBe(0)
  })

  it('strips CCM_SECRET from subprocess env', async () => {
    process.env.CCM_SECRET = 'mysecret'
    await runClaude(account, [], {})
    const spawnEnv = spawn.mock.calls[0][2].env
    expect(spawnEnv.CCM_SECRET).toBeUndefined()
    delete process.env.CCM_SECRET
  })

  it('strips CCM_DEBUG from subprocess env', async () => {
    process.env.CCM_DEBUG = '1'
    await runClaude(account, [], {})
    const spawnEnv = spawn.mock.calls[0][2].env
    expect(spawnEnv.CCM_DEBUG).toBeUndefined()
    delete process.env.CCM_DEBUG
  })

  it('sets ANTHROPIC_API_KEY for api_key accounts', async () => {
    await runClaude(account, [], {})
    const spawnEnv = spawn.mock.calls[0][2].env
    expect(spawnEnv.ANTHROPIC_API_KEY).toBe('sk-ant-key')
  })

  it('detects credit limit error and attempts switch', async () => {
    const { listAccounts } = await import('../accounts.js')
    listAccounts.mockReturnValueOnce([
      { name: 'work',    type: 'api_key', provider: 'anthropic', disabled: false, priority: 0 },
      { name: 'backup', type: 'api_key', provider: 'anthropic', disabled: false, priority: 1 },
    ])

    let callCount = 0
    spawn.mockImplementation(() => {
      callCount++
      const line = callCount === 1 ? 'Error: credit balance is too low' : ''
      return mockChild(callCount === 1 ? 1 : 0, [line])
    })

    const onSwitch = vi.fn()
    const result   = await runClaude(account, [], { autoSwitch: true, onSwitch })

    expect(onSwitch).toHaveBeenCalledWith('work', 'backup')
    expect(result.code).toBe(0)
  })

  it('exits cleanly when all accounts are exhausted', async () => {
    const { listAccounts } = await import('../accounts.js')
    listAccounts.mockReturnValue([
      { name: 'work', type: 'api_key', provider: 'anthropic', disabled: false, priority: 0 },
    ])
    spawn.mockImplementation(() => mockChild(1, ['credit balance is too low']))

    const result = await runClaude(account, [], { autoSwitch: true })
    expect(result.exhausted).toBe(true)
    expect(result.code).not.toBe(0)
  })
})
