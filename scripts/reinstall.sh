#!/usr/bin/env bash
# Rebuilds the extension from current source, packages it, and reinstalls it into
# the `code` CLI's VS Code so local edits actually take effect. Does NOT publish
# to the Marketplace and does NOT bump the version.
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

echo
echo "Done. Reload the window to pick it up: Cmd+Shift+P -> \"Developer: Reload Window\"."
