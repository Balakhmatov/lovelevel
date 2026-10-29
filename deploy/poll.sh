#!/usr/bin/env bash
set -Eeuo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export GIT_TERMINAL_PROMPT=0
REPO=/opt/lovelevel/repository
STORE=/var/lib/lovelevel-deploy
REMOTE=https://github.com/Balakhmatov/lovelevel.git
[[ $(id -u) == 0 ]] || { echo 'Run through the LoveLevel deployment service'; exit 1; }
[[ $(git -C "$REPO" remote get-url origin) == "$REMOTE" ]] || { echo 'Unexpected Git remote'; exit 1; }
if ! result=$(timeout 20s git -C "$REPO" ls-remote origin refs/heads/main); then
  echo 'GitHub temporarily unavailable; running LoveLevel is unchanged'
  exit 0
fi
read -r latest ref <<< "$result"
[[ "$latest" =~ ^[a-f0-9]{40}$ && "$ref" == refs/heads/main ]] || { echo 'Invalid main branch response'; exit 1; }
[[ "$latest" != "$(cat "$STORE/.deployed-commit" 2>/dev/null || true)" ]] || exit 0
[[ "$latest" != "$(cat "$STORE/.failed-deploy-commit" 2>/dev/null || true)" ]] || exit 0
if /usr/local/sbin/lovelevel-deploy "$latest"; then
  rm -f "$STORE/.failed-deploy-commit"
else
  printf '%s\n' "$latest" > "$STORE/.failed-deploy-commit"
  chmod 600 "$STORE/.failed-deploy-commit"
  echo 'LoveLevel update failed; next automatic attempt will be for a new commit'
  exit 1
fi
