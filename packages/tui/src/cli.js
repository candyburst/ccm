import chalk from 'chalk'
import {
  listAccounts,
  getActiveAccount,
  getAccount,
  setActiveAccount,
  updateAccount,
  loadProject,
  initProject,
  bindProject,
  loginEmailAccount,
  runClaude,
  AUTH,
  loadSyncConfig,
  saveSyncConfig,
  getGitStatus,
  gitCheckpoint,
  listCheckpoints,
  pushProject,
  listSessionFiles,
} from '@ccm/core'

function die(msg) {
  console.error(chalk.red(`✗ ${msg}`))
  process.exit(1)
}
function ok(msg) {
  console.log(chalk.green(`✓ ${msg}`))
}
function dim(msg) {
  console.log(chalk.dim(msg))
}
function info(msg) {
  console.log(chalk.cyan(msg))
}

// ─── ccm status ──────────────────────────────────────────────────────────────
function cmdStatus() {
  const active = getActiveAccount()
  const project = loadProject()
  const accounts = listAccounts()

  console.log('')
  if (active) {
    const typeTag =
      active.type === AUTH.API_KEY ? chalk.cyan('api key') : chalk.magenta(`email: ${active.email}`)
    console.log(`  ${chalk.bold('Active account:')} ${chalk.white(active.name)} (${typeTag})`)
  } else {
    console.log(`  ${chalk.bold('Active account:')} ${chalk.yellow('none')}`)
  }

  if (project) {
    console.log(
      `  ${chalk.bold('Project:')}        ${chalk.white(project.name)} → bound to ${chalk.cyan(project.account)}`
    )
    console.log(`  ${chalk.bold('Root:')}           ${chalk.dim(project.projectRoot)}`)
    const gs = getGitStatus(project.projectRoot)
    if (gs.isGitRepo) {
      const dirtyTag = gs.isDirty
        ? chalk.yellow(`${gs.changedFiles} uncommitted`)
        : chalk.green('clean')
      const remoteTag = gs.hasRemote ? chalk.green('remote ok') : chalk.yellow('no remote')
      const aheadTag = gs.aheadCount > 0 ? chalk.yellow(` ${gs.aheadCount} unpushed`) : ''
      console.log(
        `  ${chalk.bold('Git:')}            ${gs.branch} · ${dirtyTag} · ${remoteTag}${aheadTag}`
      )
    }
  } else {
    console.log(`  ${chalk.bold('Project:')}        ${chalk.dim('none')}`)
  }

  console.log(`  ${chalk.bold('Accounts:')}       ${accounts.length}`)
  console.log('')

  for (const a of accounts) {
    const dot = a.active ? chalk.green('●') : chalk.dim('○')
    const type = a.type === AUTH.API_KEY ? chalk.cyan('[api]') : chalk.magenta('[email]')
    const extra = a.type === AUTH.EMAIL ? chalk.dim(` ${a.email}`) : ''
    const dis = a.disabled ? chalk.red(' [disabled]') : ''
    console.log(`  ${dot} ${chalk.white(a.name)} ${type}${extra}${dis}`)
  }
  console.log('')
}

// ─── ccm switch <n> ──────────────────────────────────────────────────────────
function cmdSwitch(args) {
  const name = args[0]
  if (!name) die('Usage: ccm switch <account-name>')
  try {
    getAccount(name)
    setActiveAccount(name)
    ok(`Active account → "${name}"`)
  } catch (e) {
    die(e.message)
  }
}

// ─── ccm login <n> ───────────────────────────────────────────────────────────
async function cmdLogin(args) {
  const name = args[0]
  if (!name) die('Usage: ccm login <account-name>')
  try {
    const account = getAccount(name)
    if (account.type !== AUTH.EMAIL)
      die(`"${name}" is an API key account — no browser login needed`)
    dim(`Opening browser login for "${name}" (${account.email})…`)
    await loginEmailAccount(account)
    ok(`Login complete for "${name}"`)
  } catch (e) {
    die(e.message)
  }
}

