import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import SelectInput from 'ink-select-input'
import { addApiKeyAccount, addEmailAccount, AUTH } from '@ccm/core'

export default function AddAccount({ back }) {
  const [step,    setStep]    = useState('type')
  const [form,    setForm]    = useState({ type: '', name: '', key: '', email: '', notes: '' })
  const [error,   setError]   = useState('')
  const [input,   setInput]   = useState('')
  const [busy,    setBusy]    = useState(false)

  const typeItems = [
    { label: 'API key  — paste an Anthropic API key',      value: AUTH.API_KEY },
    { label: 'Email    — browser login (Claude Max / Pro)', value: AUTH.EMAIL   },
  ]

  async function next(field, value) {
    const updated = { ...form, [field]: value }
    setForm(updated)
    setInput('')
    setError('')

    if (step === 'type')  return setStep('name')

    if (step === 'name') {
      if (!value.trim()) return setError('Name is required')
      return setStep(updated.type === AUTH.API_KEY ? 'key' : 'email')
    }

    if (step === 'key') {
      if (!value.startsWith('sk-')) return setError('API key should start with sk-')
      return setStep('notes')
    }

    if (step === 'email') {
      if (!value.includes('@')) return setError('Enter a valid email address')
      return setStep('notes')
    }

    if (step === 'notes') {
      setBusy(true)
      try {
        if (updated.type === AUTH.API_KEY) {
          // addApiKeyAccount is now async — it validates the key before saving
          await addApiKeyAccount(updated.name.trim(), updated.key.trim(), updated.notes)
        } else {
          addEmailAccount(updated.name.trim(), updated.email.trim(), updated.notes)
        }
        setStep('done')
      } catch (e) {
        setError(e.message)
      } finally {
        setBusy(false)
      }
    }
  }

  useInput((inp, key) => {
    if (key.escape && !busy) back()
  })

  // ── Type selection ──────────────────────────────────────────────────────────

  if (step === 'type') return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Add account — choose auth type</Text>
      <SelectInput items={typeItems} onSelect={item => next('type', item.value)} />
    </Box>
  )

  // ── Saving / validating ─────────────────────────────────────────────────────

  if (busy) return (
    <Box flexDirection="column" gap={1}>
      <Text color="yellow">⠋ Validating API key with Anthropic...</Text>
      <Text dimColor>This takes a moment</Text>
    </Box>
  )

  // ── Done ────────────────────────────────────────────────────────────────────

  if (step === 'done') {
    const isEmail = form.type === AUTH.EMAIL
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="green">✓ Account "<Text bold>{form.name}</Text>" added.</Text>
        {isEmail && (
          <Box flexDirection="column" gap={1}>
            <Text color="yellow">Next: authenticate this account by running:</Text>
            <Text bold color="cyan">  ccm login {form.name}</Text>
            <Text dimColor>This opens a browser so Claude can log in as {form.email}</Text>
          </Box>
        )}
        <Text dimColor>Press Esc to go back</Text>
      </Box>
    )
  }

  // ── Input form ──────────────────────────────────────────────────────────────

  const prompts = {
    name:  'Account name (e.g. personal, work):',
    key:   'Anthropic API key (sk-ant-...):',
    email: 'Email address:',
    notes: 'Notes (optional — press Enter to skip):',
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Add account — {form.type === AUTH.API_KEY ? 'API key' : 'email login'}</Text>

      <Box gap={1}>
        <Text color="cyan">{prompts[step]}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={v => next(step, v)}
          mask={step === 'key' ? '*' : undefined}
          placeholder=""
        />
      </Box>

      {error && <Text color="red">✗ {error}</Text>}

      <Text dimColor>Enter: confirm  •  Esc: back</Text>
    </Box>
  )
}
