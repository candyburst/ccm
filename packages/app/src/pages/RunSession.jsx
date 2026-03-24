import React, { useEffect, useRef, useState, useCallback } from 'react'

const LINE_TYPES = {
  stdout: { color: '#e8e6df' },
  stderr: { color: '#9a9890' },
  'credit-error': { color: '#e8b84b' },
  info: { color: '#00d4a0' },
  error: { color: '#e05c5c' },
}

function TermLine({ line }) {
  const style = LINE_TYPES[line.type] || LINE_TYPES.stdout
  return (
    <div
      style={{
        color: style.color,
        fontFamily: 'inherit',
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {line.text}
    </div>
  )
}

export default function RunSession() {
  const [accounts, setAccounts] = useState([])
  const [accountName, setAccountName] = useState('')
  const [claudeArgs, setClaudeArgs] = useState('')
  const [status, setStatus] = useState('idle') // idle | running | stopped | error
  const [sessionId, setSessionId] = useState(null)
  const [lines, setLines] = useState([])
  const [creditWarn, setCreditWarn] = useState(null)

  const bottomRef = useRef(null)
  const offRef = useRef(null)

  function addLine(type, text) {
    setLines(ls => [...ls, { type, text, id: Math.random() }])
  }

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  useEffect(() => {
    window.ccm.accounts.list().then(list => {
      setAccounts(list)
      const active = list.find(a => a.active)
      if (active) setAccountName(active.name)
    })

    // Subscribe to runner events
    const off = window.ccm.runner.onEvent(({ sessionId: sid, type, data }) => {
      if (type === 'started') {
        addLine(
          'info',
          `[ccm] Session started · account: ${data.accountName}${data.projectName ? ` · project: ${data.projectName}` : ''}`
        )
      } else if (type === 'stdout') {
        addLine('stdout', data)
      } else if (type === 'stderr') {
        addLine('stderr', data)
      } else if (type === 'credit-error') {
        setCreditWarn(data.from)
        addLine(
          'credit-error',
          `\n[ccm] Credit limit detected on "${data.from}" — auto-switching if another account is available\n`
        )
      } else if (type === 'closed') {
        setStatus('stopped')
        setSessionId(null)
        addLine('info', `\n[ccm] Session ended · exit code ${data.code}`)
      } else if (type === 'error') {
        setStatus('error')
        addLine('error', `[ccm] Error: ${data.message}`)
      }
    })
    offRef.current = off
    return () => off?.()
  }, [])

  async function start() {
    if (!accountName) return
    setLines([])
    setCreditWarn(null)
    setStatus('running')
    const args = claudeArgs.trim() ? claudeArgs.trim().split(/\s+/) : []
    const result = await window.ccm.runner.start({ accountName, claudeArgs: args })
    if (result?.error) {
      addLine('error', `[ccm] ${result.error}`)
      setStatus('error')
      return
    }
    setSessionId(result.sessionId)
  }

  async function stop() {
    if (sessionId) await window.ccm.runner.stop(sessionId)
    setStatus('stopped')
    setSessionId(null)
    addLine('info', '\n[ccm] Session terminated by user')
  }

  function clearLog() {
    setLines([])
    setCreditWarn(null)
  }

  const isRunning = status === 'running'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Controls bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Run session</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {isRunning ? (
            <button className="danger" onClick={stop}>
              ■ stop
            </button>
          ) : (
            <button className="primary" onClick={start} disabled={!accountName}>
              ▶ start
            </button>
          )}
          <button className="ghost" onClick={clearLog} disabled={isRunning}>
            clear
          </button>
        </div>
      </div>

      {/* Config row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <label style={{ color: 'var(--text3)', fontSize: 11 }}>account</label>
          <select
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            disabled={isRunning}
          >
            <option value="">— select —</option>
            {accounts.map(a => (
              <option key={a.name} value={a.name}>
                {a.name} ({a.type === 'api_key' ? 'api' : a.email})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <label style={{ color: 'var(--text3)', fontSize: 11 }}>extra flags (optional)</label>
          <input
            type="text"
            placeholder="e.g. --model claude-opus-4-5 --dangerously-skip-permissions"
            value={claudeArgs}
            onChange={e => setClaudeArgs(e.target.value)}
            disabled={isRunning}
            onKeyDown={e => {
              if (e.key === 'Enter' && !isRunning && accountName) start()
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <label style={{ color: 'var(--text3)', fontSize: 11 }}>status</label>
          <div
            style={{
              padding: '7px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              color: {
                idle: 'var(--text3)',
                running: 'var(--accent)',
                stopped: 'var(--text2)',
                error: 'var(--red)',
              }[status],
            }}
          >
            {isRunning ? '● running' : status}
          </div>
        </div>
      </div>

      {/* Credit warning banner */}
      {creditWarn && (
        <div
          style={{
            background: '#2a1e00',
            border: '1px solid #5a4010',
            borderRadius: 6,
            padding: '10px 14px',
            color: 'var(--yellow)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            ⚠ Credit limit hit on "<strong>{creditWarn}</strong>" — switching to next account
            automatically
          </span>
          <button className="ghost" style={{ fontSize: 11 }} onClick={() => setCreditWarn(null)}>
            dismiss
          </button>
        </div>
      )}

      {/* Terminal output */}
      <div
        style={{
          flex: 1,
          background: '#0a0a0a',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '14px 16px',
          overflowY: 'auto',
          fontFamily: 'var(--font)',
          minHeight: 300,
          position: 'relative',
        }}
      >
        {lines.length === 0 && (
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>
            {isRunning
              ? 'Waiting for output…'
              : 'Select an account and press ▶ start to launch Claude Code.'}
          </div>
        )}
        {lines.map(l => (
          <TermLine key={l.id} line={l} />
        ))}
        {isRunning && (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 13,
              background: 'var(--accent)',
              marginLeft: 1,
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}
        <div ref={bottomRef} />
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}
