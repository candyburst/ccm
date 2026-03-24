import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import SelectInput from 'ink-select-input'
import {
  scanAllProjects, getActiveAccount, listAccounts, bindProject,
  ensureGitignore, loadSyncConfig,
} from '@ccm/core'

export default function Projects() {
  const [projects,  setProjects]  = useState([])
  const [selected,  setSelected]  = useState(0)
  const [mode,      setMode]      = useState('list') // list | rebind | gitignore
  const [accounts,  setAccounts]  = useState([])
  const [status,    setStatus]    = useState('')
  const [gitignoreProject, setGitignoreProject] = useState(null)

  function refresh() {
    const list = scanAllProjects()
    setProjects(list)
    setSelected(i => Math.min(i, Math.max(0, list.length - 1)))
  }

  useEffect(() => { refresh() }, [])

  useInput((input, key) => {
    if (mode === 'list') {
      if (key.upArrow)   setSelected(i => Math.max(0, i - 1))
      if (key.downArrow) setSelected(i => Math.min(projects.length - 1, i + 1))
      if (input === 'b' && projects[selected]) {
        // Load accounts for rebind picker
        setAccounts(listAccounts().map(a => ({ label: a.name, value: a.name })))
        setMode('rebind')
      }
      if (input === 'r') refresh()
    }
    if (key.escape) { setMode('list'); setStatus('') }
  })

  if (mode === 'rebind' && projects[selected]) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Rebind "{projects[selected].name}" to:</Text>
        <SelectInput
          items={accounts}
          onSelect={item => {
            try {
              bindProject(projects[selected].projectRoot, item.value)
              setStatus(`Bound to "${item.value}"`)
            } catch (e) {
              setStatus(`✗ ${e.message}`)
            }
            setMode('list')
            refresh()
          }}
        />
        <Text dimColor>Esc: cancel</Text>
      </Box>
    )
  }

  if (mode === 'gitignore' && gitignoreProject) {
    const items = [
      { label: 'Yes — add .ccm-project.json to .gitignore', value: true  },
      { label: 'No  — skip',                                 value: false },
    ]
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold color="yellow">.gitignore update</Text>
        <Text dimColor>
          .ccm-project.json is not listed in .gitignore for "{gitignoreProject.name}".
          Adding it keeps the file out of your git history.
        </Text>
        <SelectInput
          items={items}
          onSelect={item => {
            if (item.value) {
              ensureGitignore(gitignoreProject.projectRoot, { autoAdd: true })
              setStatus('✓ .gitignore updated')
            }
            setGitignoreProject(null)
            setMode('list')
          }}
        />
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Projects</Text>

      {projects.length === 0 && (
        <Box paddingY={1} flexDirection="column" gap={0}>
          <Text dimColor>No projects found in scan roots.</Text>
          <Text dimColor>Run <Text color="cyan">ccm project init</Text> inside a project directory.</Text>
          <Text dimColor>Scan roots are configured in Settings → ccm sync on/off.</Text>
        </Box>
      )}

      {projects.map((p, i) => {
        const isSel = i === selected
        return (
          <Box key={p.projectFile} flexDirection="column" paddingX={1}
            borderStyle={isSel ? 'single' : undefined}
            borderColor={isSel ? 'cyan' : undefined}
          >
            <Box gap={2}>
              <Text bold={isSel} color={isSel ? 'white' : 'gray'}>{p.name}</Text>
              <Text color="cyan" dimColor>→</Text>
              <Text color="cyan">{p.account}</Text>
            </Box>
            {isSel && <Text dimColor>{p.projectRoot}</Text>}
          </Box>
        )
      })}

      {status && <Text color={status.startsWith('✗') ? 'red' : 'green'}>{status}</Text>}

      <Text dimColor>↑↓ select  •  b: rebind  •  r: refresh  •  Esc: back</Text>
    </Box>
  )
}
