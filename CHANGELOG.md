# Changelog

## [0.4.1](https://github.com/highnet/agent-diff-tracker/compare/v0.4.0...v0.4.1) (2026-07-14)


### Bug Fixes

* exclude graphify-out at any depth so its cache/index files never open a diff ([bbdcd2c](https://github.com/highnet/agent-diff-tracker/commit/bbdcd2c66b30137cb0d09a2ab25f7d3017a84bd0))

## 0.4.0

- Brand-new (untracked) files now open as an all-added diff against an empty baseline — every change gets the same labeled "(Agent Diff Tracker)" tab, no more bare editor tabs.
- Editing an already-open file re-aims the cursor at the first changed line, surviving VS Code's asynchronous document reload.
- Removed the focus-steal/restore approach to diff navigation — it could hide or replace the diff tab it had just opened (including spawning unlabeled duplicate tabs). Cursor aiming now uses the editor API on unfocused editors.
- History view is now organized by actual change bursts (one entry per agent turn) instead of Today/Yesterday/Earlier day buckets; single-file bursts render flat, multi-file bursts as collapsible groups.
- Repository, CI (unit + integration on Linux and macOS), tag-driven Marketplace release workflow, dependabot, contribution docs, code of conduct, security policy.
- Test suite: 63 tests (53 unit + 10 integration), including regressions for every bug above.

## 0.3.0

- New icon: an eye with a diff-colored iris (marketplace PNG) plus a proper monochrome SVG for the activity bar so it recolors with your theme.
- History view polish: entries grouped by Today / Yesterday / Earlier, per-file-type icons, folder context in descriptions, timestamps that refresh every minute, and days ("2d ago") past 24 hours.
- History clicks and "Show Latest" now open persistent tabs focused on the diff, instead of reusing one preview tab that each click replaced.
- Fixed "Show Latest Changed File Diff" reporting "no changes seen yet" after a batch had already flushed.
- Rewrote the glob matcher as a single-pass compiler — exclude patterns containing text resembling internal placeholder tokens can no longer be corrupted.
- Config hardening: nonsense settings values (negative, zero, NaN, fractional) are clamped instead of silently misbehaving; debounce is bounded to 50ms–10s.
- Empty-history welcome message explaining what the view does.
- Test suite: 40 unit tests plus an 8-test VS Code integration suite that exercises real file changes against a fixture git repo.

## 0.2.2

- Default `exclude` list expanded to cover build/cache/dependency directories across Node, Python, Java/Kotlin, Go, Rust, Ruby, PHP, .NET, Swift/Xcode, Elixir, Terraform, plus common editor/OS cruft (`.idea`, `.DS_Store`, etc.).
- Hard-coded safety-net excludes (applied regardless of user config) expanded similarly: `__pycache__`, `.venv`, `target`, `.gradle`, `vendor`, `Pods`, `DerivedData`, `.terraform`, `.idea`, plus suffixes `.pyc`, `.class`, `.o`, `.obj`.

## 0.2.1

- `.tsbuildinfo` and `.log` files are now hard-excluded regardless of the `exclude` setting.
- Diffs now jump to the first actual changed line instead of opening at the top of the file.

## 0.2.0

- Added a "Change History" sidebar (activity bar icon) listing recent changed files; click any entry to reopen its diff.
- Multi-file batches: when several files change together (an agent's burst), auto-open diffs for up to `maxAutoOpenFiles` of them instead of only the last one.
- Added `minBurstFilesToAutoOpen` to optionally suppress auto-open for lone/manual single-file edits, while still recording them in history.
- Fixed a bug where the exclude-glob matcher's placeholder substitution corrupted patterns like `**/.next/**`, causing diffs to be attempted (and fail) against build/cache/git-internal files.
- Added `.next`, `.impeccable`, `dist`, `out`, and `build` as hard-coded excluded path segments regardless of user config.

## 0.1.0

- Fixed exclude-glob matching for root-level `node_modules`/`.git` paths.
- Diffs are only opened for files with a git `HEAD` baseline; untracked files just open normally instead of erroring.

## 0.0.1

- Initial release: watches the workspace and auto-opens a diff (HEAD vs. working tree) for the most recently changed file.
