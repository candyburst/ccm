# Export and import accounts

Move accounts between machines or back them up with `ccm export` and `ccm import`.

## Export

```bash
# Encrypted (recommended) — keys re-encrypted with your passphrase
ccm export --passphrase mysecretphrase > backup.json

# Plaintext — includes API keys in the clear
ccm export --plain > backup.json
```

When no `--passphrase` is provided, CCM prints a warning and exports keys as plaintext.

## What's included

- All account names, types, emails, notes, priorities, and disabled states
- API keys — either re-encrypted with your passphrase, or in plaintext
- Session history is excluded by default (use `--include-log` if you want it)
- Accounts are never exported as `active` — you set the active account after import

## Import

```bash
ccm import backup.json --passphrase mysecretphrase
```

On the new machine, CCM:
1. Decrypts each key using your passphrase
2. Re-encrypts it using the new machine's key
3. Saves the account — inactive by default

```bash
# After import, set your active account
ccm switch work
```

## Cross-machine restore workflow

```bash
# Old machine
ccm export --passphrase secret123 > backup.json

# New machine
npm install -g ccm
ccm import backup.json --passphrase secret123
ccm status          # verify accounts imported
ccm switch work     # set active
ccm run             # start a session
```

## Errors

| Error | Cause | Fix |
|---|---|---|
| `wrong passphrase or corrupted key` | Wrong passphrase used on import | Use the same passphrase as export |
| `already exists` | Account name matches existing account | Remove or rename the existing account first |
| `newer version` | Export file from a newer CCM version | Update CCM and re-import |
