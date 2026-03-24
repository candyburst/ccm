# Watch mode

Watch mode automatically restarts Claude Code when it exits unexpectedly — network drops, crashes, OOM kills. It does not restart on credit limits (that's handled by auto-switch).

## Usage

```bash
ccm run --watch
```

## Backoff schedule

CCM waits before each restart to avoid hammering a broken state:

| Attempt | Wait |
|---|---|
| 1 | 1 second |
| 2 | 2 seconds |
| 3 | 4 seconds |
| 4 | 8 seconds |
| 5 | 16 seconds |
| 6+ | 30 seconds (cap) |

## Stop conditions

Watch mode stops when:
- Claude exits with code 0 (clean exit)
- All accounts are exhausted
- **5 consecutive failures within 2 minutes** — something is persistently broken

The failure counter resets if more than 2 minutes pass between failures.

## Resume on restart

Every restart attempts `--resume` with the previous session ID. If the session JSONL is available, Claude picks up where it left off.

## kill -9 recovery

If the Claude process is killed with `kill -9`, `ccm run --watch` treats this as a non-credit failure and restarts automatically after the backoff delay.
