// Local web dashboard — read-only, token-authenticated, SSE live updates.
// Run with: ccm serve [--port N] [--open]

import { createServer } from 'http'
import { randomBytes } from 'crypto'
import { spawnSync as _openSpawn } from 'child_process'
import { listAccounts, getActiveAccount } from './accounts.js'
import { getSessions, getSessionStats } from './sessions.js'
import { loadSyncConfig } from './checkpoint.js'
import { debug } from './debug.js'

const DEFAULT_PORT = 7837

// ── HTML dashboard (self-contained, no framework) ─────────────────────────────

function buildHTML(token) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CCM Dashboard</title>
<style>
  :root { --bg:#0d0d0d; --bg2:#141414; --bg3:#1c1c1c; --border:#2a2a2a;
    --text:#e8e6df; --text2:#9a9890; --text3:#5a5856;
    --accent:#00d4a0; --accent2:#007a5c; --yellow:#e8b84b; --red:#e05c5c; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text);
    font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px;
    padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { color: var(--accent); font-size: 18px; margin-bottom: 4px; }
  .sub { color: var(--text3); font-size: 11px; margin-bottom: 24px; }
  .section { margin-bottom: 24px; }
  .section-title { color: var(--text3); font-size: 11px; text-transform: uppercase;
    letter-spacing: 1px; margin-bottom: 10px; }
  .card { background: var(--bg2); border: 1px solid var(--border);
    border-radius: 8px; padding: 14px 18px; margin-bottom: 8px; }
  .row { display: flex; align-items: center; gap: 12px; }
  .name { font-weight: 700; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 99px; }
  .badge.active { background: #0d2010; color: var(--accent); border: 1px solid var(--accent2); }
  .badge.api { background: #0a2a20; color: var(--accent); border: 1px solid var(--accent2); }
  .badge.email { background: #1a1030; color: #a78bfa; border: 1px solid #6040b0; }
  .badge.disabled { background: #2a0e0e; color: var(--red); border: 1px solid #5a2020; }
  .dim { color: var(--text3); font-size: 11px; }
  .stat { display: inline-block; background: var(--bg3); border: 1px solid var(--border);
    border-radius: 6px; padding: 10px 16px; margin-right: 10px; }
  .stat-val { color: var(--accent); font-size: 18px; font-weight: 700; }
  .stat-lbl { color: var(--text3); font-size: 11px; }
  .session { display: grid; grid-template-columns: 1fr auto auto auto; gap: 12px;
    align-items: center; }
  .reason-normal { color: #6bde6b; }
  .reason-credit { color: var(--yellow); }
  .reason-error  { color: var(--red); }
  #status { position: fixed; top: 12px; right: 16px; font-size: 11px;
    color: var(--text3); }
  #status.live { color: var(--accent); }
</style>
</head>
<body>
<div id="status">connecting...</div>
<h1>CCM</h1>
<div class="sub">Claude Code Manager · read-only dashboard</div>

<div class="section">
  <div class="section-title">stats</div>
  <div id="stats"></div>
</div>

<div class="section">
  <div class="section-title">accounts</div>
  <div id="accounts"></div>
</div>

<div class="section">
  <div class="section-title">recent sessions</div>
  <div id="sessions"></div>
</div>

<script>
const TOKEN = '${token}'

function reasonClass(r) {
  if (!r) return ''
  if (r === 'normal') return 'reason-normal'
  if (r.startsWith('credit')) return 'reason-credit'
  return 'reason-error'
}

function fmtDur(sec) {
  if (!sec) return '—'
  return sec < 60 ? sec + 's' : Math.floor(sec/60) + 'm'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function render(data) {
  // Stats
  const st = data.stats
  document.getElementById('stats').innerHTML = st ? \`
    <span class="stat"><div class="stat-val">\${st.total}</div><div class="stat-lbl">sessions</div></span>
    <span class="stat"><div class="stat-val">\${fmtDur(st.totalSec)}</div><div class="stat-lbl">total time</div></span>
    <span class="stat"><div class="stat-val">\${st.switches}</div><div class="stat-lbl">switches</div></span>
  \` : ''

  // Accounts
  document.getElementById('accounts').innerHTML = (data.accounts || []).map(a => \`
    <div class="card">
      <div class="row">
        <span style="color:\${a.active ? 'var(--accent)' : a.disabled ? 'var(--red)' : 'var(--text3)'}">
          \${a.active ? '●' : a.disabled ? '✗' : '○'}
        </span>
        <span class="name">\${a.name}</span>
        <span class="badge \${a.type === 'api_key' ? 'api' : 'email'}">\${a.type === 'api_key' ? 'api key' : 'email'}</span>
        \${a.active ? '<span class="badge active">active</span>' : ''}
        \${a.disabled ? '<span class="badge disabled">disabled</span>' : ''}
        \${a.notes ? '<span class="dim">· ' + a.notes + '</span>' : ''}
      </div>
    </div>
  \`).join('')

  // Sessions
  document.getElementById('sessions').innerHTML = (data.sessions || []).slice(0, 15).map(s => \`
    <div class="card session">
      <span class="name">\${s.account}\${s.projectName ? ' <span class="dim">· ' + s.projectName + '</span>' : ''}</span>
      <span class="dim">\${fmtDate(s.startedAt)}</span>
      <span class="dim">\${fmtDur(s.durationSec)}</span>
      <span class="\${reasonClass(s.exitReason)}">\${(s.exitReason || '—').replace(/_/g,' ')}</span>
    </div>
  \`).join('')
}

// SSE for live updates
function connect() {
  const src = new EventSource('/stream?token=' + TOKEN)
  src.onmessage = e => {
    try {
      render(JSON.parse(e.data))
      document.getElementById('status').textContent = 'live'
      document.getElementById('status').className = 'live'
    } catch {}
  }
  src.onerror = () => {
    document.getElementById('status').textContent = 'reconnecting...'
    document.getElementById('status').className = ''
    src.close()
    setTimeout(connect, 3000)
  }
}
connect()
</script>
</body>
</html>`
}

// ── Data snapshot ──────────────────────────────────────────────────────────────

function getSnapshot() {
  const accounts = listAccounts().map(a => ({
    name: a.name,
    type: a.type,
    active: a.active,
    disabled: a.disabled,
    notes: a.notes,
    email: a.type === 'email' ? a.email : undefined,
  }))
  return {
    accounts,
    sessions: getSessions({ limit: 50 }),
    stats: getSessionStats(),
    ts: Date.now(),
  }
}

// ── Server ────────────────────────────────────────────────────────────────────

/**
 * Start the CCM web dashboard server.
 * @param {object} [opts]
 * @param {number}  [opts.port]   - Port to listen on (default 7837)
 * @param {boolean} [opts.open]   - Open in default browser on start
 * @returns {object} { port, token, close }
 */
export function startServer({ port = DEFAULT_PORT, open: shouldOpen = false } = {}) {
  const token = randomBytes(16).toString('hex')
  const clients = new Set() // active SSE connections

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)

    // Auth check — every route except health requires the token
    const tok = url.searchParams.get('token')
    if (url.pathname !== '/health' && tok !== token) {
      res.writeHead(401, { 'Content-Type': 'text/plain' })
      res.end('401 Unauthorized\n\nAdd ?token=<token> to the URL.')
      return
    }

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(buildHTML(token))
      return
    }

    if (url.pathname === '/data') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(getSnapshot()))
      return
    }

    if (url.pathname === '/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })

      // Send initial snapshot immediately
      res.write(`data: ${JSON.stringify(getSnapshot())}\n\n`)
      clients.add(res)

      req.on('close', () => clients.delete(res))
      return
    }

    res.writeHead(404)
    res.end('Not found')
  })

  // Push updates to all SSE clients every 5 seconds
  const interval = setInterval(() => {
    if (clients.size === 0) return
    const payload = `data: ${JSON.stringify(getSnapshot())}\n\n`
    for (const client of clients) {
      try {
        client.write(payload)
      } catch {
        clients.delete(client)
      }
    }
  }, 5000)

  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}/?token=${token}`
    process.stderr.write(`[ccm] Dashboard: ${url}\n`)
    if (shouldOpen) {
      // Use spawnSync with explicit args — no shell, no injection risk
      try {
        const [bin, ...args] =
          process.platform === 'win32'
            ? ['cmd', '/c', 'start', '', url]
            : process.platform === 'darwin'
              ? ['open', url]
              : ['xdg-open', url]
        _openSpawn(bin, args, { detached: true, stdio: 'ignore' })
      } catch {
        /* browser open is best-effort */
      }
    }
  })

  return {
    port,
    token,
    close: () => {
      clearInterval(interval)
      server.close()
    },
  }
}
