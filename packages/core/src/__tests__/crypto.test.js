import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../crypto.js'

describe('crypto', () => {
  it('round-trips plaintext correctly', () => {
    const text = 'sk-ant-test-key-1234'
    expect(decrypt(encrypt(text))).toBe(text)
  })

  it('returns null for tampered ciphertext', () => {
    const blob = encrypt('secret')
    const tampered = blob.slice(0, -4) + 'xxxx'
    expect(decrypt(tampered)).toBeNull()
  })

  it('returns null for malformed blob', () => {
    expect(decrypt('not:valid')).toBeNull()
    expect(decrypt('')).toBeNull()
    expect(decrypt('a:b')).toBeNull()
  })

  it('produces unique ciphertexts (IV not reused)', () => {
    const blobs = Array.from({ length: 100 }, () => encrypt('same'))
    const unique = new Set(blobs)
    expect(unique.size).toBe(100)
  })

  it('handles empty string', () => {
    expect(decrypt(encrypt(''))).toBe('')
  })

  it('handles unicode and special chars', () => {
    const text = '日本語テスト — "quotes" & <html>'
    expect(decrypt(encrypt(text))).toBe(text)
  })
})
