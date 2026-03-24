import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { CONFIG_FILE, CCM_DIR } from '@ccm/core'

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
  } catch {
    return { autoSwitch: true, keepSessionLog: true, maxLogEntries: 500 }
  }
}

function saveConfig(cfg) {
  mkdirSync(CCM_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2))
}

const TOGGLES = [
  {
    key: 'autoSwitch',
    label: 'Auto-switch on credit limit',
    desc: 'Rotates to next account when credits run out',
  },
  {
    key: 'keepSessionLog',
    label: 'Keep session log',
    desc: 'Logs each run to ~/.ccm/session-log.json',
  },
]

export default function Settings() {
  const [config, setConfig] = useState(loadConfig)
  const [selected, setSelected] = useState(0)
  const [saved, setSaved] = useState(false)

  useInput((input, key) => {
    if (key.upArrow) setSelected(i => Math.max(0, i - 1))
    if (key.downArrow) setSelected(i => Math.min(TOGGLES.length - 1, i + 1))
    if (key.return || input === ' ') {
      const k = TOGGLES[selected].key
      const updated = { ...config, [k]: !config[k] }
      setConfig(updated)
      saveConfig(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Settings</Text>

      {TOGGLES.map((t, i) => {
        const val = config[t.key]
        const sel = i === selected
        return (
          <Box
            key={t.key}
            flexDirection="column"
            paddingX={1}
            borderStyle={sel ? 'single' : undefined}
            borderColor={sel ? 'cyan' : undefined}
          >
            <Box gap={2}>
              <Text color={val ? 'green' : 'gray'}>{val ? '● on' : '○ off'}</Text>
              <Text bold={sel} color={sel ? 'white' : 'gray'}>
                {t.label}
              </Text>
            </Box>
            <Text dimColor>{t.desc}</Text>
          </Box>
        )
      })}

      <Box flexDirection="column" paddingX={1} marginTop={1}>
        <Text bold dimColor>
          Security
        </Text>
        <Text dimColor>API keys are encrypted with AES-256-GCM.</Text>
        <Text dimColor>Set CCM_SECRET env var for a custom passphrase.</Text>
        <Text dimColor> export CCM_SECRET=your-passphrase</Text>
      </Box>

      <Box flexDirection="column" paddingX={1}>
        <Text bold dimColor>
          Storage
        </Text>
        <Text dimColor>Config dir: ~/.ccm/</Text>
        <Text dimColor>Account file: ~/.ccm/accounts.json</Text>
        <Text dimColor>Session log: ~/.ccm/session-log.json</Text>
      </Box>

      {saved && <Text color="green">✓ Saved</Text>}
      <Text dimColor>↑↓ select • Enter / Space: toggle</Text>
    </Box>
  )
}
