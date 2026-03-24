import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { getSessions, getSessionStats, clearSessions } from '@ccm/core'

function fmtDuration(sec) {
  if (!sec) return '—'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

const REASON_COLOR = {
  normal:                 'green',
  credit_limit:           'yellow',
  credit_limit_exhausted: 'red',
  error:                  'red',
  spawn_error:            'red',
  interrupted:            'gray',
  running:                'cyan',
}

const REASON_FILTERS = ['all', 'normal', 'credit_limit', 'credit_limit_exhausted', 'error', 'interrupted']

export default function Sessions() {
  const [sessions,      setSessions]      = useState([])
  const [stats,         setStats]         = useState(null)
  const [offset,        setOffset]        = useState(0)
  const [confirm,       setConfirm]       = useState(false)
  const [reasonFilter,  setReasonFilter]  = useState(0) // index into REASON_FILTERS
  const PAGE = 8

  function refresh() {
    const filter = REASON_FILTERS[reasonFilter]
    const opts   = { limit: 100 }
    if (filter !== 'all') opts.exitReason = filter
    setSessions(getSessions(opts))
    setStats(getSessionStats())
    setOffset(0)
  }

  useEffect(() => { refresh() }, [reasonFilter])

  useInput((input, key) => {
    if (confirm) {
      if (input === 'y') { clearSessions(); setConfirm(false); refresh() }
      if (input === 'n' || key.escape) setConfirm(false)
      return
    }

    if (key.downArrow || input === 'j') setOffset(o => Math.min(o + 1, Math.max(0, sessions.length - PAGE)))
    if (key.upArrow   || input === 'k') setOffset(o => Math.max(0, o - 1))
    if (input === 'c') setConfirm(true)

    // r key cycles through reason filters
    if (input === 'r') {
      setReasonFilter(i => (i + 1) % REASON_FILTERS.length)
    }
  })

  const page    = sessions.slice(offset, offset + PAGE)
  const filter  = REASON_FILTERS[reasonFilter]
  const filterLabel = filter === 'all' ? 'all reasons' : filter.replace(/_/g, ' ')

  if (confirm) return (
    <Box flexDirection="column" gap={1}>
      <Text color="yellow">Clear all session history? This cannot be undone.</Text>
      <Text>Press <Text bold>y</Text> to confirm or <Text bold>n</Text> to cancel.</Text>
    </Box>
  )

  return (
    <Box flexDirection="column" gap={1}>
      <Box justifyContent="space-between">
        <Text bold>Sessions</Text>
        <Text dimColor>filter: <Text color={filter === 'all' ? 'gray' : 'cyan'}>{filterLabel}</Text>  (r to cycle)</Text>
      </Box>

      {stats && (
        <Box gap={4}>
          <Text dimColor>total: <Text color="cyan">{stats.total}</Text></Text>
          <Text dimColor>time: <Text color="cyan">{fmtDuration(stats.totalSec)}</Text></Text>
          <Text dimColor>switches: <Text color="yellow">{stats.switches}</Text></Text>
        </Box>
      )}

      {sessions.length === 0 && (
        <Text dimColor>No sessions{filter !== 'all' ? ` with reason "${filterLabel}"` : ''}.</Text>
      )}

      {page.map((s, i) => (
        <Box key={s.id} flexDirection="column" paddingX={1}>
          <Box gap={2}>
            <Text bold color="white">{s.account}</Text>
            {s.projectName && <Text dimColor>· {s.projectName}</Text>}
            <Text color={REASON_COLOR[s.exitReason] || 'gray'}>
              {s.exitReason?.replace(/_/g, ' ') ?? '—'}
            </Text>
            <Text dimColor>{fmtDuration(s.durationSec)}</Text>
          </Box>
          <Text dimColor>{fmtDate(s.startedAt)}</Text>
        </Box>
      ))}

      {sessions.length > PAGE && (
        <Text dimColor>{offset + 1}–{Math.min(offset + PAGE, sessions.length)} of {sessions.length}</Text>
      )}

      <Text dimColor>↑↓ scroll  •  r: cycle reason filter  •  c: clear history  •  Esc: back</Text>
    </Box>
  )
}
