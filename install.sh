#!/usr/bin/env bash
# Quick install for Linux & macOS (needs Node 18+).
#   curl -fsSL https://raw.githubusercontent.com/fire1/ailiak-cli/main/install.sh | bash
set -euo pipefail

REPO="${AILIAK_CLI_REPO:-fire1/ailiak-cli}"
REF="${AILIAK_CLI_REF:-main}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required. Install from https://nodejs.org then run this again." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 18+ is required (found $(node -v))." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required (usually comes with Node.js)." >&2
  exit 1
fi

echo "Installing ailiak from github:${REPO}#${REF} …"
# --include=dev so prepare can run tsc (TypeScript is a devDependency)
npm install -g --include=dev "github:${REPO}#${REF}"

echo
echo "Installed: $(command -v ailiak)"
ailiak --version
echo
echo "Next:"
echo "  ailiak auth set ailiak_YOUR_TOKEN"
echo "  Token: https://ailiak.com/studio/agents"
