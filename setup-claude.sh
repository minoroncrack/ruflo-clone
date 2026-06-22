#!/bin/bash
# Run this once on any machine to install ruflo agents/skills globally for Claude Code

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.claude"

mkdir -p "$TARGET"

echo "Installing ruflo agents and skills to $TARGET..."
cp -r "$REPO_DIR/.claude/agents" "$TARGET/"
cp -r "$REPO_DIR/.claude/skills" "$TARGET/"
cp -r "$REPO_DIR/.claude/commands" "$TARGET/"

echo "Done. Ruflo agents and skills are now available in all your Claude Code projects."
