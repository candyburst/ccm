// Auto context injection — prepends project-specific context before every session.
// Sources: file paths, git:log, git:status, git:diff
// Dependency-free: fs + child_process only.

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const DEFAULT_MAX_TOKENS = 8000
const CHARS_PER_TOKEN    = 4  // rough approximation

/**
 * Build the context string to prepend to a session.
 *
 * @param {string}    projectRoot  - Absolute path to the project directory
 * @param {Array}     sources      - From .ccm-project.json autoInject array
 * @param {object}    [opts]
 * @param {number}    [opts.maxTokens] - Max tokens to inject (default 8000)
 * @returns {string|null}  Context string or null if nothing to inject
 */
export function buildContext(projectRoot, sources, opts = {}) {
  if (!sources || sources.length === 0) return null

  const maxChars  = (opts.maxTokens || DEFAULT_MAX_TOKENS) * CHARS_PER_TOKEN
  const sections  = []

  for (const src of sources) {
    const section = readSource(projectRoot, src)
    if (section) sections.push(section)
  }

  if (sections.length === 0) return null

  // Join sections, then truncate from the front if over limit
  let combined = sections.join('\n\n')
  if (combined.length > maxChars) {
    combined = combined.slice(combined.length - maxChars)
    // Find the first newline so we don't start mid-line
    const nl = combined.indexOf('\n')
    if (nl > 0) combined = combined.slice(nl + 1)
    combined = '[Earlier context truncated to fit token limit]\n\n' + combined
  }

  return combined
}

/**
 * Read a single source entry and return its content as a formatted string.
 * Returns null if the source is unavailable (missing file, git error, etc.)
 */
function readSource(projectRoot, src) {
  // Normalise: string shorthand → object
  const spec = typeof src === 'string' ? { source: src } : src

  // File path
  if (!spec.source.startsWith('git:')) {
    const filePath = join(projectRoot, spec.source)
    if (!existsSync(filePath)) return null
    try {
      const content = readFileSync(filePath, 'utf8')
      return `--- ${spec.source} ---\n${content.trim()}`
    } catch { return null }
  }

  // Git sources
  const [, gitCmd] = spec.source.split(':')

  if (gitCmd === 'log') {
    const lines = spec.lines || 10
    const r = git(['log', `--oneline`, `-${lines}`], projectRoot)
    if (!r) return null
    return `--- git log (last ${lines} commits) ---\n${r}`
  }

  if (gitCmd === 'status') {
    const r = git(['status', '--short'], projectRoot)
    if (!r) return null
    return `--- git status ---\n${r}`
  }

  if (gitCmd === 'diff') {
    const r = git(['diff', '--stat', 'HEAD'], projectRoot)
    if (!r) return null
    return `--- git diff (staged changes) ---\n${r}`
  }

  return null
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 5000 })
  if (r.status !== 0 || !r.stdout) return null
  return r.stdout.trim()
}

/**
 * Format the context block for injection as the first user message.
 * Claude Code will see this as the opening message of the conversation.
 */
export function formatContextMessage(context) {
  return `[CCM Auto-context — injected before your prompt]\n\n${context}\n\n[End of auto-context]`
}

/**
 * Write the context to a temp file that can be passed to claude via stdin or --print.
 * Returns the formatted message string.
 */
export function buildContextMessage(projectRoot, sources, opts = {}) {
  const context = buildContext(projectRoot, sources, opts)
  if (!context) return null
  return formatContextMessage(context)
}
