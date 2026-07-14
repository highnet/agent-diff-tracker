# Contributing to Agent Diff Tracker

Thanks for your interest! This is a small, focused extension — contributions that keep it simple and reliable are very welcome.

## Development setup

```bash
git clone https://github.com/highnet/agent-diff-tracker.git
cd agent-diff-tracker
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded from source. Alternatively, `npm run reinstall` builds, packages, and installs the extension into your regular VS Code (reload the window afterwards).

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
- Update `CHANGELOG.md` under an "Unreleased" heading.
- No new runtime dependencies without prior discussion in an issue — the extension currently has zero, and packaging stays trivial because of it.

## Releases (maintainers)

1. Bump `version` in `package.json`, move "Unreleased" changelog entries under the new version.
2. Commit, tag `v<version>`, push the tag.
3. The `release` GitHub Action packages, publishes to the Marketplace, and attaches the `.vsix` to a GitHub release.
