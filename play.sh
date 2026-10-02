#!/usr/bin/env bash
# 构建《墨空 INKSKY》并以独立 Chrome 应用窗口全屏启动；关闭窗口即退出。
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm run build
npx vite preview --host 127.0.0.1 --port 4173 --strictPort >/dev/null &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
until curl -sf http://127.0.0.1:4173/ >/dev/null; do sleep 0.2; done
google-chrome --user-data-dir="$HOME/.cache/inksky-chrome" --app=http://127.0.0.1:4173/ \
  --start-fullscreen --ignore-gpu-blocklist --autoplay-policy=no-user-gesture-required \
  --no-first-run --no-default-browser-check
