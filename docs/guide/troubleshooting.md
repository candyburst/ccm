---
head:
  - - script
    - type: application/ld+json
    - '{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Why does ccm run say Claude Code not found?",
            "acceptedAnswer": { "@type": "Answer", "text": "Install Claude Code first: npm install -g @anthropic-ai/claude-code. Then verify with: which claude" }
          },
          {
            "@type": "Question",
            "name": "Why did --resume not work and Claude started fresh?",
            "acceptedAnswer": { "@type": "Answer", "text": "Check that CLAUDE_CONFIG_DIR is honoured by your Claude Code version. Run: CLAUDE_CONFIG_DIR=/tmp/test claude --version then ls /tmp/test. If empty, update Claude Code." }
          },
          {
            "@type": "Question",
            "name": "How do I move accounts to a new machine?",
            "acceptedAnswer": { "@type": "Answer", "text": "On the old machine: ccm export --passphrase mysecret > backup.json. On the new machine: ccm import backup.json --passphrase mysecret" }
          }
        ]
      }'
---

# Troubleshooting

Solutions to the most common CCM issues.

## "Claude Code not found"

```bash
npm install -g @anthropic-ai/claude-code
which claude        # should print a path
claude --version
```

## "Account not found"

You haven't added any accounts yet, or the name is wrong.

```bash
ccm status          # see all accounts
ccm account add     # add one
```

## --resume didn't work / Claude started fresh

This happens when the session JSONL can't be found in the new account's config directory.

1. Check `CCM_DEBUG=1 ccm run` for session transfer logs
2. Verify `CLAUDE_CONFIG_DIR` is respected by your Claude Code version:
   ```bash
   CLAUDE_CONFIG_DIR=/tmp/test claude --version
   ls /tmp/test    # should have files
   ```
3. If empty: update Claude Code — `npm update -g @anthropic-ai/claude-code`

## API key validation fails

- Key must start with `sk-ant-` — get yours at console.anthropic.com/settings/keys
- Check your internet connection
- Check status.anthropic.com for outages

## "Cannot decrypt API key — key may be from a different machine"

Your `accounts.json` was copied from another machine without also copying `~/.ccm/.key`.

Fix: export on the old machine with a passphrase, import on the new machine:

```bash
# Old machine
ccm export --passphrase mysecret > backup.json

# New machine
ccm import backup.json --passphrase mysecret
```

## Electron app is blank / shows "localhost refused"

The Vite dev server didn't start in time. In `packages/app/package.json`, increase the timeout:

```json
"dev": "concurrently \"vite\" \"wait-on http://localhost:5173 --timeout 90000 && electron .\""
```

## macOS: "CCM is damaged and can't be opened"

Gatekeeper blocked an unsigned build:

```bash
xattr -cr /Applications/CCM.app
```

Or download a notarised build from the GitHub Releases page.
