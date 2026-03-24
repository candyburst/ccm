// Account export / import — portable backup and restore across machines.
// Export format: JSON with keys re-encrypted using a passphrase.
// The passphrase is independent of the machine key, making backups transferable.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs'
import { join } from 'path'
import { ACCOUNTS_FILE, SESSION_LOG, CCM_DIR } from './config.js'
import { loadAccounts, getApiKey } from './accounts.js'
import { encrypt } from './crypto.js'

const ALGO = 'aes-256-gcm'
const EXPORT_SALT = 'ccm-export-v1'
const FORMAT_VER = 1

// ── Passphrase crypto (independent of machine key) ────────────────────────────

function encryptWithPassphrase(text, passphrase) {
  const key = scryptSync(passphrase, EXPORT_SALT, 32)
  const iv = randomBytes(12)
  const c = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()])
  return [iv.toString('hex'), c.getAuthTag().toString('hex'), enc.toString('hex')].join(':')
}

function decryptWithPassphrase(blob, passphrase) {
  try {
    const parts = blob.split(':')
    if (parts.length !== 3) return null
    const [iv, tag, enc] = parts.map(h => Buffer.from(h, 'hex'))
    const key = scryptSync(passphrase, EXPORT_SALT, 32)
    const d = createDecipheriv(ALGO, key, iv)
    d.setAuthTag(tag)
    return d.update(enc) + d.final('utf8')
  } catch {
    return null
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Export all accounts to a portable JSON string.
 * @param {object} [opts]
 * @param {string}  [opts.passphrase]  - Re-encrypt keys with this passphrase for portability.
 * @param {boolean} [opts.plain]       - Store keys as plaintext (warns loudly).
 * @param {boolean} [opts.includeLog]  - Include session history in export.
 */
export function exportAccounts({ passphrase, plain = false, includeLog = false } = {}) {
  const accounts = loadAccounts()

  const exported = Object.values(accounts).map(account => {
    const base = {
      name: account.name,
      type: account.type,
      notes: account.notes || '',
      disabled: account.disabled || false,
      priority: account.priority ?? 0,
      createdAt: account.createdAt || new Date().toISOString(),
    }

    if (account.type === 'api_key') {
      const rawKey = getApiKey(account)
      if (!rawKey) throw new Error(`Cannot read API key for "${account.name}" — wrong machine key?`)
      if (passphrase) {
        base.encryptedKey = encryptWithPassphrase(rawKey, passphrase)
        base.keyEncryption = 'passphrase'
      } else {
        base.plaintextKey = rawKey
        base.keyEncryption = 'none'
      }
    } else {
      base.email = account.email
      base.sessionDir = account.sessionDir
    }

    return base
  })

  const payload = {
    version: FORMAT_VER,
    exportedAt: new Date().toISOString(),
    encrypted: !!passphrase,
    accounts: exported,
  }

  if (includeLog && existsSync(SESSION_LOG)) {
    try {
      payload.sessionLog = JSON.parse(readFileSync(SESSION_LOG, 'utf8'))
    } catch {
      /* skip */
    }
  }

  return JSON.stringify(payload, null, 2)
}

// ── Import ────────────────────────────────────────────────────────────────────

/**
 * Import accounts from an export JSON string.
 * @param {string}  jsonStr     - Contents of a ccm export file.
 * @param {string}  [passphrase]- Required when keyEncryption is 'passphrase'.
 * @returns {{ imported: number, skipped: string[], errors: string[] }}
 */
export function importAccounts(jsonStr, passphrase) {
  let payload
  try {
    payload = JSON.parse(jsonStr)
  } catch {
    throw new Error('Invalid export file — not valid JSON')
  }

  if (!Array.isArray(payload?.accounts)) {
    throw new Error('Invalid export file — missing accounts array')
  }

  if ((payload.version ?? 1) > FORMAT_VER) {
    throw new Error(`Export was created with a newer version of CCM (format v${payload.version})`)
  }

  const existing = loadAccounts()
  const imported = []
  const skipped = []
  const errors = []

  for (const entry of payload.accounts) {
    if (existing[entry.name]) {
      skipped.push(`"${entry.name}" — already exists`)
      continue
    }

    try {
      const account = {
        name: entry.name,
        type: entry.type,
        notes: entry.notes || '',
        active: false, // never import as active
        disabled: entry.disabled || false,
        priority: entry.priority ?? Object.keys(existing).length,
        createdAt: entry.createdAt || new Date().toISOString(),
      }

      if (entry.type === 'api_key') {
        let rawKey
        if (entry.keyEncryption === 'passphrase') {
          if (!passphrase) {
            errors.push(`"${entry.name}" — passphrase required`)
            continue
          }
          rawKey = decryptWithPassphrase(entry.encryptedKey, passphrase)
          if (!rawKey) {
            errors.push(`"${entry.name}" — wrong passphrase or corrupted key`)
            continue
          }
        } else {
          rawKey = entry.plaintextKey
          if (!rawKey) {
            errors.push(`"${entry.name}" — missing key in export`)
            continue
          }
        }
        account.encryptedKey = encrypt(rawKey) // re-encrypt with this machine's key
      } else {
        account.email = entry.email
        account.sessionDir = entry.sessionDir || join(CCM_DIR, 'sessions', entry.name)
      }

      existing[entry.name] = account
      imported.push(entry.name)
    } catch (e) {
      errors.push(`"${entry.name}" — ${e.message}`)
    }
  }

  if (imported.length > 0) {
    const tmp = ACCOUNTS_FILE + '.tmp'
    writeFileSync(tmp, JSON.stringify(existing, null, 2), { mode: 0o600 })
    renameSync(tmp, ACCOUNTS_FILE)
  }

  return { imported: imported.length, skipped, errors }
}
