// Claude Code hooks integration.
// Registers CCM lifecycle commands in ~/.claude/settings.json so Claude Code
// calls them automatically on SessionEnd, PostToolCall, etc.

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join } from 'path'
import { CLAUDE_HOME } from './config.js'
import { debug } from './debug.js'

const SETTINGS_FILE = join(CLAUDE_HOME, 'settings.json')

// The hooks CCM can register — keyed by a stable CCM identifier
const CCM_HOOKS = {
  'ccm-checkpoint': {
    event:   'SessionEnd',
    command: 'ccm checkpoint --silent',
    desc:    'Auto-checkpoint on every session end',
  },
  'ccm-push': {
    event:   'PostToolCall',
    command: 'ccm sync push --silent --if-dirty',
    desc:    'Push project to remote after each tool call',
  },
}

// ── Settings file helpers ──────────────────────────────────────────────────────

function readSettings() {
  if (!existsSync(SETTINGS_FILE)) return {}
  try { return JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) }
  catch { return {} }
}

function writeSettings(settings) {
  mkdirSync(CLAUDE_HOME, { recursive: true })
  const tmp = SETTINGS_FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(settings, null, 2))
  renameSync(tmp, SETTINGS_FILE)
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Register one or all CCM hooks in ~/.claude/settings.json.
 * @param {string|null} hookId - Specific hook key, or null to register all.
 */
export function registerHooks(hookId = null) {
  const settings = readSettings()
  if (!settings.hooks) settings.hooks = {}

  const toRegister = hookId ? { [hookId]: CCM_HOOKS[hookId] } : CCM_HOOKS

  for (const [id, hook] of Object.entries(toRegister)) {
    if (!hook) continue
    if (!settings.hooks[hook.event]) settings.hooks[hook.event] = []

    // Avoid duplicate registrations — check by command string
    const alreadyRegistered = settings.hooks[hook.event]
      .some(h => h.command === hook.command)

    if (!alreadyRegistered) {
      settings.hooks[hook.event].push({ command: hook.command })
      debug(`hooks: registered ${id} on ${hook.event}`)
    }
  }

  writeSettings(settings)
}

/**
 * Remove one or all CCM hooks from ~/.claude/settings.json.
 * @param {string|null} hookId - Specific hook key, or null to remove all.
 */
export function unregisterHooks(hookId = null) {
  if (!existsSync(SETTINGS_FILE)) return

  const settings  = readSettings()
  if (!settings.hooks) return

  const toRemove = hookId
    ? [CCM_HOOKS[hookId]].filter(Boolean)
    : Object.values(CCM_HOOKS)

  const commandsToRemove = new Set(toRemove.map(h => h.command))

  for (const event of Object.keys(settings.hooks)) {
    settings.hooks[event] = settings.hooks[event]
      .filter(h => !commandsToRemove.has(h.command))
    if (settings.hooks[event].length === 0) {
      delete settings.hooks[event]
    }
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks
  }

  writeSettings(settings)
  debug('hooks: unregistered CCM hooks')
}

/**
 * List all currently registered CCM hooks and their status.
 * @returns {Array<{ id, event, command, registered }>}
 */
export function listRegisteredHooks() {
  const settings = readSettings()

  return Object.entries(CCM_HOOKS).map(([id, hook]) => {
    const registered = settings.hooks?.[hook.event]
      ?.some(h => h.command === hook.command) ?? false
    return { id, event: hook.event, command: hook.command, desc: hook.desc, registered }
  })
}

/**
 * Ensure hooks are registered if they should be. Called on ccm run.
 * Only registers if the hooksEnabled config flag is true.
 */
export function ensureHooksRegistered(cfg) {
  if (!cfg?.hooksEnabled) return
  // Check if all hooks are already there — skip write if so
  const hooks = listRegisteredHooks()
  const anyMissing = hooks.some(h => !h.registered)
  if (anyMissing) {
    registerHooks()
    debug('hooks: self-healed missing hooks')
  }
}

export { CCM_HOOKS }
