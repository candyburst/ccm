// First-run onboarding wizard for the Electron app.
// Shown full-screen when no accounts exist. Replaces the Dashboard entirely.
// Flow: welcome → auth type → account name → credential → notes → (validation) → project init → done

import React, { useState } from 'react'

const STEPS = {
  WELCOME:    'welcome',
  TYPE:       'type',
  NAME:       'name',
  CREDENTIAL: 'credential',
  NOTES:      'notes',
  VALIDATING: 'validating',
  PROJECT:    'project',
  DONE:       'done',
}

const STEP_LABELS = {
  [STEPS.TYPE]:       { n: 1, label: 'Choose auth method' },
  [STEPS.NAME]:       { n: 2, label: 'Name your account' },
  [STEPS.CREDENTIAL]: { n: 3, label: 'Enter credentials' },
  [STEPS.NOTES]:      { n: 4, label: 'Add notes (optional)' },
  [STEPS.PROJECT]:    { n: 5, label: 'Bind a project' },
}

function StepIndicator({ current }) {
  const steps = [STEPS.TYPE, STEPS.NAME, STEPS.CREDENTIAL, STEPS.NOTES, STEPS.PROJECT]
  const currentIdx = steps.indexOf(current)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const done    = i < currentIdx
        const active  = i === currentIdx
        const future  = i > currentIdx
        return (
          <React.Fragment key={s}>
            <div style={{
              width: 28, height: 28,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              background: done ? 'var(--accent2)' : active ? 'var(--bg3)' : 'transparent',
              color: done ? 'var(--accent)' : active ? 'var(--text)' : 'var(--text3)',
              border: `1px solid ${done ? 'var(--accent2)' : active ? 'var(--accent)' : 'var(--border)'}`,
            }}>
              {done ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 1,
                background: done ? 'var(--accent2)' : 'var(--border)',
              }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default function Onboard({ onComplete }) {
  const [step,    setStep]    = useState(STEPS.WELCOME)
  const [cwd,     setCwd]     = useState('current directory')
  const [type,    setType]    = useState('')
  const [form,    setForm]    = useState({ name: '', key: '', email: '', notes: '' })
  const [error,   setError]   = useState('')
  const [busy,    setBusy]    = useState(false)
  const [bound,   setBound]   = useState(false)

  // Load real cwd from main process
  React.useEffect(() => {
    window.ccm.shell.getCwd().then(r => { if (r?.data) setCwd(r.data) }).catch(() => {})
  }, [])

  function field(label, key, opts = {}) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ color: 'var(--text2)', fontSize: 12 }}>{label}</label>
        <input
          type={opts.password ? 'password' : 'text'}
          placeholder={opts.placeholder || ''}
          value={form[key]}
          onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setError('') }}
          autoFocus={opts.focus}
          disabled={busy}
          onKeyDown={e => e.key === 'Enter' && opts.onEnter?.()}
          style={{ fontSize: 13 }}
        />
      </div>
    )
  }

  async function saveName() {
    if (!form.name.trim()) return setError('Account name is required')
    if (/[^a-zA-Z0-9_-]/.test(form.name.trim())) return setError('Name can only contain letters, numbers, - and _')
    setError('')
    setStep(STEPS.CREDENTIAL)
  }

  async function saveCredential() {
    if (type === 'api_key') {
      if (!form.key.trim()) return setError('API key is required')
      if (!form.key.startsWith('sk-')) return setError('API key should start with sk-')
    } else {
      if (!form.email.trim()) return setError('Email is required')
      if (!form.email.includes('@')) return setError('Enter a valid email address')
    }
    setError('')
    setStep(STEPS.NOTES)
  }

  async function saveAccount() {
    setBusy(true)
    setStep(STEPS.VALIDATING)
    try {
      if (type === 'api_key') {
        const res = await window.ccm.accounts.addApiKey({
          name: form.name.trim(), apiKey: form.key.trim(), notes: form.notes.trim(),
        })
        if (!res.ok) throw new Error(res.error)
      } else {
        const res = await window.ccm.accounts.addEmail({
          name: form.name.trim(), email: form.email.trim(), notes: form.notes.trim(),
        })
        if (!res.ok) throw new Error(res.error)
      }
      await window.ccm.accounts.setActive(form.name.trim())
      setStep(STEPS.PROJECT)
    } catch (e) {
      setError(e.message)
      setStep(STEPS.NOTES)
    } finally {
      setBusy(false)
    }
  }

  async function handleProjectChoice(shouldBind) {
    if (shouldBind) {
      try {
        const res = await window.ccm.projects.init(undefined, form.name.trim(), '')
        if (res?.ok !== false) setBound(true)
      } catch { /* skip — project binding is optional */ }
    }
    setStep(STEPS.DONE)
  }

  // ── Welcome ──────────────────────────────────────────────────────────────────

  if (step === STEPS.WELCOME) return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 22, marginBottom: 4 }}>CCM</div>
        <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 32 }}>Claude Code Manager</div>

        <h1 style={styles.h1}>Welcome</h1>
        <p style={styles.desc}>
          No accounts configured yet. This wizard takes about 60 seconds.
        </p>
        <p style={{ ...styles.desc, color: 'var(--text3)', marginTop: 8 }}>
          Add an account, set it active, and optionally bind your current directory as a project.
        </p>

        <button className="primary" style={{ marginTop: 32, width: '100%', padding: '10px 0', fontSize: 14 }}
          onClick={() => setStep(STEPS.TYPE)}>
          Get started →
        </button>
      </div>
    </div>
  )

  // ── Validating ───────────────────────────────────────────────────────────────

  if (step === STEPS.VALIDATING) return (
    <div style={styles.container}>
      <div style={styles.card}>
        <StepIndicator current={STEPS.NOTES} />
        <div style={{ color: 'var(--accent)', marginBottom: 8 }}>⠋ Validating API key...</div>
        <div style={{ color: 'var(--text3)', fontSize: 12 }}>Checking with Anthropic — this takes a moment</div>
      </div>
    </div>
  )

  // ── Done ─────────────────────────────────────────────────────────────────────

  if (step === STEPS.DONE) return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
          ✓ Ready
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          <Row icon="✓" text={`Account "${form.name}" added and set as active`} />
          {bound && <Row icon="✓" text="Current directory bound as a project" />}
          {type === 'email' && (
            <Row icon="⚠" color="var(--yellow)"
              text={`Run ccm login ${form.name} in the terminal to complete browser authentication`} />
          )}
        </div>

        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '14px 16px', marginBottom: 24 }}>
          <div style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 8 }}>Next steps</div>
          {type === 'api_key'
            ? <Code>ccm run</Code>
            : <><Code>{`ccm login ${form.name}`}</Code><Code style={{ marginTop: 6 }}>ccm run</Code></>
          }
        </div>

        <button className="primary" style={{ width: '100%', padding: '10px 0', fontSize: 14 }}
          onClick={onComplete}>
          Open dashboard →
        </button>
      </div>
    </div>
  )

  // ── Project init choice ───────────────────────────────────────────────────────

  if (step === STEPS.PROJECT) return (
    <div style={styles.container}>
      <div style={styles.card}>
        <StepIndicator current={STEPS.PROJECT} />
        <h2 style={styles.h2}>Bind a project?</h2>
        <p style={styles.desc}>
          Binding tells CCM which account to use when you run{' '}
          <span style={{ color: 'var(--accent)', fontFamily: 'var(--font)' }}>ccm run</span>{' '}
          in a specific directory.
        </p>

        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6,
          padding: '8px 12px', marginTop: 16, marginBottom: 20, fontSize: 12, color: 'var(--text2)',
          fontFamily: 'var(--font)' }}>
          {cwd}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="ghost" style={{ flex: 1 }} onClick={() => handleProjectChoice(false)}>
            Skip for now
          </button>
          <button className="primary" style={{ flex: 1 }} onClick={() => handleProjectChoice(true)}>
            Bind this directory
          </button>
        </div>
      </div>
    </div>
  )

  // ── Step forms ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <StepIndicator current={step} />

        {step === STEPS.TYPE && (
          <>
            <h2 style={styles.h2}>Choose authentication method</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              {[
                { value: 'api_key', label: 'API key',
                  desc: 'Paste a key from console.anthropic.com/settings/keys' },
                { value: 'email', label: 'Email login',
                  desc: 'Browser-based OAuth — works with Claude Max / Pro subscriptions' },
              ].map(t => (
                <button key={t.value} className="ghost"
                  style={{ textAlign: 'left', padding: '14px 16px', lineHeight: 1.6 }}
                  onClick={() => { setType(t.value); setStep(STEPS.NAME) }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>{t.label}</div>
                  <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === STEPS.NAME && (
          <>
            <h2 style={styles.h2}>Name your account</h2>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {field('Account name', 'name', {
                focus: true,
                placeholder: 'e.g. personal, work, backup',
                onEnter: saveName,
              })}
              {error && <ErrMsg msg={error} />}
              <div style={styles.btnRow}>
                <button className="ghost" onClick={() => setStep(STEPS.TYPE)}>← back</button>
                <button className="primary" onClick={saveName} disabled={busy}>Continue →</button>
              </div>
            </div>
          </>
        )}

        {step === STEPS.CREDENTIAL && (
          <>
            <h2 style={styles.h2}>
              {type === 'api_key' ? 'Enter your API key' : 'Enter your email'}
            </h2>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {type === 'api_key'
                ? field('Anthropic API key', 'key', {
                    focus: true, password: true, placeholder: 'sk-ant-...',
                    onEnter: saveCredential,
                  })
                : field('Email address', 'email', {
                    focus: true, placeholder: 'you@example.com',
                    onEnter: saveCredential,
                  })
              }
              {error && <ErrMsg msg={error} />}
              <div style={styles.btnRow}>
                <button className="ghost" onClick={() => setStep(STEPS.NAME)}>← back</button>
                <button className="primary" onClick={saveCredential} disabled={busy}>Continue →</button>
              </div>
            </div>
          </>
        )}

        {step === STEPS.NOTES && (
          <>
            <h2 style={styles.h2}>Add a note (optional)</h2>
            <p style={{ ...styles.desc, marginBottom: 20 }}>
              A short reminder for yourself — plan type, token limit, etc.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {field('Notes', 'notes', {
                focus: true,
                placeholder: 'e.g. personal plan, 100k tokens/day',
                onEnter: saveAccount,
              })}
              {error && <ErrMsg msg={error} />}
              <div style={styles.btnRow}>
                <button className="ghost" onClick={() => setStep(STEPS.CREDENTIAL)}>← back</button>
                <button className="primary" onClick={saveAccount} disabled={busy}>
                  {busy ? 'saving...' : 'Add account →'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function ErrMsg({ msg }) {
  return (
    <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px',
      background: 'var(--bg3)', borderRadius: 6, borderLeft: '3px solid var(--red)' }}>
      ✗ {msg}
    </div>
  )
}

function Row({ icon, text, color }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ color: color || 'var(--accent)', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: 'var(--text2)', fontSize: 13 }}>{text}</span>
    </div>
  )
}

function Code({ children, style }) {
  return (
    <div style={{ fontFamily: 'var(--font)', fontSize: 12, color: 'var(--accent)',
      background: 'var(--bg)', padding: '6px 10px', borderRadius: 4, ...style }}>
      $ {children}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', background: 'var(--bg)',
  },
  card: {
    width: 480, padding: '40px 44px',
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 12,
  },
  h1: { fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 12 },
  h2: { fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 0 },
  desc: { color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 },
  btnRow: { display: 'flex', gap: 10, marginTop: 8 },
}
