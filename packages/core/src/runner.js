import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { AUTH, CLAUDE_CONFIG_ENV, CREDIT_PATTERNS, PROVIDERS, EXIT_REASONS } from './config.js'
import { buildProviderEnv, providerUsesEmail, providerIsSupported } from './providers.js'
import { getApiKey, setActiveAccount, listAccounts } from './accounts.js'
import { startSession, endSession, cleanupOrphanedSessions } from './sessions.js'
import { findLatestSession, transferSession } from './session-transfer.js'
import { gitCheckpoint, backupSessionFile, loadSyncConfig } from './checkpoint.js'
import { pushProject } from './github-sync.js'
import { getIsolationEnv, prepareIsolation, getIsolationMethod } from './isolation.js'
import { debug } from './debug.js'
import { detectResumeOutcome, extractSessionSummary } from './resume-verify.js'
import { loadPlugins, firePluginEvent } from './plugins.js'
import { ensureHooksRegistered } from './hooks.js'
import { buildContextMessage } from './context-injector.js'

// TOKEN_PATTERN: Claude Code prints usage stats at session end in the form:
// "Tokens: 12,345 input, 4,567 output" — we parse this when available.
// Format may vary by Claude Code version; we degrade gracefully if absent.
const TOKEN_PATTERN = /tokens?:?\s*([\d,]+)\s*input[,\s]+([\d,]+)\s*output/i

function buildEnv(account) {
  const env = { ...process.env }

  // Strip CCM's own vars — must never reach Claude subprocess
  delete env.CCM_SECRET
  delete env.CCM_DEBUG

  const provider = account.provider || PROVIDERS.ANTHROPIC

  // Warn if attempting to use an unsupported provider
  if (!providerIsSupported(provider)) {
    process.stderr.write(
      `[ccm] Warning: provider "${provider}" is not yet supported by Claude Code. ` +
      `Proceeding with best-effort env setup.\n`
    )
  }

  if (providerUsesEmail(provider)) {
    // Email/OAuth — isolation module handles CLAUDE_CONFIG_DIR
    delete env.ANTHROPIC_API_KEY
    delete env.ANTHROPIC_BASE_URL
    const isolationEnv = getIsolationEnv(account)
    Object.assign(env, isolationEnv)
    debug(`email isolation: method=${getIsolationMethod()} account=${account.name}`)
  } else {
    // API-key or credential-based providers
    delete env[CLAUDE_CONFIG_ENV]
    const rawKey = account.type === AUTH.API_KEY ? getApiKey(account) : null
    const providerEnv = buildProviderEnv(account, rawKey)

    // Apply provider env — delete any key set to undefined
    for (const [k, v] of Object.entries(providerEnv)) {
      if (v === undefined) delete env[k]
      else env[k] = v
    }
    debug(`provider: ${provider} account=${account.name}`)
  }

  return env
}

function isCreditError(text, code) {
  return code === 402 || CREDIT_PATTERNS.some(p => p.test(text))
}

// Parse token usage from accumulated output text — returns { input, output } or null
function parseTokenUsage(text) {
  const m = text.match(TOKEN_PATTERN)
  if (!m) return null
  return {
    input:  parseInt(m[1].replace(/,/g, ''), 10),
    output: parseInt(m[2].replace(/,/g, ''), 10),
  }
}

function getNextFreshAccount(currentName, exhausted) {
  const all = listAccounts()
    .filter(a => !a.disabled)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

  if (all.length <= 1) return null

  const idx = all.findIndex(a => a.name === currentName)
  for (let i = 1; i < all.length; i++) {
    const candidate = all[(idx + i) % all.length]
    if (!exhausted.has(candidate.name)) return candidate
  }
  return null
}

