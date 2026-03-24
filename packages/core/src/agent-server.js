// Remote CCM agent — WebSocket server that exposes CCM over a network connection.
// The local Electron app connects to a remote machine running this server.
// Auth: HMAC-signed messages using a shared token.

import { createServer } from 'http'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { listAccounts, getActiveAccount } from './accounts.js'
import { getSessions, getSessionStats } from './sessions.js'
import { loadSyncConfig } from './checkpoint.js'
import { runClaude } from './runner.js'
import { debug } from './debug.js'

const DEFAULT_PORT = 7838 // different from web dashboard (7837)

// ── HMAC auth ─────────────────────────────────────────────────────────────────

function signMessage(payload, token) {
  return createHmac('sha256', token).update(JSON.stringify(payload)).digest('hex')
}

function verifyMessage(payload, sig, token) {
  const expected = signMessage(payload, token)
  // timingSafeEqual prevents timing oracle attacks on the HMAC signature
  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ── WebSocket-like protocol over HTTP SSE + POST ───────────────────────────────
// Uses Node's built-in http module — no ws dependency needed.
// Client sends commands via POST /cmd, receives events via GET /stream (SSE).

/**
 * Start the remote CCM agent server.
 *
 * @param {object} opts
 * @param {number}  [opts.port]   - Port (default 7838)
 * @param {string}  [opts.token]  - Auth token (generated if not provided)
 * @returns {{ port, token, close }}
 */
export function startAgentServer({ port = DEFAULT_PORT, token } = {}) {
  const authToken = token || randomBytes(24).toString('hex')
  const clients = new Set() // active SSE connections

  function broadcast(event, data) {
    const msg = `data: ${JSON.stringify({ event, data, ts: Date.now() })}\n\n`
    for (const c of clients) {
      try {
        c.write(msg)
      } catch {
        clients.delete(c)
      }
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)

    // Auth check
    const tok = req.headers['x-ccm-token'] || url.searchParams.get('token') || ''
    const tokOk =
      tok.length === authToken.length && timingSafeEqual(Buffer.from(tok), Buffer.from(authToken))
    if (!tokOk) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'unauthorized' }))
      return
    }

    // SSE stream
    if (req.method === 'GET' && url.pathname === '/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      clients.add(res)
      // Send initial snapshot
      broadcast('snapshot', {
        accounts: listAccounts().map(a => ({ name: a.name, type: a.type, active: a.active })),
        sessions: getSessions({ limit: 20 }),
        stats: getSessionStats(),
      })
      req.on('close', () => clients.delete(res))
      return
    }

    // Command endpoint
    if (req.method === 'POST' && url.pathname === '/cmd') {
      let body = ''
      req.on('data', c => (body += c))
      req.on('end', async () => {
        try {
          const { cmd, args, sig } = JSON.parse(body)

          // Verify HMAC signature
          if (!verifyMessage({ cmd, args }, sig, authToken)) {
            res.writeHead(403)
            res.end(JSON.stringify({ error: 'invalid signature' }))
            return
          }

          let result = null

          if (cmd === 'accounts:list') {
            result = listAccounts().map(a => ({
              name: a.name,
              type: a.type,
              active: a.active,
              disabled: a.disabled,
            }))
          } else if (cmd === 'sessions:list') {
            result = getSessions({ limit: args?.limit || 50 })
          } else if (cmd === 'stats') {
            result = getSessionStats()
          } else if (cmd === 'runner:start') {
            const { accountName, flags = [] } = args || {}
            const { getAccount } = await import('./accounts.js')
            const account = getAccount(accountName)
            // Run async, send events over SSE stream
            // Fire-and-forget: run session and broadcast events
            // Deliberately not awaited — this is a long-running operation
            ;(async () => {
              try {
                const r = await runClaude(account, flags, {
                  autoSwitch: true,
                  projectRoot: args.projectRoot,
                  onSwitch: (from, to) => broadcast('switch', { from, to }),
                  onStdout: txt => broadcast('stdout', { text: txt }),
                  onLog: txt => broadcast('stderr', { text: txt }),
                  onCheckpoint: r => broadcast('checkpoint', { result: r }),
                })
                broadcast('session:end', r)
              } catch (e) {
                broadcast('error', { message: e.message })
              }
            })()
            result = { started: true }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, data: result }))
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: e.message }))
        }
      })
      return
    }

    // Health check
    if (url.pathname === '/health') {
      res.writeHead(200)
      res.end('ok')
      return
    }

    res.writeHead(404)
    res.end('Not found')
  })

  server.listen(port, '0.0.0.0', () => {
    process.stderr.write(`[ccm] Remote agent listening on port ${port}\n`)
    process.stderr.write(`[ccm] Token: ${authToken}\n`)
  })

  return {
    port,
    token: authToken,
    close: () => server.close(),
  }
}
