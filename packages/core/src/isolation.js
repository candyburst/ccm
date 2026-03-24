// Email account isolation — verify CLAUDE_CONFIG_DIR is honoured by the
// installed Claude Code version. Falls back to symlinking ~/.claude if not.
//
// Windows note: the symlink fallback requires Administrator or Developer Mode.
// On Windows we always use the env var method and warn if it's not working.

import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, symlinkSync, unlinkSync, readdirSync, renameSync, rmSync } from 'fs'
import { join } from 'path'
import { CLAUDE_HOME, CCM_DIR } from './config.js'
import { debug } from './debug.js'

const IS_WINDOWS = process.platform === 'win32'

const ISOLATION_METHODS = {
  ENV:     'CLAUDE_CONFIG_DIR',
  SYMLINK: 'symlink',
}

let _detectedMethod = null

// ── Detection ─────────────────────────────────────────────────────────────────

function detectIsolationMethod(testSessionDir) {
  // Windows: symlinking directories requires elevated privileges — never use it
  if (IS_WINDOWS) {
    debug('isolation detection: Windows — using env var method only')
    return ISOLATION_METHODS.ENV
  }

  mkdirSync(testSessionDir, { recursive: true })

  const result = spawnSync('claude', ['--version'], {
    env:     { ...process.env, CLAUDE_CONFIG_DIR: testSessionDir },
    timeout: 8000,
    encoding: 'utf8',
  })

  // Claude not runnable — can't detect, assume env works
  if (result.error || result.status === null) {
    debug('isolation detection: claude not runnable — assuming env method')
    return ISOLATION_METHODS.ENV
  }

  // Check whether Claude wrote anything into the test dir
  try {
    const files = readdirSync(testSessionDir)
    if (files.length > 0) {
      debug(`isolation detection: CLAUDE_CONFIG_DIR honoured (${files.length} files written)`)
      return ISOLATION_METHODS.ENV
    }
  } catch { /* unreadable — treat as not honoured */ }

  debug('isolation detection: CLAUDE_CONFIG_DIR not honoured — using symlink fallback')
  return ISOLATION_METHODS.SYMLINK
}

function cleanupTestDir(dir) {
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* best-effort */ }
}

export function getIsolationMethod() {
  if (_detectedMethod) return _detectedMethod
  const testDir = join(CCM_DIR, '.isolation-test')
  _detectedMethod = detectIsolationMethod(testDir)
  cleanupTestDir(testDir)  // remove temp dir after detection
  return _detectedMethod
}

export function isEnvIsolation() {
  return getIsolationMethod() === ISOLATION_METHODS.ENV
}

// ── Symlink management (macOS / Linux only) ────────────────────────────────────

export function activateSymlink(sessionDir) {
  if (IS_WINDOWS) return  // guard — should never be called on Windows

  if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true })

  if (existsSync(CLAUDE_HOME)) {
    const backup = `${CLAUDE_HOME}-ccm-backup`
    if (!existsSync(backup)) {
      renameSync(CLAUDE_HOME, backup)
      debug(`symlink: backed up ${CLAUDE_HOME} → ${backup}`)
    } else {
      try { unlinkSync(CLAUDE_HOME) } catch { /* may already be gone */ }
    }
  }

  try { unlinkSync(CLAUDE_HOME) } catch { /* not there — fine */ }
  symlinkSync(sessionDir, CLAUDE_HOME, 'dir')
  debug(`symlink: ${CLAUDE_HOME} → ${sessionDir}`)
}

export function deactivateSymlink() {
  if (IS_WINDOWS) return

  const backup = `${CLAUDE_HOME}-ccm-backup`
  try { unlinkSync(CLAUDE_HOME) } catch { /* may already be gone */ }
  if (existsSync(backup)) {
    renameSync(backup, CLAUDE_HOME)
    debug('symlink: restored original ~/.claude')
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getIsolationEnv(account) {
  if (isEnvIsolation()) {
    return { CLAUDE_CONFIG_DIR: account.sessionDir }
  }
  return {}
}

export function prepareIsolation(account) {
  if (isEnvIsolation()) {
    return () => {}
  }
  activateSymlink(account.sessionDir)
  return () => deactivateSymlink()
}
