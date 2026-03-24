// Lightweight debug logger — output gated on CCM_DEBUG=1
// Usage: import { debug } from './debug.js'; debug('message')
const ENABLED = !!process.env.CCM_DEBUG

export const debug = (msg) => {
  if (ENABLED) process.stderr.write(`[ccm:debug] ${msg}\n`)
}
