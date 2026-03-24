import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import {
  loadSyncConfig, saveSyncConfig,
  getGitStatus, gitCheckpoint,
  listCheckpoints,
} from '@ccm/core'

const TOGGLES = [
  { key: 'smartResume',   label: 'Smart resume on switch',   desc: 'Transfer JSONL + --resume when rotating accounts' },
  { key: 'gitCheckpoint', label: 'Git checkpoint on switch', desc: 'git add -A && commit before every account rotation' },
]

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export default function Sync({ go }) {
  const [cfg,         setCfg]         = useState(null)
  const [gitSt,       setGitSt]       = useState(null)
  const [checkpoints, setCheckpoints] = useState([])
  const [selected,    setSelected]    = useState(0)
  const [status,      setStatus]      = useState('')
  const [busy,        setBusy]        = useState(false)

  useEffect(() => {
    try {
      const c = loadSyncConfig()
      setCfg(c)
      const gs = getGitStatus(process.cwd())
      setGitSt(gs)
      setCheckpoints(listCheckpoints())
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    }
  }, [])

  useInput(async (input, key) => {
    if (key.escape) { go('dashboard'); return }
    if (!cfg) return

    if (key.upArrow)   setSelected(i => Math.max(0, i - 1))
    if (key.downArrow) setSelected(i => Math.min(TOGGLES.length - 1, i + 1))

    if ((key.return || input === ' ') && TOGGLES[selected]) {
      const k = TOGGLES[selected].key
      const updated = { ...cfg, [k]: !cfg[k] }
      setCfg(updated)
      try { saveSyncConfig(updated); setStatus('Saved') } catch (e) { setStatus(`Error: ${e.message}`) }
    }

    if (input === 'c' && gitSt?.isGitRepo && !busy) {
      setBusy(true); setStatus('Checkpointing...')
      try {
        const r = await gitCheckpoint(process.cwd(), { message: 'manual checkpoint from TUI' })
        setStatus(r.success ? `Checkpoint: ${r.commitHash || 'ok'}` : `Failed: ${r.reason}`)
        setCheckpoints(listCheckpoints())
      } catch (e) { setStatus(`Error: ${e.message}`) }
      setBusy(false)
    }
  })

  if (!cfg) return (
    <Box><Text color="gray">Loading...</Text></Box>
  )

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Sync &amp; continuity</Text>

      {/* Git status */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text bold dimColor>Git status</Text>
        {gitSt?.isGitRepo ? (
          <Box gap={3}>
            <Text color="cyan">{gitSt.branch}</Text>
            {gitSt.isDirty
              ? <Text color="yellow">{gitSt.changedFiles} uncommitted</Text>
              : <Text color="green">clean</Text>}
            {!gitSt.hasRemote && <Text color="yellow">no remote</Text>}
            {gitSt.aheadCount > 0 && <Text color="yellow">{gitSt.aheadCount} unpushed</Text>}
          </Box>
        ) : (
          <Text dimColor>Not a git repo</Text>
        )}
        {gitSt?.isGitRepo && (
          <Text dimColor>Press <Text bold>c</Text> to checkpoint now</Text>
        )}
      </Box>

      {/* Toggles */}
      <Text bold dimColor>Settings</Text>
      {TOGGLES.map((t, i) => {
        const val = cfg[t.key]
        const sel = i === selected
        return (
          <Box key={t.key} flexDirection="column" paddingX={1}
            borderStyle={sel ? 'single' : undefined}
            borderColor={sel ? 'cyan' : undefined}
          >
            <Box gap={2}>
              <Text color={val ? 'green' : 'gray'}>{val ? '● on' : '○ off'}</Text>
              <Text bold={sel} color={sel ? 'white' : 'gray'}>{t.label}</Text>
            </Box>
            <Text dimColor>{t.desc}</Text>
          </Box>
        )
      })}

      {/* Recent checkpoints */}
      {checkpoints.length > 0 && (
        <Box flexDirection="column">
          <Text bold dimColor>Recent checkpoints ({checkpoints.length})</Text>
          {checkpoints.slice(0, 5).map((cp, i) => (
            <Box key={i} gap={3}>
              <Text color="cyan">{cp.account}</Text>
              <Text dimColor>{fmtDate(cp.savedAt)}</Text>
            </Box>
          ))}
        </Box>
      )}

      {status ? <Text color={status.startsWith('Error') ? 'red' : 'green'}>{status}</Text> : null}
      <Text dimColor>↑↓ select  •  Enter/Space: toggle  •  c: checkpoint  •  Esc: back</Text>
    </Box>
  )
}
