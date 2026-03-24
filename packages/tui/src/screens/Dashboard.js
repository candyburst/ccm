import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { listAccounts, setActiveAccount, getActiveAccount, updateAccount, loadProject, AUTH } from '@ccm/core'

export default function Dashboard({ go }) {
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState(0)
  const [status,   setStatus]   = useState('')

  function refresh() {
    const list = listAccounts()
    setAccounts(list)
    // Keep selection in bounds after refresh
    setSelected(i => Math.min(i, Math.max(0, list.length - 1)))
  }

  useEffect(() => { refresh() }, [])

  useInput((input, key) => {
    if (key.upArrow)   setSelected(i => Math.max(0, i - 1))
    if (key.downArrow) setSelected(i => Math.min(accounts.length - 1, i + 1))

    if (key.return && accounts[selected]) {
      setActiveAccount(accounts[selected].name)
      setStatus(`Active → "${accounts[selected].name}"`)
      refresh()
    }

    if (input === 'a') go('add-account')

    if (input === 'd' && accounts[selected]) {
      const acct    = accounts[selected]
      const toggled = !acct.disabled
      updateAccount(acct.name, { disabled: toggled })
      setStatus(toggled ? `"${acct.name}" disabled` : `"${acct.name}" enabled`)
      refresh()
    }
  })

  const project = loadProject()

  return (
    <Box flexDirection="column" gap={1}>
      {project && (
        <Box borderStyle="round" borderColor="green" paddingX={1}>
          <Text>
            Project: <Text bold color="green">{project.name}</Text>
            {'  '}bound to: <Text color="cyan">{project.account}</Text>
            {'  '}<Text dimColor>{project.projectRoot}</Text>
          </Text>
        </Box>
      )}

      <Text bold>Accounts</Text>

      {accounts.length === 0 && (
        <Box paddingY={1}>
          <Text color="yellow">No accounts yet. Press <Text bold>a</Text> to add one.</Text>
        </Box>
      )}

      {accounts.map((a, i) => {
        const isSel    = i === selected
        const isActive = a.active
        const isDisabled = a.disabled
        const typeTag  = a.type === AUTH.API_KEY ? 'api' : 'email'
        const detail   = a.type === AUTH.EMAIL ? a.email : ''
        return (
          <Box
            key={a.name}
            gap={2}
            paddingX={1}
            borderStyle={isSel ? 'single' : undefined}
            borderColor={isSel ? 'cyan' : undefined}
          >
            <Text color={isActive ? 'green' : isDisabled ? 'red' : 'gray'}>
              {isActive ? '●' : isDisabled ? '✗' : '○'}
            </Text>
            <Text bold={isSel} color={isDisabled ? 'gray' : isSel ? 'white' : 'gray'}>
              {a.name}
            </Text>
            <Text color="cyan" dimColor>{typeTag}</Text>
            {detail ? <Text dimColor>{detail}</Text> : null}
            {a.notes ? <Text dimColor>— {a.notes}</Text> : null}
            {isActive   && <Text color="green">← active</Text>}
            {isDisabled && <Text color="red">disabled</Text>}
          </Box>
        )
      })}

      {status ? <Text color="green">{status}</Text> : null}

      <Box marginTop={1}>
        <Text dimColor>↑↓ select  •  Enter: set active  •  a: add  •  d: toggle disable</Text>
      </Box>
    </Box>
  )
}
