import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, appendFileSync } from 'fs'
import { join, resolve, basename, sep } from 'path'
import { homedir } from 'os'
import { loadSyncConfig } from './checkpoint.js'

export const PROJECT_FILE = '.ccm-project.json'

export function findProjectFile(startDir = process.cwd()) {
  let dir = resolve(startDir)
  for (let i = 0; i < 10; i++) {
    const f = join(dir, PROJECT_FILE)
    if (existsSync(f)) return f
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return null
}

export function loadProject(startDir = process.cwd()) {
  const file = findProjectFile(startDir)
  if (!file) return null
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    return { ...data, projectFile: file, projectRoot: resolve(file, '..') }
  } catch { return null }
}

export function initProject(dir, accountName, name = '') {
  const file = join(dir, PROJECT_FILE)
  if (existsSync(file)) throw new Error(`Project already initialised. Edit ${PROJECT_FILE} to change settings.`)
  const config = {
    name: name || basename(dir), // cross-platform: basename handles both / and \
    account: accountName,
    createdAt: new Date().toISOString(),
    notes: '',
  }
  writeFileSync(file, JSON.stringify(config, null, 2))
  return config
}

export function bindProject(dir, accountName) {
  const file = join(dir, PROJECT_FILE)
  if (!existsSync(file)) throw new Error('No project found here — run: ccm project init')
  const config = JSON.parse(readFileSync(file, 'utf8'))
  config.account = accountName
  writeFileSync(file, JSON.stringify(config, null, 2))
}

export function scanProjectsUnder(rootDir) {
  const results = []
  function walk(dir, depth) {
    if (depth > 4) return
    try {
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.') && entry !== PROJECT_FILE) continue
        const full = join(dir, entry)
        try {
          const st = statSync(full)
          if (entry === PROJECT_FILE) {
            const data = JSON.parse(readFileSync(full, 'utf8'))
            results.push({ ...data, projectRoot: dir, projectFile: full })
          } else if (st.isDirectory() && !['node_modules', '.git'].includes(entry)) {
            walk(full, depth + 1)
          }
        } catch { /* skip inaccessible entries */ }
      }
    } catch { /* skip inaccessible directories */ }
  }
  walk(rootDir, 0)
  return results
}

// Scan all configured roots (or homedir if none configured)
export function scanAllProjects() {
  const cfg   = loadSyncConfig()
  const roots = cfg.projectScanRoots?.length ? cfg.projectScanRoots : [homedir()]
  const seen  = new Set()
  const all   = []
  for (const root of roots) {
    for (const p of scanProjectsUnder(root)) {
      if (!seen.has(p.projectFile)) {
        seen.add(p.projectFile)
        all.push(p)
      }
    }
  }
  return all
}

// Check whether .ccm-project.json is in the project's .gitignore, offer to add it
// Returns: 'added' | 'already_listed' | 'no_gitignore' | 'skipped'
export function ensureGitignore(projectDir, { autoAdd = false } = {}) {
  const gitignorePath = join(projectDir, '.gitignore')

  if (!existsSync(gitignorePath)) return 'no_gitignore'

  const content = readFileSync(gitignorePath, 'utf8')
  if (content.split('\n').some(l => l.trim() === PROJECT_FILE || l.trim() === `/${PROJECT_FILE}`)) {
    return 'already_listed'
  }

  if (autoAdd) {
    const entry = content.endsWith('\n') ? PROJECT_FILE + '\n' : '\n' + PROJECT_FILE + '\n'
    appendFileSync(gitignorePath, entry)
    return 'added'
  }

  return 'skipped'
}
