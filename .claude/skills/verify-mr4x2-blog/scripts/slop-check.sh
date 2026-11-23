#!/usr/bin/env bash
# Runs the grep that CLAUDE.md "Avoid slop" tells an agent to run before finishing.
# The command is read from CLAUDE.md at run time, so the rule and this check cannot drift.
#   slop-check.sh                      scan the repo root
#   SLOP_ROOT=/some/copy slop-check.sh scan another tree (it must hold the paths the grep names)
# Exit 0: nothing matched. Exit 1: matches printed as file:line:text. Exit 2: the rule could not run.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
RULE_FILE="$REPO/CLAUDE.md"
SLOP_ROOT="${SLOP_ROOT:-$REPO}"

# The rule uses grep -P with \x{...} code points, which errors outside a UTF-8 locale.
case "${LC_ALL:-${LANG:-}}" in *UTF-8*|*utf8*) ;; *) export LC_ALL=C.UTF-8 ;; esac

cmd="$(awk '
  /^## Avoid slop[[:space:]]*$/ { in_section = 1; next }
  in_section && /^## / { exit }
  in_section && /^grep / { print; exit }
' "$RULE_FILE")"

if [ -z "$cmd" ]; then
  echo "slop-check: no grep line under \"## Avoid slop\" in $RULE_FILE" >&2
  exit 2
fi

echo "slop-check: scanning $SLOP_ROOT"
echo "slop-check: $cmd"
cd "$SLOP_ROOT" || exit 2
output="$(bash -c "$cmd" 2>&1)"
status=$?
case $status in
  0) printf '%s\n' "$output"; echo "slop-check: FAIL, matches above (file:line:text)" >&2; exit 1 ;;
  1) echo "slop-check: PASS, no matches"; exit 0 ;;
  *) printf '%s\n' "$output" >&2; echo "slop-check: grep failed with status $status" >&2; exit 2 ;;
esac
