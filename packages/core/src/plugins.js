// Plugin system — load and run community plugins from ~/.ccm/plugins/*.js
// Plugins are async, non-blocking, and crash-isolated.

import { existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { join, basename } from 'path'
import { CCM_DIR } from './config.js'
import { debug } from './debug.js'

const PLUGINS_DIR    = join(CCM_DIR, 'plugins')
const DISABLED_FILE  = join(CCM_DIR, 'plugins-disabled.json')
const ERROR_LOG      = join(CCM_DIR, 'plugin-errors.log')

// ── Plugin registry ───────────────────────────────────────────────────────────

let _loaded = null  // cache: null = not loaded, [] = loaded (possibly empty)

function loadDisabledList() {
  try { return new Set(JSON.parse(readFileSync(DISABLED_FILE, 'utf8'))) }
  catch { return new Set() }
}

function saveDisabledList(set) {
  mkdirSync(CCM_DIR, { recursive: true })
  writeFileSync(DISABLED_FILE, JSON.stringify([...set], null, 2))
}

/**
 * Load all enabled plugins from ~/.ccm/plugins/*.js
 * Returns cached result on subsequent calls within the same process.
 */
export async function loadPlugins() {
  if (_loaded) return _loaded

  if (!existsSync(PLUGINS_DIR)) {
    _loaded = []
    return _loaded
  }

  const disabled = loadDisabledList()
  const files    = readdirSync(PLUGINS_DIR)
    .filter(f => f.endsWith('.js') && !disabled.has(f))

  const plugins = []
  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(join(PLUGINS_DIR, file)).href)
      plugins.push({ name: file, mod, disabled: false })
      debug(`plugins: loaded ${file}`)
    } catch (e) {
      logPluginError(file, 'load', e)
    }
  }

  _loaded = plugins
  return _loaded
}

/**
 * Fire a plugin lifecycle event. All plugins run concurrently.
 * A plugin crash never propagates — errors are logged only.
 * @param {string} event  - e.g. 'onSwitch', 'onSessionEnd'
 * @param {object} payload
 */
export async function firePluginEvent(event, payload) {
  const plugins = _loaded || await loadPlugins()
  if (plugins.length === 0) return

  await Promise.all(plugins.map(async ({ name, mod }) => {
    const fn = mod[event]
    if (typeof fn !== 'function') return
    try {
      await fn(payload)
    } catch (e) {
      logPluginError(name, event, e)
    }
  }))
}

// ── Plugin management ──────────────────────────────────────────────────────────

export function listPlugins() {
  const disabled = loadDisabledList()
  if (!existsSync(PLUGINS_DIR)) return []

  return readdirSync(PLUGINS_DIR)
    .filter(f => f.endsWith('.js'))
    .map(f => ({ name: f, disabled: disabled.has(f) }))
}

export function disablePlugin(name) {
  const disabled = loadDisabledList()
  disabled.add(name)
  saveDisabledList(disabled)
  _loaded = null  // invalidate cache
}

export function enablePlugin(name) {
  const disabled = loadDisabledList()
  disabled.delete(name)
  saveDisabledList(disabled)
  _loaded = null  // invalidate cache
}

// ── Error logging ─────────────────────────────────────────────────────────────

function logPluginError(name, event, err) {
  const entry = `[${new Date().toISOString()}] ${name} / ${event}: ${err.message}\n`
  try {
    mkdirSync(CCM_DIR, { recursive: true })
    appendFileSync(ERROR_LOG, entry)
  } catch { /* never throw from error logging */ }
  debug(`plugin error: ${entry.trim()}`)
}