// ─── ccm run [opts] [-- <claude flags>] ──────────────────────────────────────
async function cmdRun(args) {
  let accountOverride = null
  let noAutoSwitch = false
  let noResume = false
  let watchMode = false

  const sepIdx = args.indexOf('--')
  const ourArgs = sepIdx >= 0 ? args.slice(0, sepIdx) : args
  const claudeArgs = sepIdx >= 0 ? args.slice(sepIdx + 1) : []

  for (let i = 0; i < ourArgs.length; i++) {
    if (ourArgs[i] === '--account' || ourArgs[i] === '-a') accountOverride = ourArgs[++i]
    if (ourArgs[i] === '--no-auto-switch') noAutoSwitch = true
    if (ourArgs[i] === '--no-resume') noResume = true
    if (ourArgs[i] === '--watch') watchMode = true
  }

  let accountName = accountOverride
  if (!accountName) {
    const project = loadProject()
    if (project) accountName = project.account
  }
  if (!accountName) {
    const active = getActiveAccount()
    if (active) accountName = active.name
  }
  if (!accountName) die('No account selected.\n  Run: ccm switch <n>  or  ccm project init')

  let account
  try {
    account = getAccount(accountName)
  } catch (e) {
    die(e.message)
  }

  const project = loadProject()
  const cfg = loadSyncConfig()

  console.log(
    chalk.dim(
      `\n[ccm] account: ${account.name} (${account.type === AUTH.API_KEY ? 'api key' : account.email})`
    )
  )
  if (project) console.log(chalk.dim(`[ccm] project: ${project.name}`))
  console.log(
    chalk.dim(
      `[ccm] smart resume: ${cfg.smartResume && !noResume ? 'on' : 'off'} · git checkpoint: ${cfg.gitCheckpoint ? 'on' : 'off'}`
    )
  )
  console.log('')

  try {
    const runner = watchMode ? watchClaude : runClaude
    await runner(account, claudeArgs, {
      autoSwitch: !noAutoSwitch,
      smartResume: cfg.smartResume && !noResume,
      projectName: project?.name,
      projectRoot: project?.projectRoot,
      onSwitch: (from, to) => {
        console.error(chalk.yellow(`\n[ccm] Credit limit on "${from}" → switching to "${to}"\n`))
      },
      onCheckpoint: r => {
        if (r.success) console.error(chalk.dim(`[ccm] Checkpoint: ${r.commitHash}`))
      },
    })
  } catch (e) {
    die(e.message)
  }
}

