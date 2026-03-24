#!/usr/bin/env node
import { argv } from 'process'

const args = argv.slice(2)
const cmd  = args[0]

const CLI_COMMANDS = ['account', 'export', 'import', 'hooks', 'serve', 'plugin', 'compress', 'branch', 'queue', 'worker', 'team', 'prompt', 'agent', 'run', 'switch', 'status', 'login', 'project', 'sync', 'checkpoint', 'ui', 'help', '--help', '-h']

if (!cmd || !CLI_COMMANDS.includes(cmd)) {
  const { render }         = await import('ink')
  const React              = (await import('react')).default
  const App                = (await import('../src/App.js')).default
  const { waitUntilExit }  = render(React.createElement(App, { args }))
  await waitUntilExit()
} else {
  const { runCli } = await import('../src/cli.js')
  await runCli(cmd, args.slice(1))
}
