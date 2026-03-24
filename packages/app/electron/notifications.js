// OS notification module for CCM Electron app.
// All notification logic lives here — main.js calls these functions.
// Respects the showNotifications config toggle. Never throws — notifications
// are best-effort and should never crash the session.

const { Notification } = require('electron')

// Check support once at module load
const SUPPORTED = Notification.isSupported()

/**
 * Show a notification if supported and enabled in config.
 * @param {string} title
 * @param {string} body
 * @param {object} cfg — loaded sync config; must have showNotifications field
 */
function notify(title, body, cfg) {
  try {
    if (!SUPPORTED) return
    if (cfg?.showNotifications === false) return
    new Notification({ title, body, silent: false }).show()
  } catch {
    /* never propagate notification errors */
  }
}

function notifySessionEnd(accountName, durationSec, cfg) {
  const mins = durationSec ? Math.round(durationSec / 60) : 0
  const time = durationSec >= 60 ? `${mins}m` : `${durationSec}s`
  notify('CCM — Session ended', `${time} · ${accountName}`, cfg)
}

function notifySwitch(fromAccount, toAccount, cfg) {
  notify(
    'CCM — Account switched',
    `Credit limit on "${fromAccount}" → switched to "${toAccount}"`,
    cfg
  )
}

function notifyCheckpoint(commitHash, cfg) {
  notify('CCM — Checkpoint saved', commitHash || 'committed', cfg)
}

function notifyAllExhausted(cfg) {
  notify('CCM — All accounts exhausted', 'No accounts available — session stopped', cfg)
}

module.exports = {
  notifySessionEnd,
  notifySwitch,
  notifyCheckpoint,
  notifyAllExhausted,
}