// ─── ccm project <sub> ───────────────────────────────────────────────────────
async function cmdProject(args) {
  const sub = args[0]

  if (sub === 'init') {
    let accountName = args[1]
    if (!accountName) {
      const active = getActiveAccount()
      if (!active) die('No active account. Pass one: ccm project init <account>')
      accountName = active.name
    }
    try {
      const config = initProject(process.cwd(), accountName)
      ok(`Project "${config.name}" initialised → bound to "${accountName}"`)
      dim('  Run: ccm run')
    } catch (e) {
      die(e.message)
    }
    return
  }

  if (sub === 'bind') {
    const accountName = args[1]
    if (!accountName) die('Usage: ccm project bind <account-name>')
    try {
      bindProject(process.cwd(), accountName)
      ok(`Project rebound to "${accountName}"`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  if (sub === 'status') {
    const project = loadProject()
    if (!project) {
      dim('No project found here.')
      return
    }
    console.log('')
    console.log(`  ${chalk.bold('Name:')}    ${project.name}`)
    console.log(`  ${chalk.bold('Account:')} ${chalk.cyan(project.account)}`)
    console.log(`  ${chalk.bold('Root:')}    ${chalk.dim(project.projectRoot)}`)
    console.log('')
    return
  }

  console.log(`Usage:
  ccm project init [account]   Initialise project in current directory
  ccm project bind <account>   Rebind to a different account
  ccm project status           Show current project info`)
}

// ─── ccm sync [sub] ──────────────────────────────────────────────────────────
async function cmdSync(args) {
  const sub = args[0] || 'status'

  if (sub === 'status') {
    const cfg = loadSyncConfig()
    const project = loadProject()
    console.log('')
    console.log(
      `  ${chalk.bold('Smart resume:')}   ${cfg.smartResume ? chalk.green('on') : chalk.gray('off')}`
    )
    console.log(
      `  ${chalk.bold('Git checkpoint:')} ${cfg.gitCheckpoint ? chalk.green('on') : chalk.gray('off')}`
    )
    console.log(
      `  ${chalk.bold('GitHub sync:')}    ${cfg.github?.enabled ? chalk.green('on') : chalk.gray('off')}`
    )
    if (project) {
      const gs = getGitStatus(project.projectRoot)
      console.log('')
      if (gs.isGitRepo) {
        console.log(`  ${chalk.bold('Branch:')}  ${gs.branch}`)
        console.log(
          `  ${chalk.bold('Dirty:')}   ${gs.isDirty ? chalk.yellow('yes') : chalk.green('no')}`
        )
        console.log(
          `  ${chalk.bold('Remote:')}  ${gs.hasRemote ? chalk.green('yes') : chalk.yellow('no')}`
        )
        if (gs.aheadCount > 0)
          console.log(`  ${chalk.bold('Ahead:')}   ${chalk.yellow(gs.aheadCount)} commits`)
      } else {
        console.log(`  ${chalk.dim('Project is not a git repo')}`)
      }
    }
    console.log('')
    return
  }

  if (sub === 'checkpoint') {
    const project = loadProject()
    const root = args[1] || project?.projectRoot || process.cwd()
    const cfg = loadSyncConfig()
    info('Checkpointing...')
    try {
      const r = await gitCheckpoint(root, {
        message: 'manual checkpoint',
        push: cfg.github?.enabled && cfg.github?.projectSync,
      })
      if (r.success) ok(`Checkpoint: ${r.commitHash}${r.pushed ? ' (pushed)' : ''}`)
      else if (r.skipped) dim(`Skipped: ${r.reason}`)
      else die(`Failed: ${r.reason}`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  if (sub === 'push') {
    const project = loadProject()
    const root = args[1] || project?.projectRoot || process.cwd()
    info('Pushing to remote...')
    try {
      const r = await pushProject(root, { message: 'manual push' })
      if (r.success) ok(`Pushed: ${r.commitHash}`)
      else if (r.skipped) dim(`Skipped: ${r.reason}`)
      else die(`Failed: ${r.reason}`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  if (sub === 'on' || sub === 'off') {
    const cfg = loadSyncConfig()
    const feature = args[1]
    const validFeatures = ['smart-resume', 'git-checkpoint', 'github']
    if (!feature || !validFeatures.includes(feature)) {
      die(`Usage: ccm sync on|off <${validFeatures.join('|')}>`)
    }
    const keyMap = {
      'smart-resume': 'smartResume',
      'git-checkpoint': 'gitCheckpoint',
      github: 'github.enabled',
    }
    const key = keyMap[feature]
    const val = sub === 'on'
    if (key.includes('.')) {
      const [obj, prop] = key.split('.')
      cfg[obj][prop] = val
    } else {
      cfg[key] = val
    }
    saveSyncConfig(cfg)
    ok(`${feature}: ${sub}`)
    return
  }

  if (sub === 'checkpoints') {
    const checkpoints = listCheckpoints(args[1] || null)
    if (!checkpoints.length) {
      dim('No checkpoints yet.')
      return
    }
    console.log('')
    for (const cp of checkpoints.slice(0, 20)) {
      const date = new Date(cp.savedAt).toLocaleString()
      console.log(
        `  ${chalk.cyan(cp.account)}  ${chalk.dim(date)}  ${chalk.dim(cp.projectRoot || '')}`
      )
    }
    console.log('')
    return
  }

  if (sub === 'sessions') {
    const accountName = args[1]
    if (!accountName) die('Usage: ccm sync sessions <account-name>')
    try {
      const account = getAccount(accountName)
      const sessions = listSessionFiles(account)
      if (!sessions.length) {
        dim(`No sessions found for "${accountName}".`)
        return
      }
      console.log('')
      for (const s of sessions.slice(0, 20)) {
        const date = new Date(s.modifiedAt).toLocaleString()
        const kb = Math.round(s.sizeBytes / 1024)
        console.log(
          `  ${chalk.cyan(s.sessionId.slice(0, 12))}…  ${chalk.dim(date)}  ${chalk.dim(kb + 'kb')}`
        )
      }
      console.log('')
    } catch (e) {
      die(e.message)
    }
    return
  }

  console.log(`Usage:
  ccm sync status              Show sync configuration and git status
  ccm sync checkpoint          Create a git checkpoint now
  ccm sync push                Push current project to remote
  ccm sync on|off <feature>    Toggle: smart-resume, git-checkpoint, github
  ccm sync checkpoints [acct]  List local session checkpoints
  ccm sync sessions <account>  List Claude session files for an account`)
}

// ─── ccm ui ──────────────────────────────────────────────────────────────────
async function cmdUi() {
  const { render } = await import('ink')
  const React = (await import('react')).default
  const App = (await import('../screens/../App.js')).default
  const { waitUntilExit } = render(React.createElement(App, { args: [] }))
  await waitUntilExit()
}

// ─── help ─────────────────────────────────────────────────────────────────────
function cmdHelp() {
  console.log(`
${chalk.bold.cyan('ccm')} — Claude Code Manager

${chalk.bold('Usage:')}
  ccm                          Open interactive TUI dashboard
  ccm ui                       Same as above (explicit)

  ccm run [opts] [-- <flags>]  Run Claude Code with the active account
    --account, -a <n>       Override which account to use
    --no-auto-switch           Disable automatic account rotation on credit limit
    --no-resume                Don't attempt to --resume on account switch

  ccm switch <n>            Set the active account
  ccm login  <n>            Re-authenticate an email account (opens browser)
  ccm status                   Show active account, project, and git info

  ccm project init [account]   Initialise project in current directory
  ccm project bind <account>   Rebind project to a different account
  ccm project status           Show current project info

  ccm sync status              Show sync settings and git state
  ccm sync checkpoint          Create a git checkpoint right now
  ccm sync push                Push current project to GitHub
  ccm sync on  <feature>       Enable: smart-resume, git-checkpoint, github
  ccm sync off <feature>       Disable a feature
  ccm sync checkpoints         List local session backup checkpoints
  ccm sync sessions <account>  List Claude JSONL session files for an account

${chalk.bold('How smart resume works:')}
  When credits run out on Account A, ccm will:
    1. Create a git checkpoint (commit all changes)
    2. Copy Account A's Claude session JSONL to Account B's config directory
    3. Relaunch Claude with --resume <session-id> on Account B
    4. Claude picks up the conversation exactly where it left off

${chalk.bold('Phase 6 features:')}
  ccm compress [--dry-run]              Compress session context via Anthropic API
  ccm branch <list|create|delete>       Session branching from checkpoints
  ccm queue  <add|run|status|pause|clear>  Overnight unattended task queue
  ccm worker <list|stop>               Parallel named session workers
  ccm team   <init|sync|status|unlock>  Shared account pool via git repo
  ccm prompt <save|list|show|delete>    Named prompt template library
  ccm agent  [--port N]                Remote CCM agent with HMAC auth

${chalk.bold('Examples:')}
  ccm switch work
  ccm run
  ccm run -- --model claude-opus-4-5
  ccm run --account personal -- --dangerously-skip-permissions
  ccm sync on smart-resume
  ccm sync checkpoint
  ccm project init personal
`)
}

// ─── ccm account <sub> ────────────────────────────────────────────────────────
async function cmdAccount(args) {
  const sub = args[0]
  const name = args[1]

  if (sub === 'disable') {
    if (!name) die('Usage: ccm account disable <account-name>')
    try {
      getAccount(name)
      updateAccount(name, { disabled: true })
      ok(`"${name}" disabled — skipped during account rotation`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  if (sub === 'enable') {
    if (!name) die('Usage: ccm account enable <account-name>')
    try {
      getAccount(name)
      updateAccount(name, { disabled: false })
      ok(`"${name}" enabled — included in account rotation`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  if (sub === 'update') {
    if (!name) die('Usage: ccm account update <account-name> [--key sk-...] [--notes "..."]')
    const updates = {}
    for (let i = 2; i < args.length; i++) {
      if (args[i] === '--key' && args[i + 1]) {
        updates.apiKey = args[++i]
      }
      if (args[i] === '--notes' && args[i + 1]) {
        updates.notes = args[++i]
      }
    }
    if (Object.keys(updates).length === 0) {
      die('Nothing to update. Use --key <sk-...> or --notes "<text>"')
    }
    try {
      getAccount(name)
      if (updates.apiKey) {
        // Validate the new key before saving
        const { validateApiKey } = await import('@ccm/core')
        dim(`Validating new API key...`)
        const check = await validateApiKey(updates.apiKey)
        if (!check.valid) die(check.hint || `Invalid API key: ${check.reason}`)
      }
      updateAccount(name, updates)
      if (updates.apiKey) ok(`API key updated for "${name}"`)
      if (updates.notes) ok(`Notes updated for "${name}": ${updates.notes}`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  // ccm account (no subcommand) — show account list
  const accounts = listAccounts()
  if (!accounts.length) {
    dim('No accounts. Run: ccm account add (via ccm TUI)')
    return
  }
  console.log('')
  for (const a of accounts) {
    const dot = a.active ? chalk.green('●') : chalk.dim('○')
    const type = a.type === 'api_key' ? chalk.cyan('[api]') : chalk.magenta('[email]')
    const dis = a.disabled ? chalk.red(' disabled') : ''
    const note = a.notes ? chalk.dim(` — ${a.notes}`) : ''
    console.log(`  ${dot} ${chalk.white(a.name)} ${type}${dis}${note}`)
  }
  console.log('')
  console.log(chalk.dim('  ccm account disable <n>     Skip account in rotation'))
  console.log(chalk.dim('  ccm account enable  <n>     Re-include account'))
  console.log(chalk.dim('  ccm account update  <n> --key sk-...   Rotate API key'))
  console.log(chalk.dim('  ccm account update  <n> --notes "..."  Update notes'))
  console.log(chalk.dim('  ccm account stats                       Token usage per account'))
  console.log('')
}

// ─── ccm export ──────────────────────────────────────────────────────────────
async function cmdExport(args) {
  let passphrase = null
  let plain = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--passphrase' || args[i] === '-p') passphrase = args[++i]
    if (args[i] === '--plain') plain = true
  }

  if (!passphrase && !plain) {
    console.error(chalk.yellow('⚠  No --passphrase provided. Keys will be stored in plaintext.'))
    console.error(
      chalk.yellow('   Use: ccm export --passphrase <secret>  for a portable encrypted backup.')
    )
    console.error('')
  }

  try {
    const json = exportAccounts({ passphrase, plain: plain || !passphrase })
    process.stdout.write(json)
  } catch (e) {
    die(e.message)
  }
}

// ─── ccm import ──────────────────────────────────────────────────────────────
async function cmdImport(args) {
  const file = args[0]
  if (!file) die('Usage: ccm import <file>  [--passphrase <secret>]')

  let passphrase = null
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--passphrase' || args[i] === '-p') passphrase = args[++i]
  }

  let jsonStr
  try {
    const { readFileSync } = await import('fs')
    jsonStr = readFileSync(file, 'utf8')
  } catch {
    die(`Cannot read file: ${file}`)
  }

  try {
    const { imported, skipped, errors } = importAccounts(jsonStr, passphrase)
    if (imported > 0) ok(`Imported ${imported} account${imported !== 1 ? 's' : ''}`)
    if (skipped.length) skipped.forEach(s => dim(`  skipped: ${s}`))
    if (errors.length) errors.forEach(e => console.error(chalk.red(`  ✗ ${e}`)))
    if (imported === 0 && errors.length === 0) dim('Nothing to import.')
  } catch (e) {
    die(e.message)
  }
}

// ─── ccm hooks ───────────────────────────────────────────────────────────────
function cmdHooks(args) {
  const sub = args[0]
  if (sub === 'on') {
    registerHooks()
    ok('CCM hooks registered in ~/.claude/settings.json')
    return
  }
  if (sub === 'off') {
    unregisterHooks()
    ok('CCM hooks removed from ~/.claude/settings.json')
    return
  }
  // Default: show status
  const hooks = listRegisteredHooks()
  console.log('')
  for (const h of hooks) {
    const status = h.registered ? chalk.green('● on') : chalk.dim('○ off')
    console.log(`  ${status}  ${chalk.white(h.id)}`)
    console.log(`           ${chalk.dim(h.event + ' → ' + h.command)}`)
  }
  console.log('')
  dim('  ccm hooks on    Register all CCM hooks')
  dim('  ccm hooks off   Remove all CCM hooks')
  console.log('')
}

// ─── ccm serve ───────────────────────────────────────────────────────────────
async function cmdServe(args) {
  let port = 7837
  let shouldOpen = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port') port = parseInt(args[++i]) || 7837
    if (args[i] === '--open') shouldOpen = true
  }
  info(`Starting CCM dashboard on port ${port}...`)
  const server = startServer({ port, open: shouldOpen })
  info(`Dashboard: http://localhost:${port}/?token=${server.token}`)
  dim('Press Ctrl+C to stop.')
  // Keep process alive
  await new Promise(() => {})
}

// ─── ccm plugin ──────────────────────────────────────────────────────────────
function cmdPlugin(args) {
  const sub = args[0]
  const name = args[1]

  if (sub === 'disable' && name) {
    disablePlugin(name)
    ok(`Plugin "${name}" disabled`)
    return
  }
  if (sub === 'enable' && name) {
    enablePlugin(name)
    ok(`Plugin "${name}" enabled`)
    return
  }
  // Default: list
  const plugins = listPlugins()
  if (plugins.length === 0) {
    dim('No plugins installed. Place .js files in ~/.ccm/plugins/')
    return
  }
  console.log('')
  for (const p of plugins) {
    const status = p.disabled ? chalk.dim('○ disabled') : chalk.green('● enabled')
    console.log(`  ${status}  ${chalk.white(p.name)}`)
  }
  console.log('')
  dim('  ccm plugin disable <name>   Disable a plugin')
  dim('  ccm plugin enable  <name>   Enable a plugin')
  console.log('')
}

// ─── ccm compress ─────────────────────────────────────────────────────────────
async function cmdCompress(args) {
  const dryRun = args.includes('--dry-run')
  const project = loadProject()
  const account = getActiveAccount()
  if (!account) die('No active account')
  const session = findLatestSession(account, project?.projectRoot || process.cwd())
  if (!session) die('No session file found for current directory')

  dim(`Session: ${session.filePath}`)
  if (dryRun) dim('Dry run — no changes will be made')

  // Note: compressSession sends session content to the Anthropic API
  // Users should be aware their session text is transmitted for summarisation
  const result = await compressSession(session.filePath, account, {
    dryRun,
    explicitlyEnabled: true,
  })
  if (result.skipped) {
    if (result.reason === 'disabled') {
      console.log(
        chalk.yellow(
          'Compression is disabled by default — it sends session text to the Anthropic API.'
        )
      )
      console.log(chalk.dim('Enable it with: ccm sync on compression'))
    } else {
      dim(
        `Skipped: ${result.reason}${result.originalTokens ? ` (${result.originalTokens.toLocaleString()} tokens)` : ''}`
      )
    }
  } else if (result.dryRun) {
    info(
      `Would compress: ${result.messagesToSummarise} messages → summary + ${result.messagesToKeep} recent`
    )
    info(`Estimated tokens: ${result.originalTokens?.toLocaleString()} → much less`)
  } else {
    ok(
      `Compressed: ${result.originalTokens?.toLocaleString()} → ${result.newTokens?.toLocaleString()} tokens`
    )
    dim(`Original backed up to: ${result.backupPath}`)
  }
}

// ─── ccm branch ───────────────────────────────────────────────────────────────
function cmdBranch(args) {
  const sub = args[0]

  if (sub === 'create') {
    const checkpointId = args[1]
    const nameIdx = args.indexOf('--name')
    const name = nameIdx >= 0 ? args[nameIdx + 1] : null
    if (!checkpointId) die('Usage: ccm branch create <checkpoint-id> --name <n>')
    if (!name) die('Usage: ccm branch create <checkpoint-id> --name <n>')
    const account = getActiveAccount()
    const project = loadProject()
    try {
      createBranch(checkpointId, {
        name,
        account: account?.name,
        projectRoot: project?.projectRoot,
      })
      ok(`Branch "${name}" created from checkpoint ${checkpointId.slice(0, 8)}`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  if (sub === 'delete' && args[1]) {
    try {
      deleteBranch(args[1])
      ok(`Branch "${args[1]}" deleted`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  // Default: list
  const branches = listBranches()
  if (branches.length === 0) {
    dim('No branches. Use: ccm branch create <checkpoint-id> --name <n>')
    return
  }
  console.log('')
  for (const b of branches) {
    console.log(`  ${chalk.cyan(b.name)}`)
    console.log(
      `    ${chalk.dim('parent: ' + b.parentCheckpoint.slice(0, 8) + '  created: ' + b.createdAt.slice(0, 10))}`
    )
  }
  console.log('')
}

// ─── ccm queue ────────────────────────────────────────────────────────────────
async function cmdQueue(args) {
  const sub = args[0]

  if (sub === 'add') {
    const prompt = args.slice(1).join(' ').replace(/^"|"$/g, '')
    if (!prompt) die('Usage: ccm queue add "<prompt>"')
    const id = addTask(prompt)
    ok(`Task added: ${id.slice(0, 8)}`)
    return
  }

  if (sub === 'run') {
    info('Running task queue...')
    await runQueue({
      onTaskStart: t => dim(`→ ${t.name}`),
      onTaskComplete: t => ok(`✓ ${t.name}`),
      onTaskError: (t, e) => console.error(chalk.red(`✗ ${t.name}: ${e.message}`)),
    })
    ok('Queue complete')
    return
  }

  if (sub === 'clear') {
    clearQueue()
    ok('Queue cleared')
    return
  }
  if (sub === 'pause') {
    pauseQueue()
    dim('Queue paused after current task')
    return
  }

  // Default: status
  const tasks = listTasks()
  if (tasks.length === 0) {
    dim('Queue is empty. Add tasks: ccm queue add "<prompt>"')
    return
  }
  console.log('')
  for (const t of tasks) {
    const color =
      { pending: 'gray', running: 'cyan', done: 'green', failed: 'red' }[t.status] || 'gray'
    console.log(`  ${chalk[color](t.status.padEnd(8))}  ${chalk.white(t.name)}`)
  }
  console.log('')
}

// ─── ccm worker ───────────────────────────────────────────────────────────────
async function cmdWorker(args) {
  const sub = args[0]
  const name = args[1]

  if (sub === 'stop') {
    if (args[1] === '--all') {
      stopAllWorkers()
      ok('All workers stopped')
      return
    }
    if (!name) die('Usage: ccm worker stop <name>')
    stopWorker(name) ? ok(`Worker "${name}" stopped`) : die(`Worker "${name}" not found`)
    return
  }

  // Default: list
  const workers = listWorkers()
  if (workers.length === 0) {
    dim('No active workers. Start one: ccm run --worker <name>')
    return
  }
  console.log('')
  for (const w of workers) {
    const runtime = w.startedAt
      ? Math.round((Date.now() - new Date(w.startedAt)) / 60000) + 'm'
      : '?'
    console.log(
      `  ${chalk.cyan(w.name.padEnd(20))} ${chalk.white(w.account)}  ${chalk.dim(runtime)}`
    )
  }
  console.log('')
}

// ─── ccm team ─────────────────────────────────────────────────────────────────
async function cmdTeam(args) {
  const sub = args[0]

  if (sub === 'init') {
    const url = args[1]
    if (!url) die('Usage: ccm team init <git-repo-url>')
    try {
      initTeam(url)
      ok(`Team initialised with repo: ${url}`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  if (sub === 'sync') {
    try {
      syncTeam()
      ok('Team config synced')
    } catch (e) {
      die(e.message)
    }
    return
  }

  if (sub === 'unlock' && args[1]) {
    try {
      unlockTeamAccount(args[1])
      ok(`Lock released for "${args[1]}"`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  // Default: status
  try {
    const status = getTeamStatus()
    if (!status) {
      die('Team not initialised — run: ccm team init <repo-url>')
      return
    }
    if (status.locks.length === 0) {
      dim('All accounts free')
      return
    }
    console.log('')
    for (const l of status.locks) {
      console.log(
        `  ${chalk.yellow('locked')}  ${chalk.white(l.account)}  ${chalk.dim('by ' + l.user + ' since ' + l.lockedAt?.slice(0, 16))}`
      )
    }
    console.log('')
  } catch (e) {
    die(e.message)
  }
}

// ─── ccm prompt ───────────────────────────────────────────────────────────────
function cmdPrompt(args) {
  const sub = args[0]
  const name = args[1]

  if (sub === 'save') {
    const template = args.slice(2).join(' ').replace(/^"|"$/g, '')
    if (!name || !template) die('Usage: ccm prompt save <name> "<template>"')
    savePrompt(name, template)
    ok(`Prompt "${name}" saved`)
    return
  }

  if (sub === 'show' && name) {
    try {
      const p = getPrompt(name)
      console.log('')
      console.log(chalk.cyan(p.name))
      console.log(chalk.dim(p.template))
      console.log('')
    } catch (e) {
      die(e.message)
    }
    return
  }

  if (sub === 'delete' && name) {
    try {
      deletePrompt(name)
      ok(`Prompt "${name}" deleted`)
    } catch (e) {
      die(e.message)
    }
    return
  }

  // Default: list
  const prompts = listPrompts()
  if (prompts.length === 0) {
    dim('No prompts saved. Use: ccm prompt save <name> "<template>"')
    return
  }
  console.log('')
  for (const p of prompts) {
    console.log(`  ${chalk.cyan(p.name.padEnd(20))} ${chalk.dim(p.template.slice(0, 60))}`)
  }
  console.log('')
}

// ─── ccm agent ────────────────────────────────────────────────────────────────
async function cmdAgent(args) {
  let port = 7838
  let token = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port') port = parseInt(args[++i]) || 7838
    if (args[i] === '--token') token = args[++i]
  }
  info(`Starting CCM remote agent on port ${port}...`)
  const server = startAgentServer({ port, token })
  info(`Token: ${server.token}`)
  dim('Press Ctrl+C to stop.')
  await new Promise(() => {})
}

// ─── router ──────────────────────────────────────────────────────────────────
export async function runCli(cmd, args) {
  switch (cmd) {
    case 'account':
      return cmdAccount(args)
    case 'export':
      return cmdExport(args)
    case 'import':
      return cmdImport(args)
    case 'hooks':
      return cmdHooks(args)
    case 'serve':
      return cmdServe(args)
    case 'plugin':
      return cmdPlugin(args)
    case 'compress':
      return cmdCompress(args)
    case 'branch':
      return cmdBranch(args)
    case 'queue':
      return cmdQueue(args)
    case 'worker':
      return cmdWorker(args)
    case 'team':
      return cmdTeam(args)
    case 'prompt':
      return cmdPrompt(args)
    case 'agent':
      return cmdAgent(args)
    case 'run':
      return cmdRun(args)
    case 'switch':
      return cmdSwitch(args)
    case 'login':
      return cmdLogin(args)
    case 'status':
      return cmdStatus()
    case 'project':
      return cmdProject(args)
    case 'sync':
      return cmdSync(args)
    case 'checkpoint':
      return cmdSync(['checkpoint', ...args]) // shorthand
    case 'ui':
      return cmdUi()
    case 'help':
    case '--help':
    case '-h':
      return cmdHelp()
    default:
      cmdHelp()
      process.exit(1)
  }
}
