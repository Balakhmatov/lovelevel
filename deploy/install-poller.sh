#!/usr/bin/env bash
# One-time explicit bootstrap on the VPS; later updates are pulled by the timer.
set -Eeuo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root on the VPS'; exit 1; }
REPO=/opt/lovelevel/repository
REMOTE=https://github.com/Balakhmatov/lovelevel.git
cd "$REPO"
[[ $(git remote get-url origin) == "$REMOTE" ]] || { echo 'Unexpected remote'; exit 1; }
for script in deploy/poll.sh deploy/release.sh deploy/install.sh; do bash -n "$script"; done
install -d -m 0755 /opt/lovelevel /opt/lovelevel/releases
install -d -m 0700 /etc/lovelevel /var/lib/lovelevel-deploy
getent group lovelevel >/dev/null || groupadd --system lovelevel
id lovelevel >/dev/null 2>&1 || useradd --system --gid lovelevel --home-dir /var/lib/lovelevel --shell /usr/sbin/nologin lovelevel
getent group lovelevel-build >/dev/null || groupadd --system lovelevel-build
id lovelevel-build >/dev/null 2>&1 || useradd --system --gid lovelevel-build --home-dir /nonexistent --shell /usr/sbin/nologin lovelevel-build
install -d -m 0700 -o lovelevel -g lovelevel /var/lib/lovelevel
# Refresh only LoveLevel's timer/entrypoints on explicit operator request.
systemctl stop lovelevel-deploy.timer 2>/dev/null || true
systemctl stop lovelevel-deploy.service 2>/dev/null || true
install -o root -g root -m 0755 deploy/poll.sh /usr/local/sbin/lovelevel-poll
install -o root -g root -m 0755 deploy/release.sh /usr/local/sbin/lovelevel-deploy
install -o root -g root -m 0755 deploy/install.sh /usr/local/sbin/lovelevel-install
install -o root -g root -m 0644 deploy/lovelevel.service /etc/lovelevel/service.template
install -o root -g root -m 0644 deploy/lovelevel-deploy.service /etc/systemd/system/lovelevel-deploy.service
install -o root -g root -m 0644 deploy/lovelevel-deploy.timer /etc/systemd/system/lovelevel-deploy.timer
systemctl daemon-reload
rm -f /var/lib/lovelevel-deploy/.failed-deploy-commit
systemctl start lovelevel-deploy.service
systemctl enable --now lovelevel-deploy.timer
systemctl status lovelevel-deploy.timer --no-pager -l
echo 'LoveLevel auto-deploy enabled. Inspect: journalctl -u lovelevel-deploy.service -n 40 --no-pager'
