import React from 'react'
import { Box, Text } from 'ink'
import { getActiveAccount } from '@ccm/core'

export default function StatusBar({ screen }) {
  let active
  try { active = getActiveAccount() } catch { active = null }

  const hints = {
    'dashboard':   'Tab: next  •  a: add account  •  Enter: activate  •  q: quit',
    'add-account': 'Tab: next  •  Esc: back  •  Enter: confirm',
    'projects':    'Tab: next  •  Esc: back  •  b: bind account',
    'sessions':    'Tab: next  •  Esc: back  •  c: clear history',
    'sync':        'Tab: next  •  Esc: back  •  Enter/Space: toggle  •  c: checkpoint',
    'settings':    'Tab: next  •  Esc: back  •  Enter/Space: toggle',
  }

  const activeLabel = active
    ? `${active.type === 'api_key' ? '⚡' : '●'} ${active.name}`
    : 'no active account'

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Text color="gray" dimColor>{hints[screen] || ''}</Text>
      <Text color={active ? 'cyan' : 'yellow'}>{activeLabel}</Text>
    </Box>
  )
}
