import React, { useEffect, useState, useCallback } from 'react'

function Toggle({ value, onChange, label, desc }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--bg3)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '14px 18px', cursor: 'pointer', marginBottom: 8,
    }}>
      <div>
        <div style={{ color: 'var(--text)', fontWeight: 600 }}>{label}</div>
        {desc && <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0, marginLeft: 16,
        background: value ? 'var(--accent2)' : 'var(--border2)', transition: 'background 0.2s', position: 'relative',
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, left: value ? 19 : 3, transition: 'left 0.2s',
        }} />
      </div>
    </div>
  )
}

function StatusBadge({ ok, label }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 500,
      background: ok ? '#0d2010' : '#2a0e0e',
      color: ok ? '#6bde6b' : 'var(--red)',
      border: `1px solid ${ok ? '#2d6030' : '#5a2020'}`,
    }}>{label}</span>
  )
}

export default function Sync() {
  const [cfg,        setCfg]       = useState(null)
  const [gitStatus,  setGitStatus] = useState(null)
  const [checkpoints,setCheckpoints] = useState([])
  const [status,     setStatus]    = useState('')
  const [busy,       setBusy]      = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [backupUrl,  setBackupUrl] = useState('')

  const refresh = useCallback(async () => {
    const [c, gs, cp] = await Promise.all([
      window.ccm.sync.loadConfig().catch(() => null),
      window.ccm.sync.gitStatus().catch(() => null),
      window.ccm.sync.listCheckpoints().catch(() => []),
    ])
    setCfg(c)
    setGitStatus(gs)
    setCheckpoints(cp)
    setBackupUrl(c?.github?.backupRepo || '')
  }, [])

  useEffect(() => { refresh() }, [])

  async function save(updates) {
    const next = { ...cfg, ...updates, github: { ...cfg.github, ...(updates.github || {}) } }
    setCfg(next)
    await window.ccm.sync.saveConfig(next)
    setStatus('Saved')
    setTimeout(() => setStatus(''), 1500)
  }

  async function doCheckpoint() {
    setBusy(true); setStatus('')
    const r = await window.ccm.sync.checkpoint()
    setBusy(false)
    setStatus(r.success ? `Checkpoint: ${r.commitHash}` : r.skipped ? 'Skipped: ' + r.reason : 'Failed: ' + r.reason)
    refresh()
  }

  async function testRemote() {
    setBusy(true)
    const r = await window.ccm.sync.testRemote(backupUrl)
    setBusy(false)
    setTestResult(r)
  }

  async function saveBackupRepo() {
    await save({ github: { backupRepo: backupUrl } })
    setTestResult(null)
  }

  function fmtDate(iso) {
    return iso ? new Date(iso).toLocaleString() : '—'
  }

  if (!cfg) return <div style={{ color: 'var(--text3)', padding: '24px 0' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Sync &amp; continuity</h1>

      {/* Git status card */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 18px' }}>
        <div style={{ color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Current project git status</div>
        {gitStatus?.isGitRepo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge ok label={`branch: ${gitStatus.branch}`} />
              {gitStatus.hasRemote ? <StatusBadge ok label="remote connected" /> : <StatusBadge ok={false} label="no remote" />}
              {gitStatus.isDirty ? <StatusBadge ok={false} label={`${gitStatus.changedFiles} uncommitted`} /> : <StatusBadge ok label="clean" />}
              {gitStatus.aheadCount > 0 && <StatusBadge ok={false} label={`${gitStatus.aheadCount} unpushed`} />}
            </div>
            {gitStatus.lastCommit && (
              <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
                Last commit: <code style={{ color: 'var(--text2)' }}>{gitStatus.lastCommit}</code>
              </div>
            )}
            <button
              className="ghost" style={{ fontSize: 12, alignSelf: 'flex-start', marginTop: 6 }}
              onClick={doCheckpoint} disabled={busy}
            >
              {busy ? 'working…' : '⚡ checkpoint now'}
            </button>
          </div>
        ) : (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            Not a git repo — navigate to a git project and run <code style={{ color: 'var(--accent)' }}>ccm project init</code> to enable checkpointing.
          </div>
        )}
        {status && <div style={{ color: 'var(--accent)', fontSize: 12, marginTop: 8 }}>{status}</div>}
      </div>

      {/* Smart resume toggles */}
      <div>
        <div style={{ color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Continuity settings</div>
        <Toggle
          value={cfg.smartResume}
          onChange={v => save({ smartResume: v })}
          label="Smart resume on account switch"
          desc="Transfer Claude's session JSONL to the new account so --resume picks up the conversation exactly where it left off"
        />
        <Toggle
          value={cfg.gitCheckpoint}
          onChange={v => save({ gitCheckpoint: v })}
          label="Git checkpoint before switching"
          desc="Run git add -A && git commit before every account switch so you have a clean rollback point"
        />
      </div>

      {/* GitHub sync */}
      <div>
        <div style={{ color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>GitHub sync</div>
        <Toggle
          value={cfg.github.enabled}
          onChange={v => save({ github: { enabled: v } })}
          label="Enable GitHub sync"
          desc="Push your project repo or session backups to GitHub automatically"
        />
        {cfg.github.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 0 }}>
            <Toggle
              value={cfg.github.projectSync}
              onChange={v => save({ github: { projectSync: v } })}
              label="Push project repo on switch"
              desc="git push to the current project's remote when switching accounts"
            />
            <Toggle
              value={cfg.github.autoPushOnEnd}
              onChange={v => save({ github: { autoPushOnEnd: v } })}
              label="Push on session end"
              desc="Also push when a Claude session ends normally"
            />
            <Toggle
              value={cfg.github.sessionBackup}
              onChange={v => save({ github: { sessionBackup: v } })}
              label="Backup session history to GitHub"
              desc="Push Claude JSONL session files to a separate private backup repo"
            />
            {cfg.github.sessionBackup && (
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ color: 'var(--text2)', fontSize: 12 }}>Backup repo URL (SSH or HTTPS)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="git@github.com:you/ccm-backup.git"
                    value={backupUrl}
                    onChange={e => setBackupUrl(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="ghost" style={{ fontSize: 12 }} onClick={testRemote} disabled={busy || !backupUrl}>test</button>
                  <button className="primary" style={{ fontSize: 12 }} onClick={saveBackupRepo}>save</button>
                </div>
                {testResult && (
                  <div style={{ color: testResult.reachable ? 'var(--accent)' : 'var(--red)', fontSize: 12 }}>
                    {testResult.reachable ? '✓ Remote reachable' : `✗ ${testResult.detail || 'Cannot reach remote'}`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Local checkpoints */}
      <div>
        <div style={{ color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          Local session checkpoints ({checkpoints.length})
        </div>
        {checkpoints.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            No checkpoints yet. They are created automatically on every account switch when Smart Resume is on.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {checkpoints.slice(0, 12).map((cp, i) => (
              <div key={i} style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '10px 14px',
                display: 'grid', gridTemplateColumns: '120px 140px 1fr',
                gap: 12, fontSize: 12, alignItems: 'center',
              }}>
                <span style={{ color: 'var(--accent)' }}>{cp.account}</span>
                <span style={{ color: 'var(--text3)' }}>{fmtDate(cp.savedAt)}</span>
                <span style={{ color: 'var(--text2)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cp.projectRoot || '—'}
                </span>
              </div>
            ))}
            {checkpoints.length > 12 && (
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>+{checkpoints.length - 12} more</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
