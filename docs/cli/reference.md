# CLI reference

All CCM commands. Run `ccm help` for a quick reference in the terminal.

## ccm

Opens the interactive TUI dashboard.

## ccm run

```
ccm run [options] [-- <claude flags>]
```

Launch Claude Code with the active account.

| Option | Description |
|---|---|
| `--account, -a <n>` | Override which account to use |
| `--no-auto-switch` | Disable automatic account rotation |
| `--no-resume` | Don't attempt `--resume` on switch |
| `--watch` | Auto-restart on non-credit exits (crashes, network drops) |
| `--` | Pass remaining flags directly to `claude` |

## ccm switch

```
ccm switch <account-name>
```

Set the active account.

## ccm login

```
ccm login <account-name>
```

Re-authenticate an email account (opens browser).

## ccm status

Show active account, bound project, and git status.

## ccm account

```
ccm account [list]
ccm account add
ccm account disable <name>
ccm account enable  <name>
ccm account update  <name> [--key sk-ant-...] [--notes "..."]
ccm account stats
ccm account move    <name> up|down
```

## ccm project

```
ccm project init   [account]
ccm project bind   <account>
ccm project status
```

## ccm sync

```
ccm sync status
ccm sync checkpoint
ccm sync push
ccm sync on  <feature>     # smart-resume | git-checkpoint | github
ccm sync off <feature>
ccm sync checkpoints [account]
ccm sync sessions   <account>
ccm sync restore    <session-id>
```

## ccm export / import

```
ccm export [--passphrase <secret>]  > backup.json
ccm import backup.json [--passphrase <secret>]
```

Export all accounts to a JSON file. Keys are re-encrypted with the passphrase for portability.

## ccm hooks

```
ccm hooks           # show status
ccm hooks on        # register CCM hooks in ~/.claude/settings.json
ccm hooks off       # remove CCM hooks
```

## ccm serve

```
ccm serve [--port 7837] [--open]
```

Start the local read-only web dashboard.

## ccm plugin

```
ccm plugin list
ccm plugin disable <name>
ccm plugin enable  <name>
```

## ccm checkpoint

Shorthand for `ccm sync checkpoint`.
