#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${ROOT_DIR}/web"
DIST_DIR="${ROOT_DIR}/dist/windows"
ARCHIVE_PATH="${ROOT_DIR}/dist/locker-simulator-win64.zip"
NODE_VERSION="${NODE_VERSION_OVERRIDE:-$(node -p "process.versions.node")}"
NODE_ZIP="node-v${NODE_VERSION}-win-x64.zip"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ZIP}"
TMP_DIR="${ROOT_DIR}/.tmp/package-win"

echo "==> Preparing directories"
rm -rf "${DIST_DIR}" "${TMP_DIR}" "${ARCHIVE_PATH}"
mkdir -p "${DIST_DIR}" "${TMP_DIR}"

echo "==> Installing dependencies (current platform) & building Next.js app"
pushd "${WEB_DIR}" >/dev/null
npm install
npm run build
popd >/dev/null

echo "==> Copying project files to staging area"
rsync -a --delete \
  --exclude node_modules \
  --exclude '.next/cache' \
  --exclude '.next/types' \
  --exclude '.next/trace' \
  --exclude '.env*' \
  "${WEB_DIR}/" "${DIST_DIR}/web/"

echo "==> Copying build artifacts (.next) and cleaning data folder"
rsync -a "${WEB_DIR}/.next" "${DIST_DIR}/web/"
rm -f "${DIST_DIR}/web/data/"locker.db*

echo "==> Installing Windows target node_modules (omit devDependencies)"
pushd "${DIST_DIR}/web" >/dev/null
rm -rf node_modules
npm_config_platform=win32 npm_config_arch=x64 npm ci --omit=dev
popd >/dev/null

echo "==> Downloading portable Node.js for Windows (${NODE_VERSION})"
curl -fsSL "${NODE_URL}" -o "${TMP_DIR}/${NODE_ZIP}"
unzip -q "${TMP_DIR}/${NODE_ZIP}" -d "${TMP_DIR}"
mv "${TMP_DIR}/node-v${NODE_VERSION}-win-x64" "${DIST_DIR}/node"

echo "==> Creating Windows start script"
cat <<'BAT' > "${DIST_DIR}/start.bat"
@echo off
setlocal
set APP_DIR=%~dp0web
set NODE_DIR=%~dp0node
cd /d "%APP_DIR%"
if not exist data mkdir data
"%NODE_DIR%\node.exe" node_modules\npm\bin\npm-cli.js run start
endlocal
pause
BAT

chmod +x "${DIST_DIR}/start.bat"

echo "==> Packaging into ${ARCHIVE_PATH}"
pushd "${DIST_DIR}" >/dev/null
zip -qr "${ARCHIVE_PATH}" .
popd >/dev/null

echo "==> Cleaning temporary files"
rm -rf "${TMP_DIR}"

echo "Done! Generated archive:"
echo "  ${ARCHIVE_PATH}"
