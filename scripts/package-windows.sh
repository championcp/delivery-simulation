#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${ROOT_DIR}/web"
DIST_ROOT="${ROOT_DIR}/dist"
DIST_DIR="${DIST_ROOT}/windows"
ARCHIVE_PATH="${DIST_ROOT}/locker-simulator-win64.zip"
TMP_DIR="${ROOT_DIR}/.tmp/package-win"

NODE_VERSION="${NODE_VERSION_OVERRIDE:-$(node -p "process.versions.node")}"
NODE_ARCHIVE="node-v${NODE_VERSION}-win-x64.zip"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}"

echo "==> Cleaning previous artifacts"
rm -rf "${DIST_DIR}" "${ARCHIVE_PATH}" "${TMP_DIR}"
mkdir -p "${DIST_DIR}" "${TMP_DIR}"

echo "==> Installing dependencies (host) and building Next.js app"
pushd "${WEB_DIR}" >/dev/null
npm install
npm run build
popd >/dev/null

echo "==> Copying project files to staging area"
rsync -a --delete \
  --exclude node_modules \
  --exclude '.next/cache' \
  --exclude '.next/trace' \
  --exclude '.next/types' \
  --exclude '.env*' \
  "${WEB_DIR}/" "${DIST_DIR}/web/"

echo "==> Copying build artifacts and resetting data directory"
rsync -a "${WEB_DIR}/.next" "${DIST_DIR}/web/"
rm -f "${DIST_DIR}/web/data/"locker.db*

echo "==> Installing Windows production dependencies"
pushd "${DIST_DIR}/web" >/dev/null
rm -rf node_modules
npm_config_platform=win32 npm_config_arch=x64 npm ci --omit=dev
popd >/dev/null

echo "==> Downloading Node.js ${NODE_VERSION} (win-x64 portable)"
curl -fsSL "${NODE_URL}" -o "${TMP_DIR}/${NODE_ARCHIVE}"
unzip -q "${TMP_DIR}/${NODE_ARCHIVE}" -d "${TMP_DIR}"
mv "${TMP_DIR}/node-v${NODE_VERSION}-win-x64" "${DIST_DIR}/node"

echo "==> Creating Windows start script"
cat <<'BAT' > "${DIST_DIR}/start.bat"
@echo off
setlocal
set "APP_DIR=%~dp0web"
set "NODE_DIR=%~dp0node"
set "NPM_CLI=%NODE_DIR%\node_modules\npm\bin\npm-cli.js"
if not exist "%NPM_CLI%" (
  echo 未找到 npm-cli.js，请确认压缩包是否完整后重试。
  pause
  exit /b 1
)
cd /d "%APP_DIR%"
if not exist data mkdir data
"%NODE_DIR%\node.exe" "%NPM_CLI%" --prefix "%APP_DIR%" run start
endlocal
pause
BAT

# convert to CRLF for Windows compatibility
python - <<PY
from pathlib import Path
path = Path(r"${DIST_DIR}") / "start.bat"
text = path.read_text(encoding="utf-8")
text = text.replace("\r\n", "\n")
path.write_text(text.replace("\n", "\r\n"), encoding="utf-8")
PY

echo "==> Packaging bundle"
mkdir -p "${DIST_ROOT}"
pushd "${DIST_DIR}" >/dev/null
zip -qr "${ARCHIVE_PATH}" .
popd >/dev/null

echo "==> Cleaning temporary files"
rm -rf "${TMP_DIR}"

echo "Packaged Windows bundle at: ${ARCHIVE_PATH}"
