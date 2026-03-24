// First-run onboarding wizard — shown when no accounts exist at launch.
// Walks the user through: auth type → credentials → account name → optional project init → done.


import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import SelectInput from 'ink-select-input'
import {
  addApiKeyAccount, addEmailAccount, setActiveAccount,
  initProject, loadProject, AUTH,
} from '@ccm/core'

const STEPS = ['welcome', 'type', 'name', 'credential', 'notes', 'saving', 'project', 'done']

export default function Onboard({ onComplete }) {
  const [step,    setStep]    = useState('welcome')
  const [form,    setForm]    = useState({ type: '', name: '', key: '', email: '', notes: '' })
  const [input,   setInput]   = useState('')
  const [error,   setError]   = useState('')
  const [busy,    setBusy]    = useState(false)
  const [initDir, setInitDir] = useState(false)  // whether user chose to init a project

  const typeItems = [
    { label: 'API key    — paste a key from console.anthropic.com', value: AUTH.API_KEY },
    { label: 'Email      — browser login (Claude Max / Pro)',        value: AUTH.EMAIL   },
  ]

  const projectChoiceItems = [
    { label: `Yes — bind ${process.cwd()} to this account`, value: true  },
    { label: 'No  — skip for now, I\'ll do this later',       value: false },
  ]

  useInput((inp, key) => {
    if (busy) return
    if (key.escape) {
      // Allow escaping back one step
      const idx = STEPS.indexOf(step)
      if (idx > 1) {
        setInput('')
        setError('')
        setStep(STEPS[idx - 1])
      }
    }
  })

  async function advance(field, value) {
    const updated = { ...form, [field]: value }
    setForm(updated)
    setInput('')
    setError('')

    if (step === 'type') return setStep('name')

    if (step === 'name') {
      if (!value.trim()) return setError('Account name is required')
      if (/[^a-zA-Z0-9_-]/.test(value.trim())) return setError('Name can only contain letters, numbers, - and _')
      return setStep('credential')
    }

    if (step === 'credential') {
      if (updated.type === AUTH.API_KEY) {
        if (!value.startsWith('sk-')) return setError('API key should start with sk-')
      } else {
        if (!value.includes('@')) return setError('Enter a valid email address')
      }
      return setStep('notes')
    }

    if (step === 'notes') {
      // notes is optional — proceed to saving
      setBusy(true)
      setStep('saving')
      try {
        if (updated.type === AUTH.API_KEY) {
          await addApiKeyAccount(updated.name.trim(), updated.key.trim(), updated.notes.trim())
        } else {
          addEmailAccount(updated.name.trim(), updated.email.trim(), updated.notes.trim())
        }
        setActiveAccount(updated.name.trim())
        setStep('project')
      } catch (e) {
        setError(e.message)
        setStep('notes')
      } finally {
        setBusy(false)
      }
    }
  }

  function handleProjectChoice(choice) {
    if (choice) {
      try {
        initProject(process.cwd(), form.name.trim())
        setInitDir(true)
      } catch {
        // Already initialised or not writable — skip silently
      }
    }
    setStep('done')
  }

  // ── Welcome ─────────────────────────────────────────────────────────────────

  if (step === 'welcome') return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text bold color="cyan">CCM — Claude Code Manager</Text>
      <Text dimColor>Zero-downtime Claude Code sessions.</Text>
      <Box marginTop={1} flexDirection="column" gap={0}>
        <Text>No accounts configured yet. This wizard takes about 60 seconds.</Text>
        <Text dimColor>You'll add an account, and optionally bind the current directory as a project.</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="cyan">Press Enter to start  •  Esc to quit</Text>
      </Box>
      <TextInput value="" onChange={() => {}} onSubmit={() => setStep('type')} placeholder="" />
    </Box>
  )

  // ── Type selection ───────────────────────────────────────────────────────────

  if (step === 'type') return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text bold>Step 1 of 3 — choose authentication method</Text>
      <SelectInput items={typeItems} onSelect={item => advance('type', item.value)} />
      <Text dimColor>↑↓ select  •  Enter: confirm  •  Esc: back</Text>
    </Box>
  )

  // ── Saving ───────────────────────────────────────────────────────────────────

  if (step === 'saving') return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color="yellow">⠋ Validating and saving account...</Text>
      {form.type === AUTH.API_KEY && (
        <Text dimColor>Checking key with Anthropic — this takes a moment</Text>
      )}
    </Box>
  )

  // ── Project init choice ──────────────────────────────────────────────────────

  if (step === 'project') {
    const alreadyBound = loadProject() !== null
    if (alreadyBound) {
      setStep('done')
      return null
    }
    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Text bold>Step 3 of 3 — bind current directory as a project?</Text>
        <Text dimColor>{process.cwd()}</Text>
        <Text>Binding means <Text bold>ccm run</Text> always uses account <Text color="cyan">{form.name}</Text> here.</Text>
        <SelectInput items={projectChoiceItems} onSelect={item => handleProjectChoice(item.value)} />
      </Box>
    )
  }

  // ── Done ─────────────────────────────────────────────────────────────────────

  if (step === 'done') return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color="green" bold>✓ Account "{form.name}" added and set as active.</Text>

      {form.type === AUTH.EMAIL && (
        <Box flexDirection="column" gap={0} borderStyle="round" borderColor="yellow" paddingX={1} marginTop={1}>
          <Text color="yellow">Authentication required</Text>
          <Text dimColor>Run the following to complete browser login:</Text>
          <Text bold color="cyan">  ccm login {form.name}</Text>
        </Box>
      )}

      {initDir && (
        <Text dimColor>✓ {process.cwd()} bound to "{form.name}"</Text>
      )}

      <Box marginTop={1} flexDirection="column" gap={0}>
        <Text dimColor>You're ready. Next steps:</Text>
        {form.type === AUTH.EMAIL
          ? <Text>  1. Run <Text bold color="cyan">ccm login {form.name}</Text> to authenticate</Text>
          : <Text>  1. Run <Text bold color="cyan">ccm run</Text> to launch Claude Code</Text>
        }
        <Text>  2. Open the TUI at any time with <Text bold color="cyan">ccm</Text></Text>
      </Box>

      <Box marginTop={1}>
        <Text color="cyan">Press Enter to open the dashboard</Text>
      </Box>
      <TextInput value="" onChange={() => {}} onSubmit={onComplete} placeholder="" />
    </Box>
  )

  // ── Input steps (name, credential, notes) ───────────────────────────────────

  const stepLabels = {
    name:       `Step 2 of 3 — account name`,
    credential: form.type === AUTH.API_KEY ? 'Step 2 of 3 — Anthropic API key' : 'Step 2 of 3 — email address',
    notes:      'Step 2 of 3 — notes (optional)',
  }

  const placeholders = {
    name:       'e.g. personal, work, backup',
    credential: form.type === AUTH.API_KEY ? 'sk-ant-...' : 'you@example.com',
    notes:      'e.g. personal plan, 50k tokens/day — press Enter to skip',
  }

  const field = step === 'credential' && form.type === AUTH.API_KEY ? 'key' : step === 'credential' ? 'email' : step

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text bold>{stepLabels[step]}</Text>

      <Box gap={1}>
        <Text color="cyan">›</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={v => advance(field, v)}
          mask={step === 'credential' && form.type === AUTH.API_KEY ? '*' : undefined}
          placeholder={placeholders[step]}
        />
      </Box>

      {error && <Text color="red">✗ {error}</Text>}
      <Text dimColor>Enter: confirm  •  Esc: back</Text>
    </Box>
  )
}
