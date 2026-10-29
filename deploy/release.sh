#!/usr/bin/env bash
set -Eeuo pipefail
umask 022
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export GIT_TERMINAL_PROMPT=0
REPO=/opt/lovelevel/repository
STORE=/var/lib/lovelevel-deploy
REMOTE=https://github.com/Balakhmatov/lovelevel.git
[[ $(id -u) == 0 ]] || { echo 'Deploy requires root'; exit 1; }
[[ $(git -C "$REPO" remote get-url origin) == "$REMOTE" ]] || { echo 'Unexpected Git remote'; exit 1; }
exec 9>/run/lock/lovelevel-deploy.lock
flock -x -w 120 9
if [[ -n $(git -C "$REPO" status --porcelain --untracked-files=no) ]]; then echo 'Tracked checkout changes detected; refusing deploy'; exit 1; fi
git -C "$REPO" fetch --quiet origin main
head=$(git -C "$REPO" rev-parse origin/main)
target=${1:-$head}
[[ "$target" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid commit'; exit 1; }
git -C "$REPO" merge-base --is-ancestor "$target" "$head" || { echo 'Commit does not belong to main'; exit 1; }
previous=$(cat "$STORE/.deployed-commit" 2>/dev/null || true)
[[ "$target" != "$previous" ]] || exit 0
if [[ -n "$previous" ]]; then
  [[ "$previous" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid deploy marker'; exit 1; }
  git -C "$REPO" merge-base --is-ancestor "$previous" "$target" || { echo 'Non-fast-forward production update refused'; exit 1; }
fi
nodebin=/usr/local/bin/node-lovelevel
if [[ ! -x "$nodebin" ]]; then
  for candidate in /usr/local/bin/node-business-pulse /usr/bin/node /usr/local/bin/node; do
    if [[ -x "$candidate" ]] && "$candidate" --experimental-sqlite -e 'require("node:sqlite");const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))process.exit(1)' >/dev/null 2>&1; then nodebin=$candidate; break; fi
  done
fi
[[ -x "$nodebin" ]] || { echo 'Node >=22.13 with SQLite is required'; exit 1; }
# Build/test as a separate user with no access to /var/lib/lovelevel or /etc/lovelevel.
stage=$(mktemp -d /opt/lovelevel/releases/.build-XXXXXXXX)
cleanup(){ if [[ -n ${stage:-} && "$stage" == /opt/lovelevel/releases/.build-* ]]; then rm -rf "$stage"; fi; }
trap cleanup EXIT
git -C "$REPO" archive "$target" | tar -x -C "$stage"
chown -hR lovelevel-build:lovelevel-build "$stage"
chmod -R u=rwX,go=rX "$stage"
cd "$stage"
runuser -u lovelevel-build -- "$nodebin" scripts/build.mjs
runuser -u lovelevel-build -- "$nodebin" --check server/index.mjs
runuser -u lovelevel-build -- "$nodebin" --check public/app.js
runuser -u lovelevel-build -- "$nodebin" --experimental-sqlite --experimental-test-isolation=none --test --test-concurrency=1 tests/*.test.mjs
# Candidate is immutable to the application user after verification.
chown -hR root:root "$stage"
chmod -R u=rwX,go=rX "$stage"
release=/opt/lovelevel/releases/$target
if [[ -e "$release" ]]; then
  if [[ $(readlink -f /opt/lovelevel/current 2>/dev/null || true) == "$release" ]]; then
    echo 'Running release has no matching marker; refusing to overwrite it'
    exit 1
  fi
  echo 'Candidate directory already exists; inspect the prior attempt before retrying'
  exit 1
fi
mv "$stage" "$release"
stage=
# Fixed root-owned installer and service template are installed only by the explicit bootstrap.
# Ordinary commits never replace root-owned deployment entrypoints.
LOVELEVEL_NODE_BIN="$nodebin" /usr/local/sbin/lovelevel-install "$release"
printf '%s\n' "$target" > "$STORE/.deployed-commit.tmp"
chmod 600 "$STORE/.deployed-commit.tmp"
mv "$STORE/.deployed-commit.tmp" "$STORE/.deployed-commit"
echo "LoveLevel deployed $target"
