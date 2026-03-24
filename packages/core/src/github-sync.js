import { spawnSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { CONFIG_FILE, CCM_DIR } from './config.js'
import { isGitRepo, hasRemote, getGitBranch, gitCheckpoint, loadSyncConfig, saveSyncConfig } from './checkpoint.js'

// ── Status ────────────────────────────────────────────────────────────────────

export function getGitStatus(projectRoot) {
  if (!projectRoot || !isGitRepo(projectRoot)) {
    return { isGitRepo: false }
  }

  function git(args) {
    const r = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8', timeout: 10000 })
    return { ok: r.status === 0, out: (r.stdout || '').trim() }
  }

  const branch      = getGitBranch(projectRoot)
  const remote      = hasRemote(projectRoot)
  const statusLines = git(['status', '--porcelain']).out.split('\n').filter(Boolean)
  const ahead       = git(['rev-list', '--count', 'HEAD@{upstream}..HEAD']).out
  const lastCommit  = git(['log', '-1', '--format=%h %s %cr']).out

  return {
    isGitRepo: true,
    branch,
    hasRemote:   remote,
    isDirty:     statusLines.length > 0,
    changedFiles: statusLines.length,
    aheadCount:  parseInt(ahead) || 0,
    lastCommit,
  }
}

// ── Push project repo ─────────────────────────────────────────────────────────

export async function pushProject(projectRoot, { message = 'checkpoint' } = {}) {
  const cfg = loadSyncConfig()
  if (!cfg.github?.enabled || !cfg.github?.projectSync) {
    return { success: false, skipped: true, reason: 'disabled' }
  }
  if (!isGitRepo(projectRoot)) {
    return { success: false, skipped: true, reason: 'not_a_git_repo' }
  }
  if (!hasRemote(projectRoot)) {
    return { success: false, skipped: true, reason: 'no_remote' }
  }

  // Per-project remote override: read from .ccm-project.json if present
  let remote = 'origin'
  try {
    const { existsSync, readFileSync } = await import('fs')
    const { join } = await import('path')
    const projFile = join(projectRoot, '.ccm-project.json')
    if (existsSync(projFile)) {
      const proj = JSON.parse(readFileSync(projFile, 'utf8'))
      if (proj.remote) remote = proj.remote
    }
  } catch { /* use origin */ }

  return gitCheckpoint(projectRoot, { message, push: true, remote })
}

// ── Validate a git remote URL ─────────────────────────────────────────────────

export function validateRemoteUrl(url) {
  if (!url || !url.trim()) return { valid: false, reason: 'empty' }
  const trimmed = url.trim()
  // SSH format: git@host:org/repo.git
  const isSSH = trimmed.startsWith('git@') && trimmed.includes(':')
  // HTTPS format: https://any-host/path — accepts GitHub, GitLab, Bitbucket, self-hosted
  const isHTTPS = /^https?:\/\/.+\/.+/.test(trimmed)
  if (!isSSH && !isHTTPS) {
    return { valid: false, reason: 'unrecognised_format',
      hint: 'Use SSH (git@host:org/repo.git) or HTTPS (https://host/org/repo)' }
  }
  return { valid: true, isSSH, isHTTPS }
}

// ── Test remote connectivity ──────────────────────────────────────────────────

export function testRemote(url) {
  const r = spawnSync('git', ['ls-remote', '--exit-code', url, 'HEAD'], {
    encoding: 'utf8', timeout: 15000,
  })
  return { reachable: r.status === 0, detail: (r.stderr || '').trim() }
}

// ── Full sync config management (re-exported from checkpoint for UI) ───────────

export { loadSyncConfig, saveSyncConfig }
