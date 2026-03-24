import { describe, it, expect, vi } from 'vitest'
import { buildContext, buildContextMessage } from '../context-injector.js'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeFileSync, mkdirSync } from 'fs'

describe('buildContext', () => {
  it('returns null for empty sources', () => {
    expect(buildContext('/any', [])).toBeNull()
    expect(buildContext('/any', null)).toBeNull()
  })

  it('skips missing files gracefully', () => {
    const result = buildContext('/nonexistent', ['README.md'])
    expect(result).toBeNull()
  })

  it('reads a real file', () => {
    const dir  = join(tmpdir(), `ccm-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'README.md'), '# My Project\nThis is a test project.')

    const result = buildContext(dir, ['README.md'])
    expect(result).toContain('My Project')
    expect(result).toContain('--- README.md ---')
  })

  it('handles git: source gracefully when not a git repo', () => {
    // Should not throw — just return null
    const result = buildContext('/nonexistent', [{ source: 'git:log', lines: 5 }])
    expect(result).toBeNull()
  })

  it('truncates from the front when over token limit', () => {
    const dir = join(tmpdir(), `ccm-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    // Write a large file that exceeds the limit
    writeFileSync(join(dir, 'big.txt'), 'x'.repeat(50000))
    const result = buildContext(dir, ['big.txt'], { maxTokens: 100 })
    // Should be truncated
    expect(result.length).toBeLessThan(50000)
    expect(result).toContain('truncated')
  })

  it('multiple sources are joined', () => {
    const dir = join(tmpdir(), `ccm-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'a.md'), 'File A content')
    writeFileSync(join(dir, 'b.md'), 'File B content')

    const result = buildContext(dir, ['a.md', 'b.md'])
    expect(result).toContain('File A content')
    expect(result).toContain('File B content')
  })
})

describe('buildContextMessage', () => {
  it('returns null when no context', () => {
    expect(buildContextMessage('/nonexistent', [])).toBeNull()
  })

  it('wraps context in CCM header/footer', () => {
    const dir = join(tmpdir(), `ccm-test-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'README.md'), 'My project docs')

    const msg = buildContextMessage(dir, ['README.md'])
    expect(msg).toContain('[CCM Auto-context')
    expect(msg).toContain('[End of auto-context]')
    expect(msg).toContain('My project docs')
  })
})
