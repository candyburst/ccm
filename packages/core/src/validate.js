// API key validation — ping Anthropic before saving anything
// Returns { valid: true } or { valid: false, reason, hint }

const VALIDATION_URL = 'https://api.anthropic.com/v1/models'
const TIMEOUT_MS     = 10000

export async function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, reason: 'empty', hint: 'API key cannot be empty' }
  }

  if (!apiKey.startsWith('sk-ant-')) {
    return {
      valid: false,
      reason: 'format',
      hint: 'API key should start with sk-ant- — get yours at console.anthropic.com',
    }
  }

  try {
    const controller = new AbortController()
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let res
    try {
      res = await fetch(VALIDATION_URL, {
        method:  'GET',
        headers: {
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (res.status === 200) {
      return { valid: true }
    }

    if (res.status === 401) {
      return {
        valid: false,
        reason: 'invalid_key',
        hint:   'Invalid API key — check it at console.anthropic.com/settings/keys',
      }
    }

    if (res.status === 403) {
      return {
        valid: false,
        reason: 'no_access',
        hint:   'API key is valid but has insufficient permissions — check your Anthropic plan',
      }
    }

    if (res.status === 429) {
      // Rate-limited but key is valid — treat as valid
      return { valid: true, warning: 'rate_limited' }
    }

    return {
      valid: false,
      reason: `http_${res.status}`,
      hint:   `Anthropic API returned status ${res.status} — try again or check status.anthropic.com`,
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        valid: false,
        reason: 'timeout',
        hint:   'Request timed out — check your internet connection and try again',
      }
    }
    return {
      valid: false,
      reason: 'network',
      hint:   `Network error: ${err.message} — check your connection and try again`,
    }
  }
}
