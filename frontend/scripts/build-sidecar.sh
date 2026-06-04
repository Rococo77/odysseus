#!/usr/bin/env bash
# Build the Odysseus FastAPI backend into a single-file binary and place it
# where Tauri expects an `externalBin` sidecar:
#   src-tauri/binaries/odysseus-server-<target-triple>[.exe]
#
# Usage:
#   cd frontend && bash scripts/build-sidecar.sh
#   npm run tauri build -- -c src-tauri/tauri.sidecar.conf.json
#
# Requirements: a Python env with the backend deps installed, plus pyinstaller
# (pip install pyinstaller). Run from the `frontend/` directory.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
OUT_DIR="$FRONTEND_DIR/src-tauri/binaries"

# Tauri resolves the sidecar by the host target triple.
TRIPLE="$(rustc -Vv | sed -n 's/host: //p')"
EXT=""
case "$TRIPLE" in
  *windows*) EXT=".exe" ;;
esac
TARGET_NAME="odysseus-server-${TRIPLE}${EXT}"

echo "==> Building backend sidecar for $TRIPLE"
mkdir -p "$OUT_DIR"

# A tiny launcher so PyInstaller has a clean entrypoint that boots uvicorn
# against the FastAPI app, honouring HOST/PORT injected by the Tauri shell.
LAUNCHER="$(mktemp /tmp/odysseus_sidecar_XXXX.py)"
cat > "$LAUNCHER" <<'PY'
import os
import uvicorn

if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "7000"))
    uvicorn.run("app:app", host=host, port=port, log_level="info")
PY

pyinstaller \
  --onefile \
  --name "odysseus-server" \
  --distpath "$OUT_DIR" \
  --workpath "$(mktemp -d)" \
  --specpath "$(mktemp -d)" \
  --paths "$REPO_ROOT" \
  --collect-all fastapi \
  --collect-all uvicorn \
  --collect-all anthropic \
  --collect-submodules app \
  "$LAUNCHER"

rm -f "$LAUNCHER"

# PyInstaller emits `odysseus-server[.exe]`; rename to the triple-suffixed name.
mv "$OUT_DIR/odysseus-server${EXT}" "$OUT_DIR/$TARGET_NAME"
echo "==> Wrote $OUT_DIR/$TARGET_NAME"
echo "==> Now run: npm run tauri build -- -c src-tauri/tauri.sidecar.conf.json"
