import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { CCM_DIR } from './config.js'

const ALGO = 'aes-256-gcm'
const SALT = 'ccm-v1-salt-2025'
const KEY_FILE = join(CCM_DIR, '.key')

// ── Machine key ───────────────────────────────────────────────────────────────
// Priority: CCM_SECRET env var → persisted random key in ~/.ccm/.key
// The persisted key is 32 random bytes written once with mode 0600.
// This is far stronger than deriving from $HOME which is publicly known.

function getMachineKey() {
  if (process.env.CCM_SECRET) {
    return scryptSync(process.env.CCM_SECRET, SALT, 32)
  }

  // Load or create the persisted random key
  if (existsSync(KEY_FILE)) {
    const raw = readFileSync(KEY_FILE, 'utf8').trim()
    return Buffer.from(raw, 'hex')
  }

  // First run — generate and persist a random key
  mkdirSync(CCM_DIR, { recursive: true })
  const raw = randomBytes(32)
  writeFileSync(KEY_FILE, raw.toString('hex'), { mode: 0o600 })
  return raw
}

export function encrypt(text) {
  const iv = randomBytes(12)
  const k = getMachineKey()
  const c = createCipheriv(ALGO, k, iv)
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()])
  return [iv.toString('hex'), c.getAuthTag().toString('hex'), enc.toString('hex')].join(':')
}

export function decrypt(blob) {
  try {
    const parts = blob.split(':')
    if (parts.length !== 3) return null
    const [iv, tag, enc] = parts.map(h => Buffer.from(h, 'hex'))
    const k = getMachineKey()
    const d = createDecipheriv(ALGO, k, iv)
    d.setAuthTag(tag)
    return d.update(enc) + d.final('utf8')
  } catch {
    return null // tampered, wrong key, or malformed — never throw
  }
}
