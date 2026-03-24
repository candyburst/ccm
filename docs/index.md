---
layout: home
head:
  - - script
    - type: application/ld+json
    - '{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "CCM", "item": "https://candyburst.github.io/ccm/" }
        ]
      }'

title: CCM — Claude Code Manager
description: Manage multiple Claude Code accounts. Auto-switch on credit limits. Resume exactly where you left off.

hero:
  name: CCM
  text: Claude Code Manager
  tagline: Zero-downtime Claude Code sessions.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/candyburst/ccm

features:
  - title: Auto-switch on credit limits
    details: When credits run out on one account, CCM automatically switches to the next and resumes the session — no human required.
  - title: Smart session resume
    details: CCM copies your session JSONL to the new account and relaunches with --resume. Claude picks up exactly where it left off.
  - title: Multiple interfaces
    details: Use the keyboard-driven TUI, the Electron desktop app, or the headless CLI — all backed by the same core.
  - title: Git checkpoints
    details: Every account switch triggers a git commit so your work is always saved before any transition.
---
