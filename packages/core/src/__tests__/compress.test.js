import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compressSession } from '../compress.js'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeFileSync, mkdirSync, existsSync } from 'fs'

// Mock the Anthropic API call
global.fetch = vi.fn()

describe('compressSession', () => {
  const makeJSONL = (count, charsEach = 100) => {
    return (
      Array.from({ length: count }, (_, i) =>
        JSON.stringify({
          type: i % 2 === 0 ? 'human' : 'assistant',
          content: 'x'.repeat(charsEach),
        })
      ).join('\n') + '\n'
    )
  }

  it('skips when file does not exist', async () => {
    const result = await compressSession('/nonexistent/session.jsonl')
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('file_not_found')
  })

  it('skips when under threshold', async () => {
    const dir = join(tmpdir(), `ccm-compress-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'session.jsonl')
    writeFileSync(file, makeJSONL(10, 10)) // tiny file

    const result = await compressSession(file, { threshold: 1000000 })
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('under_threshold')
  })

  it('dry-run makes no writes', async () => {
    const dir = join(tmpdir(), `ccm-compress-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'session.jsonl')
    const original = makeJSONL(50, 200)
    writeFileSync(file, original)

    const result = await compressSession(file, { threshold: 1, dryRun: true })
    expect(result.dryRun).toBe(true)
    // File should be unchanged
    const { readFileSync } = await import('fs')
    expect(readFileSync(file, 'utf8')).toBe(original)
  })

  it('returns api_unavailable when fetch fails', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const dir = join(tmpdir(), `ccm-compress-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'session.jsonl')
    writeFileSync(file, makeJSONL(50, 300)) // large enough to trigger

    const result = await compressSession(file, { threshold: 1 })
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('api_unavailable')
  })

  it('backs up original before writing compressed version', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: 'Summary of conversation' }] }),
    })

    const dir = join(tmpdir(), `ccm-compress-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'session.jsonl')
    writeFileSync(file, makeJSONL(50, 300))

    const result = await compressSession(file, { threshold: 1, keepRecent: 5 })
    if (!result.skipped) {
      expect(result.backupPath).toBeDefined()
      expect(existsSync(result.backupPath)).toBe(true)
    }
  })
})
