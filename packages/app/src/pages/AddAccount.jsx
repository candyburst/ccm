import React, { useState } from 'react'

const STEPS = { TYPE: 'type', FORM: 'form', VALIDATING: 'validating', DONE: 'done' }

export default function AddAccount({ onDone }) {
  const [step,    setStep]    = useState(STEPS.TYPE)
  const [type,    setType]    = useState('')
  const [form,    setForm]    = useState({ name: '', key: '', email: '', notes: '' })
  const [error,   setError]   = useState('')
  const [busy,    setBusy]    = useState(false)

  function field(label, key, opts = {}) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ color: 'var(--text2)', fontSize: 12 }}>{label}</label>
        <input
          type={opts.password ? 'password' : 'text'}
          placeholder={opts.placeholder || ''}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          autoFocus={opts.focus}
          disabled={busy}
        />
      </div>
    )
  }

  async function submit() {
    setError('')

    // Client-side pre-checks before hitting the network
    if (!form.name.trim()) return setError('Account name is required')
    if (type === 'api_key' && !form.key.trim()) return setError('API key is required')
    if (type === 'api_key' && !form.key.startsWith('sk-')) return setError('API key should start with sk-')
    if (type === 'email'   && !form.email.includes('@'))   return setError('Enter a valid email address')

    setBusy(true)

    if (type === 'api_key') {
      // Show validating state while we ping Anthropic
      setStep(STEPS.VALIDATING)
    }

    try {
      if (type === 'api_key') {
        const res = await window.ccm.accounts.addApiKey({
          name: form.name.trim(), apiKey: form.key.trim(), notes: form.notes,
        })
        if (!res.ok) throw new Error(res.error)
      } else {
        const res = await window.ccm.accounts.addEmail({
          name: form.name.trim(), email: form.email.trim(), notes: form.notes,
        })
        if (!res.ok) throw new Error(res.error)
      }
      setStep(STEPS.DONE)
    } catch (e) {
      setError(e.message)
      setStep(STEPS.FORM)
    } finally {
      setBusy(false)
    }
  }

  async function handleLogin() {
    setBusy(true)
    const res = await window.ccm.accounts.loginEmail(form.name.trim())
    setBusy(false)
    if (res && !res.ok) setError(res.error)
    else onDone()
  }

  // ── Type selection ──────────────────────────────────────────────────────────

  if (step === STEPS.TYPE) return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Add account</h1>
      <div style={{ color: 'var(--text2)', marginBottom: 12 }}>Choose authentication method:</div>
      {[
        { value: 'api_key', label: 'API key',     desc: 'Paste an Anthropic API key from console.anthropic.com' },
        { value: 'email',   label: 'Email login', desc: 'Authenticate via browser — works with Claude Max / Pro subscriptions' },
      ].map(t => (
        <button
          key={t.value}
          className="ghost"
          style={{ textAlign: 'left', padding: '14px 16px', lineHeight: 1.6, width: '100%', marginBottom: 10 }}
          onClick={() => { setType(t.value); setStep(STEPS.FORM) }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{t.label}</div>
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t.desc}</div>
        </button>
      ))}
    </div>
  )

  // ── Validating ──────────────────────────────────────────────────────────────

  if (step === STEPS.VALIDATING) return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Add account</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--text2)' }}>
        <div style={{ color: 'var(--accent)' }}>⠋ Validating API key...</div>
        <div style={{ fontSize: 12 }}>Checking with Anthropic — this takes a moment</div>
      </div>
    </div>
  )

  // ── Form ────────────────────────────────────────────────────────────────────

  if (step === STEPS.FORM) return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
        Add account — {type === 'api_key' ? 'API key' : 'email login'}
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {field('Account name', 'name', { focus: true, placeholder: 'e.g. personal, work, backup' })}
        {type === 'api_key' && field('Anthropic API key', 'key', { password: true, placeholder: 'sk-ant-...' })}
        {type === 'email'   && field('Email address', 'email', { placeholder: 'you@example.com' })}
        {field('Notes (optional)', 'notes', { placeholder: 'e.g. personal plan, 50k tokens/day' })}

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 6 }}>
            ✗ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="ghost" onClick={() => setStep(STEPS.TYPE)} disabled={busy}>← back</button>
          <button className="primary" onClick={submit} disabled={busy}>
            {busy ? 'validating...' : 'add account'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Done ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Add account</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: 'var(--accent)', fontSize: 15 }}>
          ✓ Account "<strong>{form.name}</strong>" added.
        </div>

        {type === 'email' && (
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ color: 'var(--yellow)', marginBottom: 6 }}>Authentication required</div>
            <div style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 12 }}>
              Log in via browser so Claude Code can store a session token for <strong>{form.email}</strong>.
            </div>
            <button className="primary" disabled={busy} onClick={handleLogin}>
              {busy ? 'opening browser...' : 'open browser to log in'}
            </button>
            {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>✗ {error}</div>}
          </div>
        )}

        <button className="ghost" style={{ alignSelf: 'flex-start' }} onClick={onDone}>
          go to dashboard
        </button>
      </div>
    </div>
  )
}
