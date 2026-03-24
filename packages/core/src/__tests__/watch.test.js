import { describe, it, expect, vi } from 'vitest'
import { watchClaude } from '../watch.js'

// Mock runClaude
vi.mock('../runner.js', () => ({
  runClaude: vi.fn(),
}))
import { runClaude } from '../runner.js'

describe('watchClaude', () => {
  it('exits immediately on code 0', async () => {
    runClaude.mockResolvedValueOnce({ code: 0, account: { name: 'work' } })
    const result = await watchClaude({ name: 'work' }, [], {})
    expect(result.code).toBe(0)
    expect(runClaude).toHaveBeenCalledTimes(1)
  })

  it('exits immediately when all accounts exhausted', async () => {
    runClaude.mockResolvedValueOnce({ code: 1, exhausted: true, account: { name: 'work' } })
    const result = await watchClaude({ name: 'work' }, [], {})
    expect(result.exhausted).toBe(true)
    expect(runClaude).toHaveBeenCalledTimes(1)
  })

  it('retries on non-zero non-credit exit', async () => {
    runClaude
      .mockResolvedValueOnce({ code: 1, account: { name: 'work' } })
      .mockResolvedValueOnce({ code: 1, account: { name: 'work' } })
      .mockResolvedValueOnce({ code: 0, account: { name: 'work' } })

    const result = await watchClaude({ name: 'work' }, [], { maxFailures: 5 })
    expect(result.code).toBe(0)
    expect(runClaude).toHaveBeenCalledTimes(3)
  }, 10000)

  it('stops after maxFailures consecutive failures', async () => {
    runClaude.mockResolvedValue({ code: 1, account: { name: 'work' } })
    const result = await watchClaude({ name: 'work' }, [], { maxFailures: 3 })
    expect(runClaude).toHaveBeenCalledTimes(3)
    expect(result.code).toBe(1)
  }, 10000)

  it('calls onRestart before each restart', async () => {
    runClaude
      .mockResolvedValueOnce({ code: 1, account: { name: 'work' } })
      .mockResolvedValueOnce({ code: 0, account: { name: 'work' } })

    const onRestart = vi.fn()
    await watchClaude({ name: 'work' }, [], { maxFailures: 5, onRestart })
    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(onRestart).toHaveBeenCalledWith(1, expect.any(Number))
  }, 10000)

  it('never infinite loops when runClaude always fails', async () => {
    runClaude.mockResolvedValue({ code: 1, account: { name: 'work' } })
    const result = await watchClaude({ name: 'work' }, [], { maxFailures: 2 })
    expect(runClaude.mock.calls.length).toBeLessThanOrEqual(2)
  }, 10000)
})
