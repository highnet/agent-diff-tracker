# Agent Diff Tracker

Watches your workspace for file changes and automatically opens a diff view (working tree vs. last git commit) for the most recently modified file — so you can see what your AI coding agent just did without hunting through the file tree.

## How it works

- Watches all files in the workspace (excluding `node_modules`, `.git`, build output, etc. — configurable).
- On each change, after a short debounce (to avoid flicker when an agent writes several files at once), opens a diff editor for the changed file: HEAD version vs. current working tree.
- Each new change replaces the previous diff tab (uses a preview tab), so you always land on the latest edit.
- Status bar item shows what's being watched; click it to pause/resume.

## Requirements

- The built-in VS Code Git extension enabled (used to resolve the `HEAD` version of files for the diff).
- Files outside a git repo, or untracked new files, will open the plain file instead of a diff (no baseline to compare against).

## Commands

- `Agent Diff Tracker: Toggle Watching` — pause/resume.
- `Agent Diff Tracker: Show Latest Changed File Diff` — re-open the diff for the last detected change.

## Settings

- `agentDiffTracker.debounceMs` (default `400`)
- `agentDiffTracker.exclude` (default excludes `node_modules`, `.git`, `dist`, `out`, `.next`, `build`)
- `agentDiffTracker.preserveFocus` (default `true`)

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.
