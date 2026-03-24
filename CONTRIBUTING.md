# Contributing to CCM

Thanks for your interest in contributing. This guide covers everything you need to go from zero to a merged PR.

---

## Development setup

```bash
git clone https://github.com/candyburst/ccm.git
cd ccm
node --version   # must be 18.0.0 or higher
npm install
npm link --workspace=packages/tui   # makes `ccm` available globally
```

Run the Electron app in dev mode:
```bash
npm run app
```

Run the TUI:
```bash
ccm
```

---

## Project structure

```
packages/
  core/   @ccm/core — all business logic, no UI, no dependencies outside Node built-ins
  tui/    @ccm/tui  — Ink terminal UI + headless CLI
  app/    @ccm/app  — Electron + React desktop app
```

**The rule:** if it touches a file, network, or process — it belongs in `core`. If it displays something — it belongs in `tui` or `app`. Never mix them.

---

## Code style

CCM uses ESLint and Prettier. Both configs are committed to the repo root.

Before committing:
```bash
npx eslint packages/ --max-warnings 0
npx prettier --check packages/
```

Auto-fix formatting:
```bash
npx prettier --write packages/
```

Key conventions:
- ESM throughout (`"type": "module"`) except `electron/main.js` which is CJS
- No `class` — plain exported functions only
- No `console.log` in production paths — use `process.stderr.write('[ccm] ...')` or the `debug()` helper
- Every `async` function that can fail must have error handling at the call site
- All file paths through `path.join()` — never string concatenation

---

## Commit messages

CCM uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add ccm account update command
fix: prevent accounts.json corruption on crash
security: strip CCM_SECRET from Claude subprocess env
docs: update BUILD.md with portable build instructions
chore: pin all dependency versions
test: add crypto.js round-trip tests
```

One logical change per commit. If your PR touches three things, use three commits.

---

## Adding a new Anthropic account type

CCM supports the two auth methods that Claude Code supports: **Anthropic API key** and **Email OAuth**.
If Anthropic adds official Claude Code support for a new Anthropic backend, add it here:

1. Add the account type to `PROVIDERS` in `core/config.js`
2. Add an env-builder case in `core/providers.js` `buildProviderEnv()`
3. Add any provider-specific credit-limit error patterns to `CREDIT_PATTERNS` in `core/config.js`
4. Add the option to `AddAccount` in both `tui/src/screens/AddAccount.js` and `app/src/pages/AddAccount.jsx`
5. Update `DEVELOPMENT.md` and `docs/configuration.md`

**Note:** CCM is for Claude Code (Anthropic's CLI tool) only. Do not add support for non-Anthropic AI services.

---

## Pull request checklist

Before opening a PR, confirm:

- [ ] `eslint --max-warnings 0` passes
- [ ] `prettier --check` passes
- [ ] All existing tests still pass (`npm test` when test suite is available)
- [ ] New behaviour has tests (for `@ccm/core` changes)
- [ ] Tested manually on at least one platform (note which in the PR description)
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] Docs updated if a command, flag, or setting changed

---

## Reporting bugs

Use the GitHub issue template. Include your OS, Node version, Claude Code version, and the exact command and output that triggered the problem.

## Suggesting features

Open a discussion or use the feature request issue template. Describe the problem you're trying to solve, not just the solution.
