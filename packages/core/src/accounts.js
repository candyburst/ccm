import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { CCM_DIR, ACCOUNTS_FILE, SESSIONS_DIR, AUTH } from './config.js'
import { validateApiKey } from './validate.js'
import { encrypt, decrypt } from './crypto.js'

const TMP_FILE = ACCOUNTS_FILE + '.tmp'

function ensureDirs() {
  mkdirSync(CCM_DIR, { recursive: true })
  mkdirSync(SESSIONS_DIR, { recursive: true })
}

export function loadAccounts() {
  ensureDirs()
  if (!existsSync(ACCOUNTS_FILE)) return {}
  try {
    return JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8'))
  } catch {
    return {}
  }
}

// Atomic write: write to .tmp then rename — prevents corruption on crash
function save(accounts) {
  ensureDirs()
  writeFileSync(TMP_FILE, JSON.stringify(accounts, null, 2), { mode: 0o600 })
  renameSync(TMP_FILE, ACCOUNTS_FILE)
}

export function getAccount(name) {
  const all = loadAccounts()
  if (!all[name]) throw new Error(`Account "${name}" not found`)
  return all[name]
}

export function listAccounts() {
  return Object.values(loadAccounts())
}

export function getActiveAccount() {
  return listAccounts().find(a => a.active) || null
}

export function getNextAccount(currentName) {
  const all = listAccounts()
  if (all.length <= 1) return null
  const i = all.findIndex(a => a.name === currentName)
  return all[(i + 1) % all.length]
}

export async function addApiKeyAccount(name, apiKey, notes = '') {
  const accounts = loadAccounts()
  if (accounts[name]) throw new Error(`Account "${name}" already exists`)

  // Validate the key against the Anthropic API before storing it
  const check = await validateApiKey(apiKey)
  if (!check.valid) throw new Error(check.hint || `Invalid API key: ${check.reason}`)

  accounts[name] = {
    name,
    type: AUTH.API_KEY,
    encryptedKey: encrypt(apiKey),
    notes,
    active: false,
    disabled: false,
    priority: Object.keys(accounts).length,
    createdAt: new Date().toISOString(),
  }
  save(accounts)
  return accounts[name]
}

export function addEmailAccount(name, email, notes = '') {
  const accounts = loadAccounts()
  if (accounts[name]) throw new Error(`Account "${name}" already exists`)
  const sessionDir = join(SESSIONS_DIR, name)
  mkdirSync(sessionDir, { recursive: true })
  accounts[name] = {
    name,
    type: AUTH.EMAIL,
    email,
    sessionDir,
    notes,
    active: false,
    disabled: false,
    priority: Object.keys(accounts).length,
    createdAt: new Date().toISOString(),
  }
  save(accounts)
  return accounts[name]
}

export function removeAccount(name) {
  const accounts = loadAccounts()
  if (!accounts[name]) throw new Error(`Account "${name}" not found`)
  delete accounts[name]
  save(accounts)
}

export function updateAccount(name, updates) {
  const accounts = loadAccounts()
  if (!accounts[name]) throw new Error(`Account "${name}" not found`)
  // Re-encrypt API key if being rotated
  if (updates.apiKey) {
    updates.encryptedKey = encrypt(updates.apiKey)
    delete updates.apiKey
  }
  accounts[name] = { ...accounts[name], ...updates }
  save(accounts)
  return accounts[name]
}

export function setActiveAccount(name) {
  const accounts = loadAccounts()
  for (const a of Object.values(accounts)) a.active = false
  if (name && accounts[name]) accounts[name].active = true
  save(accounts)
}

export function getApiKey(account) {
  if (account.type !== AUTH.API_KEY) throw new Error('Not an API key account')
  const key = decrypt(account.encryptedKey)
  if (!key)
    throw new Error(
      `Failed to decrypt API key for "${account.name}" — key may be from a different machine`
    )
  return key
}
