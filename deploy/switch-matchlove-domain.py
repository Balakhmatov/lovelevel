#!/usr/bin/env python3
"""Explicit root-only domain cutover; never called by the automatic application deploy."""
import datetime
import fcntl
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

DOMAINS=('matchlove.cityai.site','lovelevel.cityai.site','cityai.site')
def run(*args):
    return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
def verify_https(domain,path='/',expected='200|',attempts=12):
    last='No response'
    for attempt in range(attempts):
        try:
            result=run('curl','--noproxy','*','--silent','--show-error','--connect-timeout','3','--max-time','8','--resolve',domain+':443:127.0.0.1','-o','/dev/null','-w','%{http_code}|%{redirect_url}','https://'+domain+path)
            if result.stdout==expected:
                return
            last='Unexpected response: '+result.stdout[:250]
        except subprocess.CalledProcessError as error:
            last=(error.stderr or str(error)).strip()[-1600:]
        if attempt+1<attempts:
            time.sleep(1)
    raise RuntimeError('HTTPS check failed for '+domain+path+' after '+str(attempts)+' attempts: '+last)

def names(path):
    text=re.sub(r'#[^\n]*','',path.read_text())
    return {name for row in re.findall(r'\bserver_name\s+([^;]+);',text) for name in row.split()}
def main():
    if os.geteuid()!=0:
        raise RuntimeError('Run as root on the VPS')
    if sys.argv[1:]!=['--apply']:
        raise RuntimeError('Explicit --apply is required')
    template=Path(__file__).with_name('matchlove-domains.conf')
    config=template.read_text()
    if set(re.findall(r'server_name\s+([^;]+);',config))!={'matchlove.cityai.site lovelevel.cityai.site','matchlove.cityai.site','lovelevel.cityai.site','cityai.site'}:
        raise RuntimeError('Unexpected hostname scope in template')
    for domain in DOMAINS:
        cert=Path('/etc/letsencrypt/live')/domain
        if not (cert/'privkey.pem').is_file():
            raise RuntimeError('Missing certificate key for '+domain)
        result=run('openssl','x509','-in',str(cert/'fullchain.pem'),'-noout','-checkhost',domain)
        if 'does match certificate' not in result.stdout:
            raise RuntimeError('Certificate does not cover '+domain)
        run('openssl','x509','-in',str(cert/'fullchain.pem'),'-noout','-checkend','86400')
    env=Path('/etc/lovelevel/app.env')
    text=env.read_text()
    if len(re.findall(r'^PUBLIC_ORIGIN=.*$',text,re.M))!=1:
        raise RuntimeError('Expected one PUBLIC_ORIGIN line; inspect app.env locally')
    if re.search(r'^PUBLIC_ORIGIN=https://lovelevel\.cityai\.site\s*$',text,re.M) is None:
        raise RuntimeError('Unexpected current PUBLIC_ORIGIN; inspect before switching')
    enabled=Path('/etc/nginx/sites-enabled')
    legacy=(enabled/'lovelevel').resolve(strict=True)
    root=(enabled/'cityai').resolve(strict=True)
    if legacy==root or names(legacy)!={'lovelevel.cityai.site'} or names(root)!={'cityai.site'}:
        raise RuntimeError('Vhosts contain other names; refusing to modify stage or shared hosts')
    target=Path('/etc/nginx/sites-available/matchlove')
    link=enabled/'matchlove'
    if target.exists() or target.is_symlink() or link.exists() or link.is_symlink():
        raise RuntimeError('MatchLove vhost already exists; inspect it before rerunning')
    for candidate in list(enabled.iterdir())+list(Path('/etc/nginx/conf.d').glob('*.conf')):
        if not candidate.is_file() or candidate.resolve() in {legacy,root}:
            continue
        if names(candidate).intersection(DOMAINS):
            raise RuntimeError('Hostname already configured in '+str(candidate))
    run('nginx','-t')
    run('curl','--fail','--silent','--max-time','5','http://127.0.0.1:3118/health')
    backup=Path('/root')/('matchlove-domains-backup-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    backup.mkdir(mode=0o700)
    files={'lovelevel.conf':legacy,'cityai.conf':root,'app.env':env}
    for name,path in files.items():
        shutil.copy2(path,backup/name)
    # Backups include private env data and must never be printed or committed.
    print('Backup saved to '+str(backup),flush=True)
    try:
        target.write_text(config)
        target.chmod(0o644)
        link.symlink_to(target)
        legacy.write_text('# Redirects moved to sites-available/matchlove; backup: '+str(backup)+'\n')
        root.write_text('# Redirects moved to sites-available/matchlove; backup: '+str(backup)+'\n')
        run('nginx','-t')
        env.write_text(re.sub(r'^PUBLIC_ORIGIN=.*$', 'PUBLIC_ORIGIN=https://matchlove.cityai.site',text,flags=re.M))
        run('systemctl','restart','lovelevel')
        run('curl','--fail','--silent','--retry','10','--retry-connrefused','--retry-delay','1','--max-time','3','http://127.0.0.1:3118/health')
        run('systemctl','reload','nginx')
        # Graceful reload can return while old workers still serve their previous TLS vhosts.
        # Retry with normal certificate/hostname verification instead of immediately rolling back.
        verify_https(DOMAINS[0])
        for domain in DOMAINS[1:]:
            verify_https(domain,expected='302|https://matchlove.cityai.site/')
        verify_https('cityai.site','/app',expected='302|https://matchlove.cityai.site/')
    except BaseException:
        print('Verification failed; restoring previous Nginx and application settings',file=sys.stderr)
        for name,path in files.items():
            shutil.copy2(backup/name,path)
        link.unlink(missing_ok=True)
        target.unlink(missing_ok=True)
        for args in [('nginx','-t'),('systemctl','restart','lovelevel'),('systemctl','reload','nginx')]:
            try:
                run(*args)
            except Exception:
                print('Rollback step needs inspection: '+' '.join(args),file=sys.stderr)
        raise
    print('OK: https://matchlove.cityai.site/')
    print('OK: lovelevel.cityai.site, cityai.site and /app redirect to MatchLove')
    print('Stage and Business Pulse vhost files were not modified')
    print('Accounts and photos are unchanged; sign in again on the new domain')

if __name__=='__main__':
    try:
        with open('/run/lock/lovelevel-deploy.lock','a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            main()
    except Exception as error:
        # Never print environment contents or provider command output here.
        print('Domain switch stopped: '+str(error),file=sys.stderr)
        sys.exit(1)
