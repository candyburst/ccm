// Resume verification — detect whether --resume actually loaded the session
// or whether Claude started fresh. Extracts a fallback context summary from
// the JSONL if needed.

import { existsSync, readFileSync } from 'fs'
import { debug } from './debug.js'

// Patterns in Claude's stdout that indicate a successful resume
const RESUME_PATTERNS = [
  /resuming session/i,
  /continuing from/i,
  /loaded previous/i,
  /session resumed/i,
]

// Patterns that indicate Claude started fresh (resume failed silently)
const FRESH_START_PATTERNS = [
  /how can i (help|assist)/i,
  /what (would you like|can i help)/i,
  /hello[,!]/i,
]

/**
 * Analyse accumulated stdout to determine if --resume succeeded.
 * @param {string} stdout - First N chars of Claude's stdout output
 * @returns {'resumed' | 'fresh' | 'unknown'}
 */
export function detectResumeOutcome(stdout) {
  if (!stdout || stdout.length < 10) return 'unknown'

  const sample = stdout.slice(0, 500).toLowerCase()

  if (RESUME_PATTERNS.some(p => p.test(sample))) return 'resumed'
  if (FRESH_START_PATTERNS.some(p => p.test(sample))) return 'fresh'
  return 'unknown'
}

/**
 * Extract a summary of the last N messages from a JSONL file.
 * Returns a formatted string suitable for injecting as a context prompt,
 * or null if the file cannot be read.
 *
 * @param {string} jsonlPath  - Path to the session JSONL file
 * @param {number} [keepLast] - Number of recent messages to include verbatim (default 10)
 * @returns {string|null}
 */
export function extractSessionSummary(jsonlPath, keepLast = 10) {
  if (!existsSync(jsonlPath)) return null

  try {
    const lines = readFileSync(jsonlPath, 'utf8')
      .split('\n')
      .filter(Boolean)

    const messages = lines
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)
      .filter(m => m.type === 'human' || m.type === 'assistant' ||
                   m.role === 'human' || m.role === 'assistant')

    if (messages.length === 0) return null

    const total   = messages.length
    const recent  = messages.slice(-keepLast)
    const omitted = total - recent.length

    const lines2 = recent.map(m => {
      const role    = (m.type || m.role) === 'human' ? 'User' : 'Assistant'
      const content = typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map(c => c.text || c.input || '').filter(Boolean).join(' ')
          : JSON.stringify(m.content)
      return `${role}: ${content.slice(0, 400)}${content.length > 400 ? '...' : ''}`
    })

    const header = omitted > 0
      ? `[Context: ${omitted} earlier messages omitted. Showing last ${recent.length} of ${total} total.]\n\n`
      : `[Context: ${total} messages from previous session.]\n\n`

    return header + lines2.join('\n\n')
  } catch (e) {
    debug(`resume-verify: failed to read JSONL: ${e.message}`)
    return null
  }
}
