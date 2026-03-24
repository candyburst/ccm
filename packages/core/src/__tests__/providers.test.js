import { describe, it, expect } from 'vitest'
import {
  buildProviderEnv,
  providerUsesApiKey,
  providerUsesEmail,
  providerIsSupported,
  providerLabel,
  providerAuthType,
} from '../providers.js'
import { PROVIDERS } from '../config.js'

describe('buildProviderEnv — ANTHROPIC', () => {
  it('sets ANTHROPIC_API_KEY', () => {
    const env = buildProviderEnv({ provider: PROVIDERS.ANTHROPIC }, 'sk-ant-key')
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-key')
  })

  it('explicitly removes ANTHROPIC_BASE_URL', () => {
    const env = buildProviderEnv({ provider: PROVIDERS.ANTHROPIC }, 'sk-ant-key')
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined()
  })

  it('works when provider field is absent (defaults to ANTHROPIC)', () => {
    const env = buildProviderEnv({}, 'sk-ant-key')
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-key')
  })
})

describe('buildProviderEnv — EMAIL', () => {
  it('returns empty object (isolation.js handles it)', () => {
    const env = buildProviderEnv({ provider: PROVIDERS.EMAIL }, null)
    expect(Object.keys(env)).toHaveLength(0)
  })
})

describe('buildProviderEnv — unknown provider', () => {
  it('falls back to api key if available', () => {
    const env = buildProviderEnv({ provider: 'unknown-future' }, 'sk-ant-key')
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-key')
  })

  it('returns empty if no key', () => {
    const env = buildProviderEnv({ provider: 'unknown-future' }, null)
    expect(Object.keys(env)).toHaveLength(0)
  })
})

describe('providerIsSupported', () => {
  it('returns true for ANTHROPIC and EMAIL', () => {
    expect(providerIsSupported(PROVIDERS.ANTHROPIC)).toBe(true)
    expect(providerIsSupported(PROVIDERS.EMAIL)).toBe(true)
  })

  it('returns true when provider is undefined (defaults to ANTHROPIC)', () => {
    expect(providerIsSupported(undefined)).toBe(true)
  })

  it('returns false for unknown strings', () => {
    expect(providerIsSupported('openrouter')).toBe(false)
    expect(providerIsSupported('bedrock')).toBe(false)
  })
})

describe('PROVIDERS constant', () => {
  it('only contains ANTHROPIC and EMAIL', () => {
    const keys = Object.keys(PROVIDERS)
    expect(keys).toEqual(['ANTHROPIC', 'EMAIL'])
  })

  it('values are strings', () => {
    for (const v of Object.values(PROVIDERS)) {
      expect(typeof v).toBe('string')
    }
  })
})
