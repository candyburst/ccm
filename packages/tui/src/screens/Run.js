// TUI Run screen — mirrors Electron's RunSession page.
// Account picker → optional flags → launches Claude Code.
// Because Ink renders to an alternative screen buffer and Claude Code has its
// own interactive TUI, we use a "pass-through" approach:
//   1. Render the picker/input form in Ink
//   2. On confirm: clear the Ink screen, spawn Claude in the foreground
//   3. On Claude exit: re-render the Ink TUI with a summary
//
// This gives a clean experience without Ink and Claude fighting over the terminal.

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import SelectInput from 'ink-select-input'
import TextInput from 'ink-text-input'
import {
  listAccounts,
  getActiveAccount,
  runClaude,
  loadProject,
  loadSyncConfig,
  AUTH,
} from '@ccm/core'

const MODES = { PICK: 'pick', FLAGS: 'flags', RUNNING: 'running', DONE: 'done', ERROR: 'error' }

export default function Run({ back }) {
  const { exit } = useApp()
  const [mode, setMode] = useState(MODES.PICK)
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState(null)
  const [flags, setFlags] = useState('')
  const [result, setResult] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    const list = listAccounts().filter(a => !a.disabled)
    const active = getActiveAccount()
    const project = loadProject()
    setAccounts(list)

    // Pre-select: project-bound account > active account > first
    if (project) {
      const bound = list.find(a => a.name === project.account)
      if (bound) {
        setSelected(bound)
        return
      }
    }
    if (active) {
      const a = list.find(a => a.name === active.name)
      if (a) {
        setSelected(a)
        return
      }
    }
    if (list.length > 0) setSelected(list[0])
  }, [])

  useInput((inp, key) => {
    if (mode === MODES.RUNNING) return
    if (key.escape) {
      if (mode === MODES.FLAGS) {
        setMode(MODES.PICK)
        return
      }
      if (mode === MODES.DONE || mode === MODES.ERROR) {
        back()
        return
      }
      back()
    }
  })

  async function launch() {
    if (!selected) return
    setMode(MODES.RUNNING)

    const project = loadProject()
    const cfg = loadSyncConfig()
    const extraArgs = flags.trim() ? flags.trim().split(/\s+/) : []

    try {
      const res = await runClaude(selected, extraArgs, {
        autoSwitch: true,
        projectName: project?.name,
        projectRoot: project?.projectRoot,
        onSwitch: (from, to) => {
          // Print to stderr so it appears in the terminal alongside Claude output
          process.stderr.write(`\n[ccm] Switched: ${from} → ${to}\n`)
        },
      })
      setResult(res)
      setMode(MODES.DONE)
    } catch (e) {
      setErrMsg(e.message)
      setMode(MODES.ERROR)
    }
  }

  // ── No accounts ──────────────────────────────────────────────────────────────

  if (accounts.length === 0)
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="yellow">No accounts configured.</Text>
        <Text dimColor>
          Press <Text bold>a</Text> on the Dashboard to add one.
        </Text>
        <Text dimColor>Esc: back</Text>
      </Box>
    )

  // ── Account picker ───────────────────────────────────────────────────────────

  if (mode === MODES.PICK) {
    const project = loadProject()
    const items = accounts.map(a => ({
      label: `${a.name}  ${a.type === AUTH.API_KEY ? '[api]' : '[email]'}${a.active ? '  ← active' : ''}`,
      value: a.name,
    }))

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Run session — choose account</Text>
        {project && (
          <Text dimColor>
            Project: <Text color="green">{project.name}</Text>
          </Text>
        )}
        <SelectInput
          items={items}
          initialIndex={Math.max(
            0,
            accounts.findIndex(a => a.name === selected?.name)
          )}
          onSelect={item => {
            setSelected(accounts.find(a => a.name === item.value))
            setMode(MODES.FLAGS)
          }}
        />
        <Text dimColor>↑↓ select • Enter: confirm • Esc: back</Text>
      </Box>
    )
  }

  // ── Flags input ──────────────────────────────────────────────────────────────

  if (mode === MODES.FLAGS)
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Run session</Text>
        <Box gap={2}>
          <Text color="cyan">Account:</Text>
          <Text bold>{selected?.name}</Text>
          <Text dimColor>({selected?.type === AUTH.API_KEY ? 'api key' : selected?.email})</Text>
        </Box>

        <Box gap={1} marginTop={1}>
          <Text color="cyan">Extra flags (optional):</Text>
          <TextInput
            value={flags}
            onChange={setFlags}
            onSubmit={launch}
            placeholder="e.g. --model claude-opus-4-5 --dangerously-skip-permissions"
          />
        </Box>

        <Text dimColor>Enter: start • Esc: back to account picker</Text>
      </Box>
    )

  // ── Running ──────────────────────────────────────────────────────────────────

  if (mode === MODES.RUNNING)
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="yellow">⠋ Session running on "{selected?.name}"...</Text>
        <Text dimColor>Claude Code has taken over the terminal.</Text>
        <Text dimColor>CCM will resume here when the session ends.</Text>
      </Box>
    )

  // ── Done ─────────────────────────────────────────────────────────────────────

  if (mode === MODES.DONE)
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="green" bold>
          ✓ Session ended
        </Text>
        {result?.exhausted && (
          <Text color="red">All accounts exhausted — no more accounts to try.</Text>
        )}
        {result && !result.exhausted && <Text dimColor>Exit code: {result.code ?? '—'}</Text>}
        <Text dimColor>Esc: back to dashboard</Text>
      </Box>
    )

  // ── Error ─────────────────────────────────────────────────────────────────────

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="red">✗ {errMsg || 'Session failed'}</Text>
      <Text dimColor>Esc: back</Text>
    </Box>
  )
}
