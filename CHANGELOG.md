# Changelog

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
