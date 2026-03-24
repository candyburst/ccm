import { existsSync, readdirSync, statSync, mkdirSync, copyFileSync, readFileSync } from 'fs'
import { join, basename } from 'path'
import { CLAUDE_HOME, SESSIONS_DIR, AUTH, claudeProjects } from './config.js'

// Claude Code encodes the working directory path into the folder name by
// replacing every non-alphanumeric character with a hyphen.
export function encodeCwd(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

// Return the projects directory for a given account
function projectsDirForAccount(account) {
  if (account.type === AUTH.EMAIL) {
    return claudeProjects(account.sessionDir)
  }
  return claudeProjects(null) // API key accounts use ~/.claude/projects
}

// Find the most recently modified .jsonl session file for the current cwd
export function findLatestSession(account, cwd = process.cwd()) {
  const projectsDir = projectsDirForAccount(account)
  const encoded = encodeCwd(cwd)
  const sessionDir = join(projectsDir, encoded)

  if (!existsSync(sessionDir)) return null

  let latest = null
  let latestMtime = 0

  try {
    for (const f of readdirSync(sessionDir)) {
      if (!f.endsWith('.jsonl')) continue
      const full = join(sessionDir, f)
      const mtime = statSync(full).mtimeMs
      if (mtime > latestMtime) {
        latestMtime = mtime
        latest = full
      }
    }
  } catch {
    return null
  }

  if (!latest) return null

  const sessionId = basename(latest, '.jsonl')
  return { sessionId, filePath: latest, sessionDir }
}

// Copy a session JSONL from one account to another so --resume works cross-account
export function transferSession(fromAccount, toAccount, sessionId, cwd = process.cwd()) {
  const encoded = encodeCwd(cwd)
  const fromDir = join(projectsDirForAccount(fromAccount), encoded)
  const toDir = join(projectsDirForAccount(toAccount), encoded)
  const fromFile = join(fromDir, `${sessionId}.jsonl`)

  if (!existsSync(fromFile)) {
    return { success: false, reason: 'source_not_found', fromFile }
  }

  mkdirSync(toDir, { recursive: true })
  const toFile = join(toDir, `${sessionId}.jsonl`)
  copyFileSync(fromFile, toFile)

  return { success: true, sessionId, fromFile, toFile }
}

// Count messages in a JSONL to give a useful summary
export function sessionSummary(filePath) {
  if (!existsSync(filePath)) return null
  try {
    const lines = readFileSync(filePath, 'utf8').split('\n').filter(Boolean)
    const msgs = lines
      .map(l => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    const human = msgs.filter(m => m.type === 'human' || m.role === 'human').length
    const asst = msgs.filter(m => m.type === 'assistant' || m.role === 'assistant').length
    return { total: msgs.length, human, assistant: asst }
  } catch {
    return null
  }
}

// List all sessions for an account (for display in UI)
export function listSessionFiles(account, cwd = null) {
  const projectsDir = projectsDirForAccount(account)
  const results = []
  if (!existsSync(projectsDir)) return results

  try {
    for (const encoded of readdirSync(projectsDir)) {
      const sessionDir = join(projectsDir, encoded)
      if (!statSync(sessionDir).isDirectory()) continue
      if (cwd && encodeCwd(cwd) !== encoded) continue

      for (const f of readdirSync(sessionDir)) {
        if (!f.endsWith('.jsonl')) continue
        const full = join(sessionDir, f)
        const stat = statSync(full)
        results.push({
          sessionId: basename(f, '.jsonl'),
          filePath: full,
          encodedCwd: encoded,
          modifiedAt: new Date(stat.mtimeMs).toISOString(),
          sizeBytes: stat.size,
        })
      }
    }
  } catch {
    /* skip */
  }

  return results.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
}
