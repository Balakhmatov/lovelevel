#!/usr/bin/env bash
set -Eeuo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root on the VPS'; exit 1; }
NODE=/usr/local/bin/node-lovelevel
[[ -x "$NODE" ]] || { echo 'Install LoveLevel first'; exit 1; }
if ! curl --fail --silent http://127.0.0.1:3118/api/auth/config | "$NODE" -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{try{if(!JSON.parse(s).telegram)process.exit(1)}catch{process.exit(1)}})'; then
 echo 'Telegram update is not deployed yet. Wait for auto-deploy, then repeat.'; exit 1
fi
install -d -o root -g root -m 0700 /etc/lovelevel
pending=$(mktemp /etc/lovelevel/telegram.XXXXXXXX)
trap 'rm -f "$pending"' EXIT
chmod 600 "$pending"
IFS= read -r -s -p 'BotFather token for @lovelevel_app_bot (hidden): ' token
printf '\n'
[[ "$token" =~ ^[0-9]+:[A-Za-z0-9_-]{20,}$ ]] || { echo 'Invalid token format'; exit 1; }
printf 'TELEGRAM_BOT_USERNAME=lovelevel_app_bot\nTELEGRAM_BOT_TOKEN=%s\n' "$token" > "$pending"
unset token
# Verify the token belongs to this exact bot; never print token URLs or provider errors.
"$NODE" --input-type=module - "$pending" <<'JS'
import fs from 'node:fs';
const text=fs.readFileSync(process.argv[2],'utf8');
const token=text.split('\n').find(s=>s.startsWith('TELEGRAM_BOT_TOKEN=')).slice('TELEGRAM_BOT_TOKEN='.length);
try{const response=await fetch('https://api.telegram.org/bot'+token+'/getMe',{signal:AbortSignal.timeout(15000)});const data=await response.json();if(!data.ok||String(data.result?.username).toLowerCase()!=='lovelevel_app_bot'){console.error('Token was not confirmed for @lovelevel_app_bot. Check BotFather.');process.exit(1);}}catch{console.error('Could not verify bot. Check token and VPS access to api.telegram.org.');process.exit(1);}
JS
mv "$pending" /etc/lovelevel/telegram.env
chown root:root /etc/lovelevel/telegram.env
chmod 600 /etc/lovelevel/telegram.env
install -d -m 0755 /etc/systemd/system/lovelevel.service.d
printf '[Service]\nEnvironmentFile=/etc/lovelevel/telegram.env\n' > /etc/systemd/system/lovelevel.service.d/telegram.conf
systemctl daemon-reload
systemctl restart lovelevel
ready=false
for attempt in {1..15}; do
 if curl --fail --silent http://127.0.0.1:3118/api/auth/config | "$NODE" -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{try{if(!JSON.parse(s).telegram?.enabled)process.exit(1)}catch{process.exit(1)}})'; then ready=true; break; fi
 sleep 1
done
[[ "$ready" == true ]] || { echo 'Telegram did not become ready. Inspect lovelevel service logs without printing secrets.'; exit 1; }
echo 'Telegram login enabled for @lovelevel_app_bot. No token was printed.'
echo 'Set /setdomain to lovelevel.cityai.site in BotFather, then link Telegram from your existing LoveLevel profile.'
