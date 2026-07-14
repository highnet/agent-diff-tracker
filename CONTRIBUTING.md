# Contributing to Agent Diff Tracker

Thanks for your interest! This is a small, focused extension — contributions that keep it simple and reliable are very welcome.

## Development setup

```bash
git clone https://github.com/highnet/agent-diff-tracker.git
cd agent-diff-tracker
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded from source. Alternatively, `npm run reinstall` builds, packages, and installs the extension into your regular VS Code — on macOS it also reloads the window automatically (`scripts/reinstall.sh` drives this via AppleScript: opens the command palette, runs "Developer: Reload Window"), so the loop is just edit → `npm run reinstall` → try it, no manual reload step. On other platforms it prints a reminder to reload manually instead.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/extension.ts` | Activation, file watcher, diff opening — the only file that touches the `vscode` API heavily |
| `src/matching.ts` | Glob → regex compiler and exclude logic (pure) |
| `src/batchPlan.ts` | Burst/auto-open policy and config clamping (pure) |
| `src/burstHistory.ts` | History data structure (pure) |
| `src/firstChange.ts` | First-changed-line computation (pure) |
| `src/timeAgo.ts` | Relative time formatting (pure) |
| `src/historyProvider.ts` | Tree view over `burstHistory` |
| `test/unit/` | Mocha unit tests for every pure module |
| `test/integration/` | `@vscode/test-electron` suite — real VS Code, real file changes, real git repo (generated per run) |

**Design rule:** logic lives in pure modules with unit tests; `extension.ts` stays a thin shell. If you're adding behavior, add it as a pure function first, test it, then wire it up.

## Running tests

```bash
npm run test:unit          # fast, pure-logic tests
npm run test:integration   # downloads VS Code on first run, launches it headlessly
npm test                   # both
```

Every bug fix needs a test that fails without the fix. The integration suite exists because several past bugs (focus stealing, preview-tab replacement, stale-document races) were invisible to unit tests.

## Pull requests

- Keep PRs focused — one behavior change per PR.
- `npm test` must pass.
- **Use [Conventional Commits](https://www.conventionalcommits.org)** — releases are automated from commit messages:
  - `fix: ...` → patch release
  - `feat: ...` → minor release
  - `feat!: ...` or a `BREAKING CHANGE:` footer → major release
  - `chore:`/`docs:`/`test:`/`refactor:` → no release
- No new runtime dependencies without prior discussion in an issue — the extension currently has zero, and packaging stays trivial because of it.

## Releases (maintainers)

Releases are fully automated via [release-please](https://github.com/googleapis/release-please):

1. Merge conventional-commit PRs into `main` as usual.
2. release-please maintains a running **release PR** that accumulates the version bump and changelog entries.
3. Merging that release PR cuts the tag and GitHub release; the same workflow then runs the full test suite, publishes to the VS Code Marketplace (`VSCE_PAT` secret), and attaches the `.vsix`.

`CHANGELOG.md` is generated from commit messages — don't edit it by hand. The tag-triggered `release` workflow remains as a fallback for manually pushed `v*` tags.
