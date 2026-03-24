# FAQ

**Why does `ccm run` say "Claude Code not found"?**

Install Claude Code first: `npm install -g @anthropic-ai/claude-code`. Then verify with `which claude`.

---

**Does CCM support models other than Claude?**

No. CCM manages Claude Code accounts — Claude Code is Anthropic's product. Non-Anthropic AI services are out of scope.

---

**What happens if the second account also runs out of credits?**

CCM tries every non-disabled account in priority order. When all are exhausted, it prints `[ccm] All accounts exhausted` and exits cleanly.

---

**Will my Claude conversation continue naturally after a switch?**

Yes — Claude loads the full session history via `--resume` and sees the entire conversation. In practice it picks up seamlessly.

---

**Does CCM store my API keys securely?**

Yes. Keys are encrypted with AES-256-GCM before writing to disk. See the [security guide](/guide/security) for full details.

---

**How do I move my accounts to a new machine?**

```bash
# Old machine
ccm export --passphrase mysecret > backup.json

# New machine
ccm import backup.json --passphrase mysecret
```

---

**Can two developers share the same Anthropic account?**

Use team mode: `ccm team init <git-repo-url>`. CCM uses file-based locks in a shared git repo to coordinate access.

---

**Does `ccm run --watch` restart on credit limit too?**

No. Credit limit → account switch is handled separately. Watch mode only restarts on non-credit exits (crashes, network drops, OOM kills).

---

**Where is my session history stored?**

`~/.ccm/session-log.json` — a JSON array of all CCM runs with account name, duration, exit reason, and token usage. No conversation content is stored here.

---

**My API key validation fails but the key is correct.**

Check `status.anthropic.com` for outages. Also verify the key starts with `sk-ant-` and hasn't been revoked at `console.anthropic.com/settings/keys`.
