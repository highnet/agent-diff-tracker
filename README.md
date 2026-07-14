# Agent Diff Tracker

Watches your workspace for file changes and automatically opens a diff view (working tree vs. last git commit) for the files your AI coding agent just touched — so you can see what it did without hunting through the file tree.

Works with any agent (Claude Code, Cursor, Copilot agent mode, a background script, whatever) since it just reacts to files changing on disk — no agent-specific integration needed.

## How it works

- Watches all files in the workspace (excluding `node_modules`, `.git`, build output, etc. — configurable, plus a hard-coded safety exclude for common noisy directories).
- Groups files that change within a short debounce window into one batch, so a single agent turn that touches several files is treated together rather than as N separate flickers.
- Auto-opens a diff editor (HEAD vs. working tree) for each file in the batch, up to `maxAutoOpenFiles`. If more files changed than that, the rest are still recorded in the **Change History** sidebar.
- **Change History** view (its own icon in the activity bar) lists recent changes — click any entry to reopen its diff on demand, even after the auto-opened tab is gone.
- Optional burst filtering: set `minBurstFilesToAutoOpen` above 1 to skip auto-opening for lone, single-file edits (useful if you also edit manually and only want auto-popups for agent-style multi-file bursts) — those edits still land in history.
- Status bar item shows what's being watched; click it to pause/resume.

## Requirements

- The built-in VS Code Git extension enabled (used to resolve the `HEAD` version of files for the diff).
- Files outside a git repo, or untracked new files, open the plain file instead of a diff (no baseline to compare against).

## Commands

- `Agent Diff Tracker: Toggle Watching` — pause/resume.
- `Agent Diff Tracker: Show Latest Changed File Diff` — re-open the diff for the last detected change.
- `Agent Diff Tracker: Clear History` — empty the Change History sidebar.

## Settings

- `agentDiffTracker.debounceMs` (default `400`)
- `agentDiffTracker.exclude` (default excludes `node_modules`, `.git`, `dist`, `out`, `.next`, `build`)
- `agentDiffTracker.preserveFocus` (default `true`)
- `agentDiffTracker.minBurstFilesToAutoOpen` (default `1`)
- `agentDiffTracker.maxAutoOpenFiles` (default `4`)
- `agentDiffTracker.maxHistoryEntries` (default `50`)

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

## Packaging / installing locally

```bash
npx @vscode/vsce package --allow-missing-repository --skip-license
code --install-extension agent-diff-tracker-<version>.vsix
```

Then run **Developer: Reload Window** in VS Code — installing a `.vsix` while a window is open updates the files on disk, but the running extension host keeps the old code until reloaded.
