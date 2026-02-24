#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/sharetech-labs/nextjs-architecture-skills.git"
GLOBAL=false

for arg in "$@"; do
  case "$arg" in
    --global) GLOBAL=true ;;
  esac
done

if [ "$GLOBAL" = true ]; then
  TARGET="$HOME/.claude/skills"
else
  TARGET="$(pwd)/.claude/skills"
fi

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo ""
echo "Cloning Next.js Claude skills..."
git clone --depth 1 --quiet "$REPO" "$TMPDIR/repo"

mkdir -p "$TARGET"

INSTALLED=0

if [ "$GLOBAL" = true ]; then
  echo "Installing globally to $TARGET"
else
  echo "Installing to project at $TARGET"
fi
echo ""

for skill_dir in "$TMPDIR/repo/skills"/*/; do
  skill_name="$(basename "$skill_dir")"
  cp -r "$skill_dir" "$TARGET/$skill_name"
  echo "  + $skill_name"
  INSTALLED=$((INSTALLED + 1))
done

echo ""
echo "Done! $INSTALLED skills installed."
echo ""
echo "Skills are auto-activated by Claude Code based on your prompts."
echo "No additional configuration needed."
echo ""
