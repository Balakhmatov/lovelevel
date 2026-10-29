#!/usr/bin/env bash
set -euo pipefail
# Usage: sudo bash deploy/install.sh /absolute/path/to/unpacked-release
[[ $EUID -eq 0 ]] || { echo 'Run as root on the target VPS'; exit 1; }
release=$(realpath "${1:?Pass unpacked release directory}")
[[ "$release" == /opt/lovelevel/releases/* ]] || { echo 'Extract the release under /opt/lovelevel/releases first'; exit 1; }
[[ -f "$release/server/index.mjs" && -f "$release/dist/server/index.js" && -d "$release/drizzle" ]] || { echo 'Invalid release'; exit 1; }
command -v nginx >/dev/null || { echo 'Nginx is required'; exit 1; }
nodebin=${LOVELEVEL_NODE_BIN:-}
if [[ -z "$nodebin" ]]; then
  for candidate in /usr/local/bin/node-business-pulse /usr/bin/node /usr/local/bin/node; do
    if [[ -x "$candidate" ]] && "$candidate" --experimental-sqlite -e 'require("node:sqlite");const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))process.exit(1)' >/dev/null 2>&1; then nodebin=$candidate; break; fi
  done
fi
[[ -n "$nodebin" && -x "$nodebin" ]] || { echo 'Node >=22.13 with node:sqlite is required; set LOVELEVEL_NODE_BIN'; exit 1; }
"$nodebin" --experimental-sqlite -e 'require("node:sqlite")' >/dev/null
# Refuse collisions; installing here never edits existing apps or their ports.
if ! systemctl is-active --quiet lovelevel && ss -ltnH 'sport = :3118' | grep -q .; then echo 'Port 3118 is occupied'; exit 1; fi
getent group lovelevel >/dev/null || groupadd --system lovelevel
id lovelevel >/dev/null 2>&1 || useradd --system --gid lovelevel --home-dir /var/lib/lovelevel --shell /usr/sbin/nologin lovelevel
install -d -m 0755 /opt/lovelevel /opt/lovelevel/releases
install -d -m 0700 -o lovelevel -g lovelevel /var/lib/lovelevel
install -d -m 0700 -o root -g root /var/lib/lovelevel-deploy /var/lib/lovelevel-deploy/backups
install -d -m 0755 /var/www/lovelevel-acme/.well-known/acme-challenge
install -d -m 0700 /etc/lovelevel
if [[ ! -f /etc/lovelevel/app.env ]]; then install -m 0600 "$release/deploy/app.env.example" /etc/lovelevel/app.env; fi
# Preserve any existing dedicated runtime; never replace a global node binary.
if [[ ! -e /usr/local/bin/node-lovelevel ]]; then ln -s "$nodebin" /usr/local/bin/node-lovelevel; fi
previous=
if [[ -L /opt/lovelevel/current && -d /opt/lovelevel/current ]]; then previous=$(readlink -f /opt/lovelevel/current); fi
# Production storage is not part of the release and is never copied over from source.
[[ ! -d "$release/data" ]] || { echo 'Release must not contain runtime data'; exit 1; }
# Backup before any schema migration. Old releases and backups remain available.
backup=/var/lib/lovelevel-deploy/backups/$(date -u +%Y%m%dT%H%M%SZ)
mkdir -m 0700 "$backup"
if systemctl is-active --quiet lovelevel; then systemctl stop lovelevel; fi
rollback(){
  echo 'Install failed; restoring prior LoveLevel release and database.' >&2
  if [[ -f "$backup/lovelevel.sqlite" ]]; then
    rm -f /var/lib/lovelevel/lovelevel.sqlite /var/lib/lovelevel/lovelevel.sqlite-wal /var/lib/lovelevel/lovelevel.sqlite-shm
    cp -p "$backup"/lovelevel.sqlite* /var/lib/lovelevel/
    chown lovelevel:lovelevel /var/lib/lovelevel/lovelevel.sqlite*
  fi
  if [[ -n "$previous" ]]; then ln -sfn "$previous" /opt/lovelevel/current; systemctl start lovelevel || true; else systemctl stop lovelevel || true; fi
}
trap rollback ERR
for file in /var/lib/lovelevel/lovelevel.sqlite /var/lib/lovelevel/lovelevel.sqlite-wal /var/lib/lovelevel/lovelevel.sqlite-shm; do
  [[ ! -L "$file" ]] || { echo "Database symlink detected; inspect before deployment"; exit 1; }
  if [[ -f "$file" ]]; then cp -p "$file" "$backup/"; fi
done
chown -hR root:root "$release"
chmod -R u=rwX,go=rX "$release"
ln -sfn "$release" /opt/lovelevel/current
if [[ ! -f /etc/lovelevel/service.template ]]; then install -m 0644 "$release/deploy/lovelevel.service" /etc/lovelevel/service.template; fi
install -m 0644 /etc/lovelevel/service.template /etc/systemd/system/lovelevel.service
systemctl daemon-reload
systemctl start lovelevel
healthy=false
for attempt in {1..15}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3118/health >/dev/null; then healthy=true; break; fi
  sleep 1
done
[[ "$healthy" == true ]]
systemctl enable lovelevel
trap - ERR
echo 'LoveLevel healthy on 127.0.0.1:3118. Other applications were not restarted.'
echo 'Next: import preserved data, create/bind owner account, configure only the LoveLevel Nginx virtual host, then switch DNS and issue TLS.'
