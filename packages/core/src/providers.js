// Provider support — Anthropic only.
// CCM manages Claude Code accounts. Claude Code is Anthropic's product.
// The two auth methods Claude Code supports are Anthropic API key and Email OAuth.
// Additional backends can be added here when Anthropic adds official Claude Code
// support for them.

import { PROVIDERS } from './config.js'

/**
 * Build env vars for a given account's provider.
 * Returns a partial env object to merge into the subprocess environment.
 * Keys set to undefined are deleted from the subprocess env.
 *
 * @param {object} account - Account from accounts.json
 * @param {string} rawKey  - Decrypted Anthropic API key (for ANTHROPIC provider)
 * @returns {object}
 */
export function buildProviderEnv(account, rawKey) {
  const provider = account.provider || PROVIDERS.ANTHROPIC

  switch (provider) {
    case PROVIDERS.ANTHROPIC:
      return {
        ANTHROPIC_API_KEY: rawKey,
        ANTHROPIC_BASE_URL: undefined, // ensure we always hit Anthropic directly
      }

    case PROVIDERS.EMAIL:
      // Handled entirely by isolation.js — no extra env needed here
      return {}

    default:
      // Unknown or future provider — warn and fall back to Anthropic key if available
      return rawKey ? { ANTHROPIC_API_KEY: rawKey } : {}
  }
}

/**
 * Whether a provider uses an Anthropic API key stored in CCM.
 */
export function providerUsesApiKey(provider) {
  return (provider || PROVIDERS.ANTHROPIC) === PROVIDERS.ANTHROPIC
}

/**
 * Whether a provider uses browser/OAuth login via Claude Code.
 */
export function providerUsesEmail(provider) {
  return provider === PROVIDERS.EMAIL
}

/**
 * Whether a provider is fully supported and verified today.
 * Only ANTHROPIC and EMAIL are verified with Claude Code.
 */
export function providerIsSupported(provider) {
  return [PROVIDERS.ANTHROPIC, PROVIDERS.EMAIL].includes(provider || PROVIDERS.ANTHROPIC)
}

/**
 * Human-readable label for display in UI and CLI.
 */
export function providerLabel(provider) {
  const labels = {
    [PROVIDERS.ANTHROPIC]: 'Anthropic API',
    [PROVIDERS.EMAIL]: 'Email (Claude Max / Pro)',
  }
  return labels[provider] || provider
}

/**
 * Auth type required for a provider — drives the AddAccount wizard.
 * Returns 'api_key' | 'email'
 */
export function providerAuthType(provider) {
  if (provider === PROVIDERS.EMAIL) return 'email'
  return 'api_key'
}
