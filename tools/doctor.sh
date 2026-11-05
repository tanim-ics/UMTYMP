#!/bin/sh
# Checks this machine's Docker setup before the first `docker compose up`, and with --fix repairs the two problems a
# leftover Docker Desktop install causes on Linux: a dead buildx plugin link and a `credsStore` naming a credential
# helper that is gone. Both break every build with errors that don't name the cause.
# Plain POSIX sh so it runs as-is on macOS, Linux, WSL and Git Bash; it needs nothing but docker itself.
# Usage: sh tools/doctor.sh [--fix]

FIX=0
[ "$1" = "--fix" ] && FIX=1

CONFIG_DIR="${DOCKER_CONFIG:-$HOME/.docker}"
CONFIG="$CONFIG_DIR/config.json"
OS="$(uname -s 2>/dev/null)"
PROBLEMS=0

ok() { printf '  ok    %s\n' "$1"; }
bad() {
  printf '  FAIL  %s\n' "$1"
  shift
  for line in "$@"; do printf '        %s\n' "$line"; done
  PROBLEMS=$((PROBLEMS + 1))
}

install_hint() {
  case "$OS" in
    Darwin) echo "Install or update Docker Desktop: https://docs.docker.com/desktop/setup/install/mac-install/" ;;
    Linux) echo "Install Docker Engine with its plugins: https://docs.docker.com/engine/install/" ;;
    *) echo "Install or update Docker Desktop: https://docs.docker.com/desktop/" ;;
  esac
}

buildx_hint() {
  case "$OS" in
    Linux)
      echo "Docker's apt repo: sudo apt-get install docker-buildx-plugin docker-compose-plugin"
      echo "Ubuntu's own packages: sudo apt-get install docker-buildx docker-compose-v2"
      ;;
    *) install_hint ;;
  esac
}

echo "Checking Docker for UMTYMP Test Prep..."

# 1. The CLI itself. Nothing else can be checked without it.
if ! command -v docker >/dev/null 2>&1; then
  bad "Docker is not installed (no 'docker' on PATH)." "$(install_hint)"
  exit 1
fi
ok "docker is installed"

# 2. The daemon. Desktop users usually just need to open the app.
if docker info >/dev/null 2>&1; then
  ok "the Docker daemon is running"
else
  case "$OS" in
    Linux) bad "The Docker daemon is not running or you can't reach it." \
      "Start it: sudo systemctl start docker" \
      "If it says 'permission denied': sudo usermod -aG docker \$USER, then log out and back in." ;;
    *) bad "The Docker daemon is not running." "Open Docker Desktop and wait until it says it's running." ;;
  esac
fi

# 3. Compose v2 (`docker compose`, not the old `docker-compose`).
if docker compose version >/dev/null 2>&1; then
  ok "docker compose (v2) works"
else
  bad "'docker compose' (Compose v2) is missing." "$(buildx_hint)"
fi

# 4. buildx: Compose hands every build to it. A dead link left by an old Desktop install fails with
#    "fork/exec .../docker-buildx: no such file or directory".
PLUGIN="$CONFIG_DIR/cli-plugins/docker-buildx"
if docker buildx version >/dev/null 2>&1; then
  ok "docker buildx works"
elif [ -L "$PLUGIN" ] && [ ! -e "$PLUGIN" ]; then
  if [ "$FIX" = 1 ]; then
    rm "$PLUGIN"
    if docker buildx version >/dev/null 2>&1; then
      ok "removed a broken buildx link; buildx now works"
    else
      bad "Removed a broken buildx link, but buildx is still missing." "$(buildx_hint)"
    fi
  else
    bad "$PLUGIN is a broken link (left by an old Docker Desktop?)." \
      "Run: sh tools/doctor.sh --fix   (or remove that file yourself)" "Then, if buildx is still missing:" \
      "$(buildx_hint)"
  fi
else
  bad "docker buildx is missing; builds will fail." "$(buildx_hint)"
fi

# 5. The credential helper named by credsStore. A missing one fails every image pull with
#    'error getting credentials ... docker-credential-<name>: executable file not found'.
if [ -f "$CONFIG" ]; then
  STORE="$(tr '\n' ' ' <"$CONFIG" | sed -n 's/.*"credsStore"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  if [ -z "$STORE" ] || command -v "docker-credential-$STORE" >/dev/null 2>&1; then
    ok "credential settings are usable"
  elif [ "$FIX" = 1 ]; then
    cp "$CONFIG" "$CONFIG.bak"
    # Drop the key and any comma it leaves dangling. Docker reads the file as JSON, so collapsing it to one line is fine.
    tr '\n' ' ' <"$CONFIG.bak" |
      sed -E 's/"credsStore"[[:space:]]*:[[:space:]]*"[^"]*"[[:space:]]*,?//; s/,[[:space:]]*}/}/g' >"$CONFIG.tmp" &&
      mv "$CONFIG.tmp" "$CONFIG"
    ok "removed credsStore \"$STORE\" (no docker-credential-$STORE); backup at $CONFIG.bak"
  else
    bad "$CONFIG says credsStore \"$STORE\", but docker-credential-$STORE is not installed." \
      "Image pulls will fail. The images this project uses are public and need no login." \
      "Run: sh tools/doctor.sh --fix   (removes that line, keeps a .bak copy)"
  fi
else
  ok "no Docker config file (defaults are fine)"
fi

echo
if [ "$PROBLEMS" -eq 0 ]; then
  echo "All checks passed. Start the app: docker compose up -d dev  ->  http://localhost:5173"
  exit 0
fi
echo "$PROBLEMS problem(s) found. Fix them, then run this again."
exit 1
