# Security Policy

## Supported versions

Only the latest published version receives fixes.

## Reporting a vulnerability

Please open a [private security advisory](https://github.com/highnet/agent-diff-tracker/security/advisories/new) on GitHub rather than a public issue. You should receive a response within a week.

## Scope notes

This extension runs entirely locally: it watches workspace files, reads git baselines through VS Code's built-in Git extension, and opens editor tabs. It makes no network requests, executes no workspace code, and has no runtime dependencies.
