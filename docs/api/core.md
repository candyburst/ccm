# @ccm/core API reference

The `@ccm/core` package exposes all CCM business logic. It has zero external dependencies — Node built-ins only.

## Install

```bash
npm install @ccm/core
```

## Accounts

```js
import { listAccounts, getActiveAccount, addApiKeyAccount, addEmailAccount,
         setActiveAccount, removeAccount, updateAccount, getApiKey } from '@ccm/core'
```

| Function | Returns | Description |
|---|---|---|
| `listAccounts()` | `Account[]` | All accounts |
| `getActiveAccount()` | `Account\|null` | Currently active account |
| `getAccount(name)` | `Account` | Throws if not found |
| `addApiKeyAccount(name, key, notes?)` | `Promise<Account>` | Validates key with Anthropic before saving |
| `addEmailAccount(name, email, notes?)` | `Account` | Creates session directory |
| `setActiveAccount(name)` | `void` | Set active account by name |
| `removeAccount(name)` | `void` | Remove account |
| `updateAccount(name, updates)` | `Account` | Update fields; re-encrypts key if `updates.apiKey` |
| `getApiKey(account)` | `string` | Decrypt and return API key |

## Runner

```js
import { runClaude, loginEmailAccount } from '@ccm/core'
```

```js
const result = await runClaude(account, args, {
  autoSwitch:      true,
  projectName:     'my-app',
  projectRoot:     '/Users/me/my-app',
  onSwitch:        (from, to) => console.log(`Switched: ${from} → ${to}`),
  onCheckpoint:    (result) => console.log('Checkpoint:', result.commitHash),
  onStdout:        (txt) => process.stdout.write(txt),
  resumeSessionId: null,
})
// result: { code, account, sessionId, tokens?, exhausted? }
```

## Watch mode

```js
import { watchClaude } from '@ccm/core'

await watchClaude(account, args, {
  ...runOpts,
  maxFailures: 5,       // stop after 5 consecutive non-credit failures
  onRestart: (attempt, delaySec) => console.log(`Restarting in ${delaySec}s`),
})
```

## Sessions

```js
import { getSessions, getSessionStats, clearSessions } from '@ccm/core'

getSessions({ limit: 50, account: 'personal', exitReason: 'credit_limit', from: '2026-01-01', to: '2026-12-31' })
getSessionStats()   // { total, totalSec, switches, byAccount }
```

## Projects

```js
import { initProject, bindProject, loadProject, scanAllProjects, ensureGitignore } from '@ccm/core'

initProject(dir, accountName, name?)  // creates .ccm-project.json
bindProject(dir, accountName)         // update account binding
loadProject(startDir?)                // walk up to find project file
scanAllProjects()                     // scan all configured roots
ensureGitignore(dir, { autoAdd })     // check/add .ccm-project.json to .gitignore
```

## Export / Import

```js
import { exportAccounts, importAccounts } from '@ccm/core'

const json = exportAccounts({ passphrase: 'secret', includeLog: false })
const { imported, skipped, errors } = importAccounts(json, 'secret')
```

## Hooks

```js
import { registerHooks, unregisterHooks, listRegisteredHooks } from '@ccm/core'

registerHooks()           // register all CCM hooks in ~/.claude/settings.json
unregisterHooks()         // remove all CCM hooks
listRegisteredHooks()     // [{ id, event, command, registered }]
```

## Web dashboard

```js
import { startServer } from '@ccm/core'

const { port, token, close } = startServer({ port: 7837, open: false })
// Access at http://localhost:7837/?token=<token>
close()
```

## Plugins

```js
import { loadPlugins, firePluginEvent, listPlugins } from '@ccm/core'

await loadPlugins()
await firePluginEvent('onSessionStart', { account: 'work', projectRoot: '/my-app' })
```
