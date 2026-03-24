import { spawnSync } from 'child_process'
import { copyDirSync } from './fs-utils.js'
import { existsSync, mkdirSync, writeFileSync, renameSync, readFileSync, copyFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { CHECKPOINTS_DIR, CONFIG_FILE, CCM_DIR, DEFAULT_SYNC_CONFIG } from './config.js'

// ── Config helpers ─────────────────────────────────────────────────────────────

export function loadSyncConfig() {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
    return { ...DEFAULT_SYNC_CONFIG, ...raw, github: { ...DEFAULT_SYNC_CONFIG.github, ...(raw.github || {}) } }
  } catch {
    return { ...DEFAULT_SYNC_CONFIG }
  }
}

export function saveSyncConfig(cfg) {
  mkdirSync(CCM_DIR, { recursive: true })
  const tmp1 = CONFIG_FILE + '.tmp'
  writeFileSync(tmp1, JSON.stringify(cfg, null, 2))
  renameSync(tmp1, CONFIG_FILE)
}

// ── Git helpers ────────────────────────────────────────────────────────────────

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 30000 })
  return { ok: r.status === 0, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() }
}

export function isGitRepo(dir) {
  return git(['rev-parse', '--git-dir'], dir).ok
}

export function getGitBranch(dir) {
  const r = git(['rev-parse', '--abbrev-ref', 'HEAD'], dir)
  return r.ok ? r.stdout : null
}

export function hasRemote(dir) {
  const r = git(['remote'], dir)
  return r.ok && r.stdout.trim().length > 0
}

// ── Core checkpoint operation ──────────────────────────────────────────────────

export async function gitCheckpoint(projectRoot, { message = 'auto checkpoint', push = false, remote = 'origin' } = {}) {
  if (!projectRoot || !isGitRepo(projectRoot)) {
    return { success: false, skipped: true, reason: 'not_a_git_repo' }
  }

  const add = git(['add', '-A'], projectRoot)
  if (!add.ok) return { success: false, reason: 'git_add_failed', detail: add.stderr }

  const status  = git(['status', '--porcelain'], projectRoot)
  const isDirty = status.stdout.length > 0

  const commitMsg = `[ccm] ${message} · ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`
  const commit    = git(['commit', '--allow-empty', '-m', commitMsg], projectRoot)
  if (!commit.ok) {
    return { success: false, reason: 'git_commit_failed', detail: commit.stderr }
  }

  const hashResult = git(['rev-parse', '--short', 'HEAD'], projectRoot)
  const commitHash = hashResult.ok ? hashResult.stdout : null

  let pushed = false
  if (push && hasRemote(projectRoot)) {
    const branch  = getGitBranch(projectRoot)
    const pushRes = git(['push', remote, branch], projectRoot)
    pushed = pushRes.ok
  }

  return { success: true, commitHash, pushed, hadChanges: isDirty }
}

// ── Local JSONL backup to ~/.ccm/checkpoints/ ──────────────────────────────────

export function backupSessionFile(sessionFilePath, { account, sessionId, projectRoot }) {
  if (!existsSync(sessionFilePath)) return { success: false, reason: 'file_not_found' }

  const label = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir   = join(CHECKPOINTS_DIR, account)
  mkdirSync(dir, { recursive: true })

  const dest = join(dir, `${label}-${sessionId}.jsonl`)
  copyFileSync(sessionFilePath, dest)

  const meta = { account, sessionId, projectRoot, savedAt: new Date().toISOString(), source: sessionFilePath }
  const metaDest = dest.replace('.jsonl', '.meta.json')
  const tmp2 = metaDest + '.tmp'
  writeFileSync(tmp2, JSON.stringify(meta, null, 2))
  renameSync(tmp2, metaDest)

  return { success: true, dest }
}

// ── List local checkpoints ─────────────────────────────────────────────────────

export function listCheckpoints(account = null) {
  if (!existsSync(CHECKPOINTS_DIR)) return []
  const results = []
  try {
    const dirs = account ? [account] : readdirSync(CHECKPOINTS_DIR)
    for (const dir of dirs) {
      const full = join(CHECKPOINTS_DIR, dir)
      if (!existsSync(full)) continue
      for (const f of readdirSync(full)) {
        if (!f.endsWith('.meta.json')) continue
        try {
          const meta = JSON.parse(readFileSync(join(full, f), 'utf8'))
          results.push({ ...meta, checkpointFile: join(full, f.replace('.meta.json', '.jsonl')) })
        } catch { /* skip corrupt entries */ }
      }
    }
  } catch { /* skip */ }
  return results.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

// ── GitHub session backup repo ─────────────────────────────────────────────────

export async function pushSessionBackup(projectRoot) {
  const cfg = loadSyncConfig()
  if (!cfg.github?.enabled || !cfg.github?.sessionBackup || !cfg.github?.backupRepo) {
    return { success: false, skipped: true, reason: 'not_configured' }
  }

  const backupDir = join(CHECKPOINTS_DIR, '_backup_repo')
  mkdirSync(backupDir, { recursive: true })

  if (!isGitRepo(backupDir)) {
    git(['init'], backupDir)
    git(['remote', 'add', 'origin', cfg.github.backupRepo], backupDir)
  }

  // Cross-platform directory copy — works on macOS, Linux, and Windows
  if (existsSync(CHECKPOINTS_DIR)) {
    try {
      copyDirSync(CHECKPOINTS_DIR, backupDir)
    } catch { /* backup is best-effort — don't fail the session */ }
  }

  return gitCheckpoint(backupDir, { message: 'session backup', push: true })
}
