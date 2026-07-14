# Changelog

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
