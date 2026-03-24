import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { initProject, bindProject, loadProject, ensureGitignore } from '../projects.js'

// Mock CCM config paths to use temp dirs
vi.mock('../config.js', async orig => {
  const actual = await orig()
  return { ...actual }
})
vi.mock('../checkpoint.js', () => ({
  loadSyncConfig: vi.fn(() => ({ projectScanRoots: null })),
}))

function makeTempDir() {
  const dir = join(
    tmpdir(),
    `ccm-projects-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('initProject', () => {
  it('creates .ccm-project.json in the directory', () => {
    const dir = makeTempDir()
    initProject(dir, 'work', 'my-app')
    expect(existsSync(join(dir, '.ccm-project.json'))).toBe(true)
  })

  it('stores account and name', () => {
    const dir = makeTempDir()
    initProject(dir, 'personal', 'test-project')
    const data = JSON.parse(readFileSync(join(dir, '.ccm-project.json'), 'utf8'))
    expect(data.account).toBe('personal')
    expect(data.name).toBe('test-project')
  })

  it('uses directory name when name not provided', () => {
    const dir = makeTempDir()
    initProject(dir, 'work')
    const data = JSON.parse(readFileSync(join(dir, '.ccm-project.json'), 'utf8'))
    expect(data.name).toBeTruthy()
    expect(typeof data.name).toBe('string')
  })
})

describe('bindProject', () => {
  it('updates the account field', () => {
    const dir = makeTempDir()
    initProject(dir, 'work', 'proj')
    bindProject(dir, 'personal')
    const data = JSON.parse(readFileSync(join(dir, '.ccm-project.json'), 'utf8'))
    expect(data.account).toBe('personal')
  })
})

describe('loadProject', () => {
  it('returns null when no project file found', () => {
    const dir = makeTempDir()
    // No project file — walk-up will terminate at root
    const result = loadProject(join(dir, 'subdir', 'deep'))
    expect(result).toBeNull()
  })

  it('walks up to find project file', () => {
    const dir = makeTempDir()
    const subdir = join(dir, 'src', 'components')
    mkdirSync(subdir, { recursive: true })
    initProject(dir, 'work', 'my-app')
    const result = loadProject(subdir)
    expect(result).not.toBeNull()
    expect(result.account).toBe('work')
  })

  it('returns project with projectRoot path', () => {
    const dir = makeTempDir()
    initProject(dir, 'work', 'my-app')
    const result = loadProject(dir)
    expect(result.projectRoot).toBe(dir)
  })
})

describe('ensureGitignore', () => {
  it('returns no_gitignore when .gitignore missing', () => {
    const dir = makeTempDir()
    expect(ensureGitignore(dir)).toBe('no_gitignore')
  })

  it('returns already_listed when entry exists', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, '.gitignore'), '.ccm-project.json\nnode_modules\n')
    expect(ensureGitignore(dir)).toBe('already_listed')
  })

  it('returns skipped when autoAdd is false', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, '.gitignore'), 'node_modules\n')
    expect(ensureGitignore(dir, { autoAdd: false })).toBe('skipped')
  })

  it('adds entry and returns added when autoAdd is true', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, '.gitignore'), 'node_modules\n')
    const result = ensureGitignore(dir, { autoAdd: true })
    expect(result).toBe('added')
    const content = readFileSync(join(dir, '.gitignore'), 'utf8')
    expect(content).toContain('.ccm-project.json')
  })
})
