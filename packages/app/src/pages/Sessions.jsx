import React, { useEffect, useState } from 'react'

function fmtDuration(sec) {
  if (!sec && sec !== 0) return '—'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const REASON_STYLE = {
  normal:                 { color: '#6bde6b' },
  credit_limit:           { color: 'var(--yellow)' },
  credit_limit_exhausted: { color: 'var(--red)' },
  error:                  { color: 'var(--red)' },
  spawn_error:            { color: 'var(--red)' },
  interrupted:            { color: 'var(--text3)' },
  running:                { color: 'var(--blue)' },
}

const EXIT_REASONS = ['all', 'normal', 'credit_limit', 'credit_limit_exhausted', 'error', 'interrupted']

export default function Sessions() {
  const [sessions,  setSessions]  = useState([])
  const [stats,     setStats]     = useState(null)
  const [accounts,  setAccounts]  = useState([])
  const [filterAcct, setFilterAcct] = useState('all')
  const [filterReason, setFilterReason] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')

  async function refresh() {
    const opts = { limit: 200 }
    if (filterAcct !== 'all')    opts.account    = filterAcct
    if (filterReason !== 'all')  opts.exitReason = filterReason
    if (filterFrom)              opts.from       = filterFrom
    if (filterTo)                opts.to         = filterTo + 'T23:59:59'

    const [s, st, a] = await Promise.all([
      window.ccm.sessions.list(opts).then(r => r?.data ?? r ?? []).catch(() => []),
      window.ccm.sessions.stats().then(r => r?.data ?? r).catch(() => null),
      window.ccm.accounts.list().then(r => r?.data ?? r ?? []).catch(() => []),
    ])
    setSessions(s)
    setStats(st)
    setAccounts(a)
  }

  useEffect(() => { refresh() }, [filterAcct, filterReason, filterFrom, filterTo])

  async function clearAll() {
    if (!confirm('Clear all session history? This cannot be undone.')) return
    await window.ccm.sessions.clear()
    refresh()
  }

  const sel = { fontSize: 12, background: 'var(--bg3)', color: 'var(--text)',
    border: '1px solid var(--border2)', borderRadius: 4, padding: '4px 8px',
    fontFamily: 'var(--font)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Sessions</h1>
        <button className="danger" style={{ fontSize: 12 }} onClick={clearAll}>clear history</button>
      </div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: 'total sessions',  value: stats.total },
            { label: 'total time',      value: fmtDuration(stats.totalSec) },
            { label: 'auto-switches',   value: stats.switches },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '12px 18px', flex: 1 }}>
              <div style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 700 }}>{s.value}</div>
              <div style={{ color: 'var(--text3)', fontSize: 11 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>Filter:</span>

        <select style={sel} value={filterAcct} onChange={e => setFilterAcct(e.target.value)}>
          <option value="all">all accounts</option>
          {accounts.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
        </select>

        <select style={sel} value={filterReason} onChange={e => setFilterReason(e.target.value)}>
          {EXIT_REASONS.map(r => (
            <option key={r} value={r}>{r === 'all' ? 'all reasons' : r.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <input type="date" style={{ ...sel, cursor: 'pointer' }}
          value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
          title="From date" />
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>→</span>
        <input type="date" style={{ ...sel, cursor: 'pointer' }}
          value={filterTo} onChange={e => setFilterTo(e.target.value)}
          title="To date" />

        {(filterAcct !== 'all' || filterReason !== 'all' || filterFrom || filterTo) && (
          <button className="ghost" style={{ fontSize: 11 }} onClick={() => {
            setFilterAcct('all'); setFilterReason('all')
            setFilterFrom(''); setFilterTo('')
          }}>✕ clear filters</button>
        )}
      </div>

      {/* Session list */}
      {sessions.length === 0 && (
        <div style={{ color: 'var(--text3)', padding: '24px 0' }}>No sessions match the current filters.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sessions.map(s => (
          <div key={s.id} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto auto',
            gap: '0 16px', alignItems: 'center',
          }}>
            <div>
              <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{s.account}</span>
              {s.projectName && (
                <span style={{ color: 'var(--text3)', fontSize: 11, marginLeft: 8 }}>· {s.projectName}</span>
              )}
            </div>
            <span style={{ color: 'var(--text3)', fontSize: 11 }}>{fmtDate(s.startedAt)}</span>
            <span style={{ color: 'var(--text2)', fontSize: 12 }}>{fmtDuration(s.durationSec)}</span>
            {s.tokens && (
              <span style={{ color: 'var(--text3)', fontSize: 11 }}>
                {((s.tokens.input + s.tokens.output) / 1000).toFixed(1)}k tok
              </span>
            )}
            <span style={{ fontSize: 11, ...REASON_STYLE[s.exitReason] }}>
              {s.exitReason?.replace(/_/g, ' ') ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
