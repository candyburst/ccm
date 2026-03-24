import { describe, it, expect } from 'vitest'
import { CREDIT_PATTERNS } from '../config.js'

const isCreditError = (text) => CREDIT_PATTERNS.some(p => p.test(text))

describe('CREDIT_PATTERNS', () => {
  // These MUST match — real Claude Code stderr samples
  const shouldMatch = [
    'Error: Your credit balance is too low to make this request',
    'insufficient credits — please add more to continue',
    'Payment required to proceed',
    'usage limit exceeded for this billing period',
    'quota exceeded',
    'Quota exceeded for your current plan',
    'QUOTA EXCEEDED',  // case-insensitive
    'Credit Balance Is Too Low',  // mixed case
  ]

  // These must NOT match — normal Claude Code output
  const shouldNotMatch = [
    'Running tests...',
    'Error: file not found',
    'TypeError: cannot read property',
    'Connection refused',
    'Timeout waiting for response',
    '',
    'Your balance is great',
    'insufficient information provided',
  ]

  shouldMatch.forEach(text => {
    it(`matches: "${text.slice(0, 60)}"`, () => {
      expect(isCreditError(text)).toBe(true)
    })
  })

  shouldNotMatch.forEach(text => {
    it(`does NOT match: "${text.slice(0, 60) || '(empty)'}"`, () => {
      expect(isCreditError(text)).toBe(false)
    })
  })
})
