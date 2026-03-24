// Context compression — reduce JSONL session size before --resume to prevent
// context window overflow. Uses the Anthropic API to summarise old messages.
// The active account's API key is required — pass the account object.

import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { CHECKPOINTS_DIR } from './config.js'
import { getApiKey } from './accounts.js'
import { loadSyncConfig } from './checkpoint.js'
import { debug } from './debug.js'

const DEFAULT_THRESHOLD    = 120000  // tokens — compress if session exceeds this
const DEFAULT_KEEP_RECENT  = 20      // keep last N messages verbatim
const CHARS_PER_TOKEN      = 4

function estimateTokens(jsonlPath) {
  try {
    const size = readFileSync(jsonlPath, 'utf8').length
    return Math.round(size / CHARS_PER_TOKEN)
  } catch { return 0 }
}

function parseMessages(jsonlPath) {
  try {
    return readFileSync(jsonlPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)
      .filter(m => m && (m.type || m.role))
  } catch { return [] }
}

function serialiseMessages(messages) {
  return messages.map(m => JSON.stringify(m)).join('\n') + '\n'
}

async function summariseWithAPI(messages, apiKey) {
  const transcript = messages
    .map(m => {
      const role    = m.type || m.role
      const content = typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map(c => c.text || c.input || '').filter(Boolean).join(' ')
          : ''
      return `${role === 'human' ? 'User' : 'Assistant'}: ${content.slice(0, 800)}`
    })
    .join('\n\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key':         apiKey,
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role:    'user',
          content: `Summarise this conversation history. Preserve all decisions made, ` +
                   `files changed, errors encountered, and open questions. ` +
                   `Be concise but complete.\n\n${transcript}`,
        }],
      }),
    })

    if (!res.ok) {
      debug(`compress: API returned ${res.status}`)
      return null
    }
    const data = await res.json()
    return data?.content?.[0]?.text || null
  } catch (e) {
    debug(`compress: fetch failed: ${e.message}`)
    return null
  }
}

/**
 * Compress a session JSONL file in place.
 * Backs up the original before overwriting.
 *
 * @param {string} jsonlPath  - Path to the session JSONL
 * @param {object} account    - CCM account object (needs API key for summarisation)
 * @param {object} [opts]
 * @param {number} [opts.threshold]   - Token threshold (default 120k)
 * @param {number} [opts.keepRecent]  - Recent messages to keep verbatim (default 20)
 * @param {boolean}[opts.dryRun]      - Report only, make no changes
 */
export async function compressSession(jsonlPath, account, opts = {}) {
  const threshold   = opts.threshold   ?? DEFAULT_THRESHOLD
  const keepRecent  = opts.keepRecent  ?? DEFAULT_KEEP_RECENT

  if (!existsSync(jsonlPath)) {
    return { skipped: true, reason: 'file_not_found' }
  }

  const originalTokens = estimateTokens(jsonlPath)
  if (originalTokens < threshold) {
    return { skipped: true, reason: 'under_threshold', originalTokens }
  }

  const messages = parseMessages(jsonlPath)
  if (messages.length <= keepRecent) {
    return { skipped: true, reason: 'too_few_messages', originalTokens }
  }

  const toSummarise = messages.slice(0, messages.length - keepRecent)
  const toKeep      = messages.slice(messages.length - keepRecent)

  if (opts.dryRun) {
    return {
      skipped: false, dryRun: true, originalTokens,
      messagesToSummarise: toSummarise.length,
      messagesToKeep: toKeep.length,
    }
  }

  // Safety gate: compression sends session content to the Anthropic API.
  // Must be explicitly enabled in config (compressionEnabled: true).
  if (!opts.explicitlyEnabled) {
    const cfg = loadSyncConfig()
    if (!cfg.compressionEnabled) {
      return { skipped: true, reason: 'disabled',
        hint: 'Run: ccm sync on compression  (sends session text to Anthropic API)' }
    }
  }

  // Resolve API key from account
  let apiKey = null
  try {
    apiKey = account ? getApiKey(account) : null
  } catch { /* key unavailable */ }

  if (!apiKey) {
    return { skipped: true, reason: 'no_api_key' }
  }

  debug(`compress: summarising ${toSummarise.length} messages via Anthropic API`)
  const summary = await summariseWithAPI(toSummarise, apiKey)
  if (!summary) {
    return { skipped: true, reason: 'api_unavailable' }
  }

  // Back up original
  const label      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const name       = basename(jsonlPath, '.jsonl')
  const backupDir  = join(CHECKPOINTS_DIR, '_compressed')
  mkdirSync(backupDir, { recursive: true })
  const backupPath = join(backupDir, `${label}-${name}-original.jsonl`)
  copyFileSync(jsonlPath, backupPath)

  // Write compressed
  const summaryMessage = {
    type:    'human',
    role:    'human',
    content: `[Session context summary — ${toSummarise.length} earlier messages compressed]\n\n${summary}`,
  }
  writeFileSync(jsonlPath, serialiseMessages([summaryMessage, ...toKeep]))

  const newTokens = estimateTokens(jsonlPath)
  return { skipped: false, originalTokens, newTokens, backupPath, summarised: toSummarise.length }
}
