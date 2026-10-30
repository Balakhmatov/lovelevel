#!/usr/bin/env bash
set -Eeuo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root on the VPS'; exit 1; }
if ! command -v ffprobe >/dev/null || ! command -v ffmpeg >/dev/null; then
 apt-get update
 apt-get install -y --no-install-recommends ffmpeg
fi
runuser -u lovelevel -- ffprobe -version >/dev/null
runuser -u lovelevel -- ffmpeg -version >/dev/null
systemctl restart lovelevel
curl --fail --silent --retry 8 --retry-connrefused --retry-delay 1 http://127.0.0.1:3118/health
printf '\nВидео и голосовые: серверная обработка доступна.\n'
