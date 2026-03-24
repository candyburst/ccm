import React, { useEffect, useState } from 'react'

function AccountCard({ account, isActive, onSetActive, onLogin, onToggleDisable, onRemove }) {
  const typeLabel = account.type === 'api_key' ? 'api key' : 'email'
  const detail = account.type === 'api_key' ? 'sk-···' : account.email
  const isDisabled = account.disabled

  return (
    <div
      style={{
        background: 'var(--bg3)',
        border: `1px solid ${isActive ? 'var(--accent2)' : isDisabled ? '#3a2020' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            color: isActive ? 'var(--accent)' : isDisabled ? 'var(--red)' : 'var(--text3)',
            fontSize: 16,
          }}
        >
          {isActive ? '●' : isDisabled ? '✗' : '○'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{account.name}</div>
          <div style={{ color: 'var(--text3)', fontSize: 11 }}>{detail}</div>
        </div>
        <span className={`badge ${account.type === 'api_key' ? 'api-key' : 'email'}`}>
          {typeLabel}
        </span>
        {isActive && <span className="badge active">active</span>}
        {isDisabled && <span className="badge error">disabled</span>}
      </div>

      {account.notes && (
        <div style={{ color: 'var(--text2)', fontSize: 12, paddingLeft: 26 }}>{account.notes}</div>
      )}

      <div style={{ display: 'flex', gap: 8, paddingLeft: 26 }}>
        {!isActive && !isDisabled && (
          <button
            className="primary"
            style={{ fontSize: 12 }}
            onClick={() => onSetActive(account.name)}
          >
            set active
          </button>
        )}
        {account.type === 'email' && !isDisabled && (
          <button className="ghost" style={{ fontSize: 12 }} onClick={() => onLogin(account.name)}>
            re-login
          </button>
        )}
        <button
          className="ghost"
          style={{ fontSize: 12 }}
          onClick={() => onToggleDisable(account.name, !isDisabled)}
        >
          {isDisabled ? 'enable' : 'disable'}
        </button>
        <button className="danger" style={{ fontSize: 12 }} onClick={() => onRemove(account.name)}>
          remove
        </button>
      </div>
    </div>
  )
}

export default function Dashboard({ onAdd }) {
  const [accounts, setAccounts] = useState([])
  const [stats, setStats] = useState(null)
  const [status, setStatus] = useState('')

  async function refresh() {
    try {
      const raw = await window.ccm.accounts.list()
      const list = raw?.data ?? raw ?? []
      setAccounts(list)
      const statsRaw = await window.ccm.sessions.stats()
      const s = statsRaw?.data ?? statsRaw
      setStats(s)
    } catch (e) {
      setStatus('✗ ' + e.message)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function setActive(name) {
    try {
      await window.ccm.accounts.setActive(name)
      setStatus(`Active account set to "${name}"`)
      refresh()
    } catch (e) {
      setStatus('✗ ' + e.message)
    }
  }

  async function login(name) {
    setStatus(`Opening browser login for "${name}"...`)
    await window.ccm.accounts.loginEmail(name)
    setStatus(`Login complete for "${name}"`)
  }

  async function toggleDisable(name, disabled) {
    const res = await window.ccm.accounts.update(name, { disabled })
    if (res && !res.ok) {
      setStatus(`✗ ${res.error}`)
      return
    }
    setStatus(disabled ? `"${name}" disabled` : `"${name}" enabled`)
    refresh()
  }

  async function remove(name) {
    if (!confirm(`Remove account "${name}"?`)) return
    const res = await window.ccm.accounts.remove(name)
    if (res && !res.ok) {
      setStatus(`✗ ${res.error}`)
      return
    }
    setStatus(`Removed "${name}"`)
    refresh()
  }

  const active = accounts.find(a => a.active)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700 }}>Dashboard</h1>
        <button className="primary" onClick={onAdd}>
          + add account
        </button>
      </div>

      {stats && stats.total > 0 && (
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { label: 'sessions', value: stats.total },
            { label: 'total time', value: `${Math.round(stats.totalSec / 60)}m` },
            { label: 'auto-switches', value: stats.switches },
          ].map(s => (
            <div
              key={s.label}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '14px 20px',
                flex: 1,
              }}
            >
              <div style={{ color: 'var(--accent)', fontSize: 22, fontWeight: 700 }}>{s.value}</div>
              <div style={{ color: 'var(--text3)', fontSize: 11 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {status && (
        <div
          style={{
            color: 'var(--accent)',
            background: 'var(--bg3)',
            border: '1px solid var(--accent2)',
            borderRadius: 6,
            padding: '8px 14px',
            fontSize: 12,
          }}
        >
          {status}
        </div>
      )}

      <div>
        <div
          style={{
            color: 'var(--text2)',
            fontSize: 11,
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          accounts ({accounts.length})
        </div>
        {accounts.length === 0 ? (
          <div style={{ color: 'var(--text3)', padding: '24px 0' }}>
            No accounts yet.{' '}
            <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={onAdd}>
              Add one →
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 12,
            }}
          >
            {accounts.map(a => (
              <AccountCard
                key={a.name}
                account={a}
                isActive={a.active}
                onSetActive={setActive}
                onLogin={login}
                onToggleDisable={toggleDisable}
                onRemove={remove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
