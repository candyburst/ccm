import React, { useEffect, useState } from 'react'

const NAV = [
  { key: 'dashboard', icon: '◈', label: 'Dashboard' },
  { key: 'run', icon: '▶', label: 'Run session' },
  { key: 'sync', icon: '⟳', label: 'Sync' },
  { key: 'projects', icon: '⊞', label: 'Projects' },
  { key: 'sessions', icon: '◷', label: 'History' },
  { key: 'settings', icon: '⚙', label: 'Settings' },
]

export default function Sidebar({ page, setPage }) {
  const [active, setActive] = useState(null)

  useEffect(() => {
    window.ccm.accounts
      .getActive()
      .then(setActive)
      .catch(() => {})
  }, [page])

  return (
    <aside
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      }}
    >
      <div style={{ padding: '8px 20px 20px', WebkitAppRegion: 'no-drag' }}>
        <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>
          ccm
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 11 }}>Claude Code Manager</div>
      </div>

      <nav style={{ flex: 1, WebkitAppRegion: 'no-drag' }}>
        {NAV.map(n => (
          <button
            key={n.key}
            onClick={() => setPage(n.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              textAlign: 'left',
              padding: '9px 20px',
              background: page === n.key ? 'var(--bg3)' : 'transparent',
              color: page === n.key ? 'var(--text)' : 'var(--text2)',
              borderRadius: 0,
              borderLeft: page === n.key ? '2px solid var(--accent)' : '2px solid transparent',
              fontSize: 13,
            }}
          >
            <span
              style={{ fontSize: 13, color: page === n.key ? 'var(--accent)' : 'var(--text3)' }}
            >
              {n.icon}
            </span>
            {n.label}
          </button>
        ))}
      </nav>

      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          WebkitAppRegion: 'no-drag',
        }}
      >
        {active ? (
          <div>
            <div style={{ color: 'var(--accent)', fontSize: 11, marginBottom: 2 }}>● active</div>
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{active.name}</div>
            <div style={{ color: 'var(--text3)', fontSize: 11 }}>
              {active.type === 'api_key' ? 'api key' : active.email}
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--yellow)', fontSize: 11 }}>no active account</div>
        )}
        <button
          className="ghost"
          style={{ marginTop: 10, width: '100%', fontSize: 12 }}
          onClick={() => setPage('add-account')}
        >
          + add account
        </button>
      </div>
    </aside>
  )
}
