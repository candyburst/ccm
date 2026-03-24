// Team mode — shared account pool via a private git repo.
// Multiple developers share Anthropic accounts without simultaneous use.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { hostname } from 'os'
import { spawnSync } from 'child_process'
import { CCM_DIR } from './config.js'
import { debug } from './debug.js'

const TEAM_FILE = join(CCM_DIR, 'team.json')

function loadTeamConfig() {
  try { return JSON.parse(readFileSync(TEAM_FILE, 'utf8')) }
  catch { return null }
}

function saveTeamConfig(cfg) {
  mkdirSync(CCM_DIR, { recursive: true })
  writeFileSync(TEAM_FILE, JSON.stringify(cfg, null, 2))
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 15000 })
  return { ok: r.status === 0, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() }
}

function getTeamRepoDir() {
  return join(CCM_DIR, 'team-repo')
}

export function initTeam(repoUrl) {
  const repoDir = getTeamRepoDir()
  if (existsSync(repoDir)) {
    // Update remote URL
    git(['remote', 'set-url', 'origin', repoUrl], repoDir)
  } else {
    mkdirSync(repoDir, { recursive: true })
    git(['clone', repoUrl, '.'], repoDir)
  }
  saveTeamConfig({ repoUrl, repoDir, user: process.env.USER || process.env.USERNAME || 'unknown' })
  debug(`team: initialised with repo ${repoUrl}`)
}

export function syncTeam() {
  const cfg = loadTeamConfig()
  if (!cfg) throw new Error('Team not initialised — run: ccm team init <repo-url>')
  git(['pull', '--rebase'], cfg.repoDir)
}

export function getTeamStatus() {
  const cfg = loadTeamConfig()
  if (!cfg) return null

  syncTeam()

  const locksDir = join(cfg.repoDir, 'locks')
  if (!existsSync(locksDir)) return { locks: [], repoUrl: cfg.repoUrl }

  // readdirSync imported at top level
  const locks = readdirSync(locksDir)
    .filter(f => f.endsWith('.lock.json'))
    .map(f => {
      try {
        const data = JSON.parse(readFileSync(join(locksDir, f), 'utf8'))
        return { account: f.replace('.lock.json', ''), ...data }
      } catch { return null }
    })
    .filter(Boolean)

  return { locks, repoUrl: cfg.repoUrl }
}

export function lockTeamAccount(accountName, sessionId) {
  const cfg = loadTeamConfig()
  if (!cfg) return false

  const locksDir = join(cfg.repoDir, 'locks')
  mkdirSync(locksDir, { recursive: true })

  const lockFile = join(locksDir, `${accountName}.lock.json`)
  if (existsSync(lockFile)) return false  // already locked

  writeFileSync(lockFile, JSON.stringify({
    user:      cfg.user,
    hostname:  hostname(),
    sessionId,
    lockedAt:  new Date().toISOString(),
  }))

  git(['add', join('locks', `${accountName}.lock.json`)], cfg.repoDir)
  git(['commit', '-m', `lock: ${cfg.user} acquired ${accountName}`], cfg.repoDir)
  git(['push'], cfg.repoDir)
  return true
}

export function unlockTeamAccount(accountName) {
  const cfg = loadTeamConfig()
  if (!cfg) return

  const lockFile = join(cfg.repoDir, 'locks', `${accountName}.lock.json`)
  if (!existsSync(lockFile)) return

  unlinkSync(lockFile)
  git(['add', join('locks', `${accountName}.lock.json`)], cfg.repoDir)
  git(['commit', '--allow-empty', '-m', `unlock: ${cfg.user} released ${accountName}`], cfg.repoDir)
  git(['push'], cfg.repoDir)
}
