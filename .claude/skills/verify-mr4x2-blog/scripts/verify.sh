#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
RUNS="$REPO/.verify/runs"
SITE_TITLE="mr4x2 blog"

usage() {
  cat <<EOF
usage:
  verify.sh launch [local|prod]   start an instance; prints RUN_ID and URL (default: local)
  verify.sh doctor RUN_ID         read-only health check of that run's instance
  verify.sh stop RUN_ID           stop that run's instance; evidence is kept
  verify.sh list                  list runs and whether their instance is up
EOF
  exit 2
}

free_port() { python3 -I -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'; }

load() {
  [ -n "${1:-}" ] || usage
  RUN_DIR="$RUNS/$1"
  [ -f "$RUN_DIR/instance.env" ] || { echo "no such run: $1" >&2; exit 1; }
  # shellcheck disable=SC1091
  . "$RUN_DIR/instance.env"
}

instance_up() {
  case "$MODE" in
    local) [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null && tr '\0' ' ' <"/proc/$PID/cmdline" | grep -q "hugo server.*--port $PORT" ;;
    prod) [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" = "true" ] ;;
  esac
}

cmd_launch() {
  local mode="${1:-local}" run port url
  run="$(date +%Y%m%d-%H%M%S)-$$"
  RUN_DIR="$RUNS/$run"
  mkdir -p "$RUN_DIR"
  port="$(free_port)"
  url="http://127.0.0.1:$port/"
  case "$mode" in
    local)
      # A simple command, so $! is hugo itself (nohup execs it). All fds are redirected so a caller's pipe never waits on it.
      cd "$REPO"
      nohup hugo server -D --bind 127.0.0.1 --port "$port" --baseURL "$url" \
        --appendPort=false --disableFastRender --noHTTPCache </dev/null >"$RUN_DIR/server.log" 2>&1 &
      echo $! >"$RUN_DIR/pid"
      printf 'MODE=local\nPORT=%s\nURL=%s\nPID=%s\n' "$port" "$url" "$(cat "$RUN_DIR/pid")" >"$RUN_DIR/instance.env"
      ;;
    prod)
      local image="mr4x2-blog-verify:$run"
      if ! docker build --build-arg "BASE_URL=$url" -t "$image" "$REPO" >"$RUN_DIR/build.log" 2>&1; then
        echo "image build failed; log: $RUN_DIR/build.log" >&2
        tail -20 "$RUN_DIR/build.log" >&2
        exit 1
      fi
      docker run -d --name "verify-mr4x2-$run" -p "127.0.0.1:$port:80" "$image" >/dev/null
      printf 'MODE=prod\nPORT=%s\nURL=%s\nCONTAINER=%s\nIMAGE=%s\n' "$port" "$url" "verify-mr4x2-$run" "$image" >"$RUN_DIR/instance.env"
      ;;
    *) usage ;;
  esac
  load "$run"
  for _ in $(seq 1 60); do
    if [ "$MODE" = prod ]; then docker logs "$CONTAINER" >"$RUN_DIR/server.log" 2>&1 || true; fi
    if { [ "$MODE" = prod ] || grep -q "Web Server is available at" "$RUN_DIR/server.log" 2>/dev/null; } &&
       curl -sf -o /dev/null "$URL"; then
      echo "RUN_ID=$run"
      echo "URL=$URL"
      echo "MODE=$MODE"
      echo "EVIDENCE=$RUN_DIR"
      return 0
    fi
    if ! instance_up; then break; fi
    sleep 1
  done
  echo "instance did not become ready; log: $RUN_DIR/server.log" >&2
  tail -20 "$RUN_DIR/server.log" >&2 || true
  cmd_stop "$run" >/dev/null 2>&1 || true
  exit 1
}

cmd_doctor() {
  load "$1"
  local ok=1 home
  if instance_up; then echo "ok   instance up ($MODE, port $PORT)"; else echo "FAIL instance not running"; ok=0; fi
  if [ "$MODE" = prod ]; then docker logs "$CONTAINER" >"$RUN_DIR/server.log" 2>&1 || true; fi
  if home="$(curl -sf "$URL")"; then
    echo "ok   GET / -> 200"
    if grep -q "<title>$SITE_TITLE</title>" <<<"$home"; then echo "ok   home title is '$SITE_TITLE'"; else echo "FAIL home title is not '$SITE_TITLE' (another app on this port?)"; ok=0; fi
  else
    echo "FAIL GET / failed"; ok=0
  fi
  if [ "$MODE" = local ]; then
    echo "info hugo $(cd "$REPO" && hugo version | awk '{print $2}')"
  else
    echo "info hugo $(sed -n 's/^FROM hugomods\/hugo:exts-\([0-9.]*\).*/\1/p' "$REPO/Dockerfile" | head -1) (static build, served by nginx)"
  fi
  echo "info branch $(git -C "$REPO" branch --show-current) @ $(git -C "$REPO" rev-parse --short HEAD)$(git -C "$REPO" diff --quiet && echo '' || echo ' (+ uncommitted changes)')"
  if grep -qiE '^(ERROR|WARN)' "$RUN_DIR/server.log"; then echo "warn server log has ERROR/WARN lines:"; grep -iE '^(ERROR|WARN)' "$RUN_DIR/server.log" | tail -5 | sed 's/^/     /'; fi
  [ "$ok" = 1 ] && echo "doctor: healthy" || { echo "doctor: NOT healthy"; exit 1; }
}

cmd_stop() {
  load "$1"
  case "$MODE" in
    local)
      if instance_up; then kill "$PID"; for _ in $(seq 1 10); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done; fi
      ;;
    prod)
      docker logs "$CONTAINER" >"$RUN_DIR/server.log" 2>&1 || true
      docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
      if [ -n "${IMAGE:-}" ]; then docker rmi "$IMAGE" >/dev/null 2>&1 || true; fi
      ;;
  esac
  rm -rf "$RUN_DIR/chrome-profile"
  echo "stopped $1; evidence kept in $RUN_DIR"
}

cmd_list() {
  [ -d "$RUNS" ] || { echo "no runs"; return 0; }
  for d in "$RUNS"/*/; do
    [ -f "$d/instance.env" ] || continue
    ( . "$d/instance.env"; MODE=$MODE; if instance_up; then s=up; else s=stopped; fi; echo "$(basename "$d")  $MODE  $URL  $s" )
  done
}

case "${1:-}" in
  launch) shift; cmd_launch "$@" ;;
  doctor) shift; cmd_doctor "${1:-}" ;;
  stop) shift; cmd_stop "${1:-}" ;;
  list) cmd_list ;;
  *) usage ;;
esac