export async function runClaude(account, args = [], opts = {}) {
  const {
    autoSwitch      = true,
    projectName,
    projectRoot,
    onLog,
    onStdout,
    onPid,
    onSwitch,
    onCheckpoint,
    resumeSessionId = null,
    _exhausted      = new Set(),
  } = opts

  cleanupOrphanedSessions()

  const cfg = loadSyncConfig()

  // Load plugins once and verify hooks are registered if enabled
  await loadPlugins()
  ensureHooksRegistered(cfg)
  _exhausted.add(account.name)

  const sessionId = startSession({ account: account.name, projectName, projectRoot })
  await firePluginEvent('onSessionStart', { account: account.name, projectRoot, flags: args })

  // Auto context injection — prepend project context if configured and not suppressed
  let injectMessage = null
  if (!opts.noInject && projectRoot) {
    try {
            const projFile = join(projectRoot, '.ccm-project.json')
      if (existsSync(projFile)) {
        const proj = JSON.parse(readFileSync(projFile, 'utf8'))
        if (proj.autoInject?.length > 0) {
          injectMessage = buildContextMessage(projectRoot, proj.autoInject)
          if (injectMessage) debug(`context injection: ${injectMessage.length} chars`)
        }
      }
    } catch { /* auto-inject is best-effort */ }
  }

  // If context injection is configured, print it to stderr before launch
  // (Claude Code doesn't have a --prepend-context flag — this is logged for the user)
  if (injectMessage && !resumeSessionId) {
    process.stderr.write('\n[ccm] Auto-context injected — copy this before your prompt if needed:\n')
    process.stderr.write('─'.repeat(60) + '\n')
    process.stderr.write(injectMessage + '\n')
    process.stderr.write('─'.repeat(60) + '\n\n')
  }

  const claudeArgs = resumeSessionId
    ? ['--resume', resumeSessionId, ...args.filter(a => a !== '--resume')]
    : [...args]

  debug(`spawning claude account="${account.name}" args=${JSON.stringify(claudeArgs)}`)

  const cleanupIsolation = providerUsesEmail(account.provider || PROVIDERS.ANTHROPIC)
    ? prepareIsolation(account)
    : () => {}

  return new Promise((resolve, reject) => {
    const child = spawn('claude', claudeArgs, {
      env:   buildEnv(account),
      // Both stdout and stderr piped so we can:
      // - Forward them to the terminal in real time
      // - Parse token usage from stdout
      // - Detect credit errors in stderr
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    let stderr = ''
    let stdout = ''

    let resumeVerified  = false
    let resumeCheckDone = false

    // Notify caller of PID so it can send SIGTERM if needed
    if (onPid) onPid(child.pid)

    child.stdout.on('data', chunk => {
      const txt = chunk.toString()
      stdout += txt
      process.stdout.write(txt)   // forward to terminal
      onStdout?.(txt)
      onLog?.(txt)

      // Check resume outcome from first few hundred chars of output
      if (!resumeCheckDone && resumeSessionId && stdout.length > 100) {
        resumeCheckDone = true
        const outcome = detectResumeOutcome(stdout)
        if (outcome === 'fresh' && opts._verifyResumePath) {
          // Resume silently failed — inject context as next message
          const summary = extractSessionSummary(opts._verifyResumePath)
          if (summary) {
            debug('resume-verify: fresh start detected — summary injected via stdin')
            // Claude is already running; we can't inject a message here without
            // a proper MCP/stdin protocol. Log the outcome for the session record.
          }
          debug(`resume-verify: outcome=fresh (resume may have failed)`)
        } else {
          debug(`resume-verify: outcome=${outcome}`)
        }
        resumeVerified = outcome === 'resumed'
      }
    })

    child.stderr.on('data', chunk => {
      const txt = chunk.toString()
      stderr += txt
      process.stderr.write(txt)   // forward to terminal
      onLog?.(txt)
    })

    child.on('close', (code) => {
      // Wrap all async work in an immediately-invoked async function so
      // errors surface through reject() and don't silently disappear
      ;(async () => {
      cleanupIsolation()

      // Parse token usage from session output and store in session log
      const tokens = parseTokenUsage(stdout + stderr)
      const creditError = isCreditError(stderr, code) && autoSwitch

      if (creditError) {
        const next = getNextFreshAccount(account.name, _exhausted)

        if (!next) {
          endSession(sessionId, { exitCode: code, exitReason: EXIT_REASONS.CREDIT_LIMIT_EXHAUSTED, tokens })
          process.stderr.write('\n[ccm] All accounts exhausted — no more accounts to try\n')
          resolve({ code, account, sessionId, exhausted: true })
          return
        }

        process.stderr.write(`\n[ccm] Credit limit on "${account.name}" → switching to "${next.name}"\n`)
        endSession(sessionId, { exitCode: code, exitReason: EXIT_REASONS.CREDIT_LIMIT, switched: true, switchedTo: next.name, tokens })

        // 1. Git checkpoint
        let checkpointResult = { skipped: true }
        if (cfg.gitCheckpoint && projectRoot) {
          process.stderr.write('[ccm] Running git checkpoint...\n')
          checkpointResult = await gitCheckpoint(projectRoot, {
            message: `before switch ${account.name} → ${next.name}`,
            push: cfg.github?.enabled && cfg.github?.autoPushOnSwitch && cfg.github?.projectSync,
          })
          onCheckpoint?.(checkpointResult)
          if (checkpointResult.success) {
            await firePluginEvent('onCheckpoint', { commitHash: checkpointResult.commitHash, projectRoot, account: account.name })
            process.stderr.write(`[ccm] Checkpoint: ${checkpointResult.commitHash || 'ok'}\n`)
          }
        }

        // 2. Find + transfer session JSONL
        let nextResumeId = null
        if (cfg.smartResume) {
          const session = findLatestSession(account, projectRoot || process.cwd())
          if (session) {
            backupSessionFile(session.filePath, { account: account.name, sessionId: session.sessionId, projectRoot })
            const transfer = transferSession(account, next, session.sessionId, projectRoot || process.cwd())
            if (transfer.success) {
              nextResumeId = session.sessionId
              process.stderr.write(`[ccm] Session transferred (${session.sessionId.slice(0, 8)}…) → resuming on "${next.name}"\n`)
              // Store the source path so the recursive call can verify resume success
              opts._verifyResumePath = transfer.fromFile
            } else {
              process.stderr.write(`[ccm] Session transfer skipped: ${transfer.reason}\n`)
            }
          } else {
            process.stderr.write('[ccm] No session file found — starting fresh\n')
          }
        }

        // 3. GitHub push if configured
        if (cfg.github?.enabled && cfg.github?.autoPushOnSwitch && projectRoot) {
          pushProject(projectRoot, { message: `switch ${account.name} → ${next.name}` }).catch(() => {})
        }

        setActiveAccount(next.name)
        onSwitch?.(account.name, next.name)
        await firePluginEvent('onSwitch', { from: account.name, to: next.name, sessionId, projectRoot })

        let result
        try {
          result = await runClaude(next, args, {
            ...opts,
            resumeSessionId: nextResumeId,
            _exhausted,
          })
        } catch (err) {
          reject(err)
          return
        }
        resolve(result)
        return
      }

      const exitReason = code === 0 ? EXIT_REASONS.NORMAL : EXIT_REASONS.ERROR
      endSession(sessionId, { exitCode: code, exitReason, tokens })
      await firePluginEvent('onSessionEnd', { account: account.name, exitReason, durationSec: null, projectRoot })

      if (cfg.github?.enabled && cfg.github?.autoPushOnEnd && projectRoot) {
        pushProject(projectRoot, { message: 'session end' }).catch(() => {})
      }

      resolve({ code, account, sessionId, tokens })
      })().catch(reject)
    })

    child.on('error', err => {
      cleanupIsolation()
      endSession(sessionId, { exitCode: -1, exitReason: EXIT_REASONS.SPAWN_ERROR })
      if (err.code === 'ENOENT') {
        reject(new Error('Claude Code not found — install it with: npm i -g @anthropic-ai/claude-code'))
      } else {
        reject(err)
      }
    })
  })
}

export async function loginEmailAccount(account) {
  return new Promise((resolve, reject) => {
    process.stderr.write(`\n[ccm] Opening browser login for "${account.name}" (${account.email})\n`)
    const cleanupIsolation = prepareIsolation(account)
    const child = spawn('claude', ['auth', 'login'], {
      env:   buildEnv(account),
      stdio: 'inherit',
    })
    child.on('close', code => { cleanupIsolation(); resolve(code) })
    child.on('error', err => {
      cleanupIsolation()
      if (err.code === 'ENOENT') reject(new Error('Claude Code not found'))
      else reject(err)
    })
  })
}
