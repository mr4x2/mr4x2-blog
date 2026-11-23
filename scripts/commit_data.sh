#!/usr/bin/env bash
# Usage: commit_data.sh <path> <message>
set -euo pipefail

path=$1
message=$2

# `git diff` ignores untracked files, so every change check uses status.
if [ -z "$(git status --porcelain -- "$path")" ]; then
  echo "$path unchanged"
  exit 0
fi

aside=$(mktemp -d)
trap 'rm -rf "$aside"' EXIT
cp "$path" "$aside/data"

git config user.name "github-actions[bot]"
git config user.email "41898283+github-actions[bot]@users.noreply.github.com"

for attempt in 1 2 3 4 5; do
  git fetch origin main
  git reset --hard origin/main
  mkdir -p "$(dirname "$path")"
  cp "$aside/data" "$path"
  if [ -z "$(git status --porcelain -- "$path")" ]; then
    echo "$path unchanged"
    exit 0
  fi
  git add -- "$path"
  git commit -m "$message"
  if git push origin HEAD:main; then
    if [ -n "${GITHUB_OUTPUT:-}" ]; then
      echo "pushed=true" >> "$GITHUB_OUTPUT"
    fi
    exit 0
  fi
  echo "Push rejected; retrying against the latest main (attempt $attempt/5)"
  sleep 2
done

echo "Failed to push $path after 5 attempts"
exit 1
