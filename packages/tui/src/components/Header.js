import React from 'react'
import { Box, Text } from 'ink'

const TABS = [
  { key: 'dashboard',   label: 'Dashboard'   },
  { key: 'run',         label: 'Run'         },
  { key: 'projects',    label: 'Projects'    },
  { key: 'sessions',    label: 'Sessions'    },
  { key: 'sync',        label: 'Sync'        },
  { key: 'settings',    label: 'Settings'    },
]

export default function Header({ screen }) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Box gap={1} marginBottom={0}>
        <Text bold color="cyan">ccm</Text>
        <Text color="gray">Claude Code Manager  ·  Tab: cycle screens  ·  Esc/q: back</Text>
      </Box>
      <Box gap={2}>
        {TABS.map(t => (
          <Text
            key={t.key}
            color={screen === t.key ? 'cyan' : 'gray'}
            bold={screen === t.key}
            underline={screen === t.key}
          >
            {t.label}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
