import React, { useEffect, useState } from 'react'

const TOGGLES = [
  {
    key: 'autoSwitch',
    label: 'Auto-switch on credit limit',
    desc: 'Rotate to the next account automatically when credits are exhausted',
  },
  {
    key: 'keepSessionLog',
    label: 'Keep session log',
    desc: 'Record each Claude run to ~/.ccm/session-log.json',
  },
  {
    key: 'showNotifications',
    label: 'Desktop notifications',
    desc: 'Show OS notifications for session end, account switches, and checkpoints',
  },
]

function Toggle({ on }) {
  return (
    <div
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: on ? 'var(--accent2)' : 'var(--border2)',
        transition: 'background 0.2s',
        position: 'relative',
        flexShrink: 0,
        marginLeft: 16,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: on ? 19 : 3,
          transition: 'left 0.2s',
        }}
      />
    </div>
  )
}

export default function Settings() {
  const [config, setConfig] = useState({
    autoSwitch: true,
    keepSessionLog: true,
    showNotifications: true,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.ccm.config
      .load()
      .then(r => {
        if (r?.data) setConfig(cfg => ({ ...cfg, ...r.data }))
      })
      .catch(() => {
        /* use defaults */
      })
  }, [])

  async function toggle(key) {
    const updated = { ...config, [key]: !config[key] }
    setConfig(updated)
    await window.ccm.config.save(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Settings</h1>

      {/* Behaviour toggles */}
      <section>
        <div
          style={{
            color: 'var(--text2)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          Behaviour
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TOGGLES.map(t => (
            <div
              key={t.key}
              onClick={() => toggle(t.key)}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div>
                <div style={{ color: 'var(--text)', fontWeight: 600 }}>{t.label}</div>
                <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>{t.desc}</div>
              </div>
              <Toggle on={config[t.key] !== false} />
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section
        style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '16px 18px',
        }}
      >
        <div
          style={{
            color: 'var(--text2)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 10,
          }}
        >
          Security
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            color: 'var(--text2)',
            fontSize: 12,
          }}
        >
          <div>
            API keys are encrypted with <span style={{ color: 'var(--accent)' }}>AES-256-GCM</span>{' '}
            before being stored.
          </div>
          <div>
            The encryption key is machine-specific (~/.ccm/.key). Set a passphrase for portability:
          </div>
          <code
            style={{
              background: 'var(--bg)',
              padding: '6px 10px',
              borderRadius: 4,
              color: 'var(--text)',
              marginTop: 4,
              display: 'block',
            }}
          >
            export CCM_SECRET=your-passphrase
          </code>
          <div style={{ color: 'var(--text3)', marginTop: 4 }}>
            Add to your shell profile (~/.zshrc or ~/.bashrc) to persist. Use the same passphrase
            when importing accounts on a new machine.
          </div>
        </div>
      </section>

      {/* Storage paths */}
      <section
        style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '16px 18px',
        }}
      >
        <div
          style={{
            color: 'var(--text2)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 10,
          }}
        >
          Storage paths
        </div>
        {[
          ['Config dir', '~/.ccm/'],
          ['Accounts', '~/.ccm/accounts.json'],
          ['Machine key', '~/.ccm/.key'],
          ['Sessions', '~/.ccm/sessions/'],
          ['Session log', '~/.ccm/session-log.json'],
          ['Checkpoints', '~/.ccm/checkpoints/'],
          ['Project file', '.ccm-project.json  (per project)'],
        ].map(([label, p]) => (
          <div key={label} style={{ display: 'flex', gap: 16, marginBottom: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--text3)', minWidth: 110 }}>{label}</span>
            <code style={{ color: 'var(--text2)', fontFamily: 'var(--font)' }}>{p}</code>
          </div>
        ))}
      </section>

      {saved && <div style={{ color: 'var(--accent)', fontSize: 13 }}>✓ Settings saved</div>}
    </div>
  )
}
