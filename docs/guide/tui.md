# TUI guide

The CCM TUI is a keyboard-driven terminal interface. Run `ccm` with no arguments to open it.

## Tab order

`Tab` cycles through all screens in this order:

```
Dashboard → Run → Projects → Sessions → Sync → Settings
```

Press `Esc` to go back one level, or `q` from the Dashboard to quit.

## Screens

### Dashboard

The home screen. Shows all accounts with their status.

| Key | Action |
|---|---|
| `↑` / `↓` | Select account |
| `Enter` | Set selected account as active |
| `a` | Add account (goes to Add Account screen) |
| `d` | Toggle disable / enable selected account |
| `q` | Quit CCM |

### Run

Launch a Claude Code session.

| Key | Action |
|---|---|
| `↑` / `↓` | Select account |
| `Enter` | Confirm account, move to flags input |
| `Enter` (flags) | Launch session |
| `Esc` | Go back one step |

After launch, Claude Code takes over the terminal. CCM resumes when the session exits.

### Add Account

Step-by-step wizard to add an Anthropic API key or email account.

| Key | Action |
|---|---|
| Type | Enter account name, key, email, or notes |
| `Enter` | Confirm current field and advance |
| `Esc` | Go back one step |

### Projects

Shows all CCM-managed projects found in your scan roots.

| Key | Action |
|---|---|
| `↑` / `↓` | Select project |
| `b` | Rebind selected project to a different account |
| `r` | Refresh project list |
| `Esc` | Back to Dashboard |

### Sessions

History of every CCM session.

| Key | Action |
|---|---|
| `↑` / `↓` | Scroll through sessions |
| `j` / `k` | Vim-style scroll |
| `r` | Cycle reason filter: all → normal → credit_limit → exhausted → error → interrupted |
| `c` | Clear all history (prompts for confirmation) |
| `y` / `n` | Confirm or cancel clear |
| `Esc` | Back |

### Sync

Configure and trigger git checkpoints and GitHub sync.

| Key | Action |
|---|---|
| `c` | Run a git checkpoint now |
| `p` | Push to remote |
| `Esc` | Back |

### Settings

Toggle behaviour settings.

| Key | Action |
|---|---|
| `↑` / `↓` | Select toggle |
| `Enter` / `Space` | Toggle on/off |
| `Esc` | Back |
