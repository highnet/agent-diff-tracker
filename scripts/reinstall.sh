#!/usr/bin/env bash
# Rebuilds the extension from current source, packages it, reinstalls it into the
# `code` CLI's VS Code, and (on macOS) reloads the window automatically — a poor
# man's hot-reload loop for iterating on the extension itself. Does NOT publish to
# the Marketplace and does NOT bump the version.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PKG_VERSION=$(node -p "require('./package.json').version")
VSIX_NAME="agent-diff-tracker-${PKG_VERSION}.vsix"

echo "==> Compiling"
npm run compile

echo "==> Packaging ${VSIX_NAME}"
rm -f agent-diff-tracker-*.vsix
npx --yes @vscode/vsce package --allow-missing-repository --skip-license >/dev/null

echo "==> Installing ${VSIX_NAME}"
code --install-extension "${VSIX_NAME}"

if [[ "$(uname)" == "Darwin" ]] && osascript -e 'id of application "Visual Studio Code"' >/dev/null 2>&1; then
  echo "==> Reloading VS Code window"
  osascript <<'APPLESCRIPT'
tell application "Visual Studio Code" to activate
delay 0.3
tell application "System Events"
  keystroke "p" using {command down, shift down}
  delay 0.4
  keystroke "Developer: Reload Window"
  delay 0.4
  key code 36
end tell
APPLESCRIPT
  echo "Done — reloaded automatically."
else
  echo
  echo "Done. Reload the window manually to pick it up: Cmd+Shift+P -> \"Developer: Reload Window\"."
fi
