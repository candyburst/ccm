import React, { useEffect, useState } from 'react'

export default function Projects() {
  const [projects,   setProjects]   = useState([])
  const [accounts,   setAccounts]   = useState([])
  const [scanRoots,  setScanRoots]  = useState([])
  const [binding,    setBinding]    = useState(null)
  const [status,     setStatus]     = useState('')
  const [showRoots,  setShowRoots]  = useState(false)
  const [gitignorePrompt, setGitignorePrompt] = useState(null) // { projectDir }

  async function refresh() {
    const [p, a, roots] = await Promise.all([
      window.ccm.projects.scan().then(r => r?.data ?? r ?? []),
      window.ccm.accounts.list().then(r => r?.data ?? r ?? []),
      window.ccm.projects.getScanRoots().then(r => r?.data ?? r ?? []),
    ])
    setProjects(p)
    setAccounts(a)
    setScanRoots(roots)
  }

  useEffect(() => { refresh() }, [])

  async function bind(projectRoot, accountName) {
    await window.ccm.projects.bind(projectRoot, accountName)
    setStatus(`Bound "${projectRoot.split('/').pop()}" to "${accountName}"`)
    setBinding(null)
    refresh()
  }

  async function initNew() {
    const active = accounts.find(a => a.active)
    if (!active) { setStatus('✗ Set an active account first'); return }
    // projects:init with no dir triggers folder picker in main.js
    const res = await window.ccm.projects.init(undefined, active.name, '')
    if (!res || res.error === 'cancelled') return
    if (!res.ok) { setStatus(`✗ ${res.error}`); return }

    // Check if .gitignore needs updating
    const giRes = await window.ccm.projects.checkGitignore(res.data?.projectRoot || '', false)
    if (giRes?.data === 'no_gitignore' || giRes?.data === 'already_listed') {
      setStatus(`✓ Project "${res.data?.name}" initialised`)
    } else {
      setGitignorePrompt({ projectDir: res.data?.projectRoot, name: res.data?.name })
    }
    refresh()
  }

  async function addGitignore(projectDir, add) {
    if (add) {
      await window.ccm.projects.checkGitignore(projectDir, true)
      setStatus(`✓ .gitignore updated`)
    }
    setGitignorePrompt(null)
    refresh()
  }

  async function updateScanRoots(roots) {
    await window.ccm.projects.setScanRoots(roots)
    setScanRoots(roots)
    refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Projects</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ghost" style={{ fontSize: 12 }} onClick={() => setShowRoots(s => !s)}>
            ⚙ scan roots
          </button>
          <button className="ghost" style={{ fontSize: 12 }} onClick={refresh}>↻ refresh</button>
          <button className="primary" style={{ fontSize: 12 }} onClick={initNew}>+ new project</button>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div style={{ color: status.startsWith('✗') ? 'var(--red)' : 'var(--accent)',
          background: 'var(--bg3)', border: `1px solid ${status.startsWith('✗') ? '#5a2020' : 'var(--accent2)'}`,
          borderRadius: 6, padding: '8px 14px', fontSize: 12 }}>
          {status}
        </div>
      )}

      {/* .gitignore prompt */}
      {gitignorePrompt && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--yellow)',
          borderRadius: 8, padding: '14px 18px' }}>
          <div style={{ color: 'var(--yellow)', marginBottom: 6 }}>Add .ccm-project.json to .gitignore?</div>
          <div style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 12 }}>
            Project "{gitignorePrompt.name}" was initialised. Adding .ccm-project.json to .gitignore
            keeps it out of your git history.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ghost" style={{ fontSize: 12 }}
              onClick={() => addGitignore(gitignorePrompt.projectDir, false)}>Skip</button>
            <button className="primary" style={{ fontSize: 12 }}
              onClick={() => addGitignore(gitignorePrompt.projectDir, true)}>Add to .gitignore</button>
          </div>
        </div>
      )}

      {/* Scan roots config */}
      {showRoots && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '14px 18px' }}>
          <div style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 10 }}>
            Project scan roots — CCM searches these directories for .ccm-project.json files.
            Default: your home directory.
          </div>
          {scanRoots.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 10 }}>
              Using default: home directory
            </div>
          )}
          {scanRoots.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ color: 'var(--text2)', fontSize: 12, flex: 1,
                fontFamily: 'var(--font)' }}>{r}</span>
              <button className="danger" style={{ fontSize: 11 }}
                onClick={() => updateScanRoots(scanRoots.filter((_, j) => j !== i))}>remove</button>
            </div>
          ))}
          <button className="ghost" style={{ fontSize: 12, marginTop: 6 }}
            onClick={async () => {
              // Use projects:init with no accountName to trigger folder picker in main.js
              const res = await window.ccm.projects.init(undefined, '', '')
              if (!res || res.error === 'cancelled') return
              const dir = res.data?.projectRoot
              if (dir) updateScanRoots([...scanRoots, dir])
            }}>
            + add root
          </button>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && !showRoots && (
        <div style={{ color: 'var(--text3)', padding: '24px 0' }}>
          No projects found.{' '}
          <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={initNew}>
            Init a project →
          </span>
        </div>
      )}

      {/* Project list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {projects.map(p => (
          <div key={p.projectFile} style={{
            background: 'var(--bg3)',
            border: `1px solid ${binding?.projectFile === p.projectFile ? 'var(--accent2)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '14px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 2 }}>{p.projectRoot}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--text2)', fontSize: 12 }}>→</span>
                <span style={{ color: 'var(--accent)', fontSize: 12 }}>{p.account}</span>
                <button className="ghost" style={{ fontSize: 11 }}
                  onClick={() => setBinding(binding?.projectFile === p.projectFile ? null : p)}>
                  rebind
                </button>
              </div>
            </div>

            {binding?.projectFile === p.projectFile && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text2)', fontSize: 11, marginBottom: 8 }}>Bind to:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {accounts.map(a => (
                    <button
                      key={a.name}
                      className={a.name === p.account ? 'primary' : 'ghost'}
                      style={{ fontSize: 12 }}
                      onClick={() => bind(p.projectRoot, a.name)}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
