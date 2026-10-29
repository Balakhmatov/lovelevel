#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root'; exit 1; }
release=$(readlink -f /opt/lovelevel/current)
[[ -f "$release/deploy/nginx-http.conf" ]] || { echo 'Install LoveLevel first'; exit 1; }
for file in /etc/nginx/sites-enabled/*; do
 [[ -f "$file" ]] || continue
 if grep -Eq 'server_name[^;]*lovelevel\.cityai\.site' "$file" && [[ $(basename "$file") != lovelevel ]]; then echo "Hostname already configured in another vhost; inspect before proceeding."; exit 1; fi
done
source="$release/deploy/nginx-http.conf"
if [[ ${1:-} == '--https' ]]; then
 [[ -f /etc/letsencrypt/live/lovelevel.cityai.site/fullchain.pem && -f /etc/letsencrypt/live/lovelevel.cityai.site/privkey.pem ]] || { echo 'Issue the LoveLevel certificate first'; exit 1; }
 source="$release/deploy/nginx-https.conf"
fi
install -d -m 0755 /var/www/lovelevel-acme/.well-known/acme-challenge
backup=$(mktemp -d /tmp/lovelevel-nginx.XXXXXX)
existed=false; linked=false
if [[ -f /etc/nginx/sites-available/lovelevel ]]; then cp -p /etc/nginx/sites-available/lovelevel "$backup/previous"; existed=true; fi
if [[ -e /etc/nginx/sites-enabled/lovelevel || -L /etc/nginx/sites-enabled/lovelevel ]]; then linked=true; fi
rollback(){
 if [[ $existed == true ]]; then cp -p "$backup/previous" /etc/nginx/sites-available/lovelevel; else rm -f /etc/nginx/sites-available/lovelevel; fi
 if [[ $linked == false ]]; then rm -f /etc/nginx/sites-enabled/lovelevel; fi
 rm -rf "$backup"
}
trap rollback ERR
install -m 0644 "$source" /etc/nginx/sites-available/lovelevel
ln -sfn /etc/nginx/sites-available/lovelevel /etc/nginx/sites-enabled/lovelevel
nginx -t
systemctl reload nginx
trap - ERR
rm -rf "$backup"
echo 'Only the LoveLevel vhost was configured; Nginx reloaded gracefully.'
