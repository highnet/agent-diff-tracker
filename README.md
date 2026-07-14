# Agent Diff Tracker

[![CI](https://github.com/highnet/agent-diff-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/highnet/agent-diff-tracker/actions/workflows/ci.yml)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Agent%20Diff%20Tracker-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=JoaquinTelleria.agent-diff-tracker)

**Watch what your AI coding agent is doing, as it does it.**

📦 [**Install from the VS Code Marketplace**](https://marketplace.visualstudio.com/items?itemName=JoaquinTelleria.agent-diff-tracker)

Agent Diff Tracker watches your workspace and automatically opens a diff view (working tree vs. last git commit) for every file that changes — so when Claude Code, Cursor, Copilot, or any other agent edits your code, the diff is already on screen, scrolled to the first changed line. No hunting through the file tree, no guessing what just happened.

It's agent-agnostic by design: it reacts to files changing on disk, so it works with **any** tool — AI agents, codegen scripts, formatters, a teammate over SSH — with zero integration or configuration.

## Features

- **One diff tab, always the latest edit** — every change opens the same reusable diff tab (`HEAD ↔ working tree`), jumped to the first edited line, without stealing your keyboard focus. The next change replaces it, so you're never hunting through a pile of stale diff tabs. Want to keep one around? Pin the tab (right-click → Pin, or `Cmd/Ctrl+K Enter`) and the next auto-open opens a fresh tab instead of touching it.
- **Burst batching** — files changed together (one agent turn) are treated as one batch and recorded together in history; the diff tab shows the last file in the burst. A debounce window keeps rapid rewrites from flickering.
- **Change History sidebar** — an activity-bar view of recent change bursts: each burst (one agent turn) is a collapsible group of the files it touched, stamped with a relative time. Click any file to reopen its diff in that same reusable tab.
- **Manual-edit filtering (optional)** — set `minBurstFilesToAutoOpen` to `2+` and lone single-file saves (usually you typing) stop auto-opening, while multi-file agent bursts still do. Everything is still recorded in history.
- **Sensible noise filtering** — build output, caches, and dependency directories across ecosystems (Node, Python, Rust, Go, Java, Ruby, .NET, Swift, Elixir, Terraform, and more) are excluded out of the box, with a hard safety net for the worst offenders (`.git`, `node_modules`, `__pycache__`, `target`, `Pods`, `*.tsbuildinfo`, `*.log`, …) that user config can't accidentally disable.
- **One-click pause** — the status bar eye shows what was last touched; click it to pause/resume watching.

## Requirements

- The built-in VS Code Git extension (used to resolve the `HEAD` side of each diff).
- Untracked/new files and files outside a git repo open normally instead of as a diff — there's no baseline to compare against.

## Commands

| Command | What it does |
| --- | --- |
| `Agent Diff Tracker: Toggle Watching` | Pause/resume (same as clicking the status bar item) |
| `Agent Diff Tracker: Show Latest Changed File Diff` | Reopen the diff for the most recent change |
| `Agent Diff Tracker: Clear History` | Empty the Change History view |

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `agentDiffTracker.debounceMs` | `400` | Quiet window that groups rapid changes into one batch (clamped to 50–10000) |
| `agentDiffTracker.exclude` | ~70 patterns | Globs to ignore; covers common build/cache/dependency dirs across ecosystems |
| `agentDiffTracker.preserveFocus` | `true` | Keep your cursor where it is when diffs auto-open |
| `agentDiffTracker.minBurstFilesToAutoOpen` | `1` | Only auto-open when at least N files change together |
| `agentDiffTracker.maxHistoryEntries` | `50` | History length |

## FAQ

**What about brand-new files?**
Untracked files diff against an empty baseline, so they open as an all-added diff in the same labeled tab style as everything else.

**It's ignoring a file I care about.**
Check whether it lives under a hard-excluded directory (`dist`, `build`, `vendor`, …). Those are intentional: agents and build tools write there constantly and the noise would drown the signal. Source files outside those directories are always watched unless your `exclude` globs say otherwise.

**Does it work without an AI agent?**
Yes — it has no idea what changed your files. Formatters, git checkouts, scripts, and teammates all show up the same way.

## Development

```bash
npm install
npm run compile      # build
npm test             # unit + VS Code integration tests
npm run reinstall    # build, package, and install into your local VS Code
```

Press `F5` in VS Code for an Extension Development Host with live source. See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture rules and the release process.
