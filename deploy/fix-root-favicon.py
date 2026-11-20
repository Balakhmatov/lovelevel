#!/usr/bin/env python3
"""Patch only icon routes of an already installed MatchLove redirect configuration."""
import re
import subprocess
from pathlib import Path
from datetime import datetime
import shutil

rule = r'''
    # MatchLove icons must retain their path on the redirect domain.
    location ~ ^/(?:favicon(?:-[0-9]+x[0-9]+)?\.(?:ico|png|svg)|apple-touch-icon(?:-precomposed)?\.png|android-chrome-[0-9]+x[0-9]+\.png|site\.webmanifest)$ {
        return 302 https://matchlove.cityai.site$request_uri;
    }
'''

def main():
    files = {p.resolve() for p in Path('/etc/nginx/sites-enabled').iterdir() if p.is_file()}
    changes = {}
    for path in files:
        old = path.read_text()
        if not re.search(r'server_name\s+cityai\.site\s*;', old):
            continue
        if 'location / { return 302 https://matchlove.cityai.site/; }' not in old:
            raise SystemExit(f'Unexpected configuration in {path}; no changes made.')
        if '# MatchLove icons must retain their path' in old:
            continue
        new = re.sub(r'(server_name\s+cityai\.site\s*;)', lambda m: m[0]+rule, old)
        changes[path] = (old,new)
    if not changes:
        print('No changes needed or no cityai.site redirect found.')
        return
    subprocess.run(['nginx','-t'],check=True)
    backup = Path('/root/matchlove-favicon-backup-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    backup.mkdir(mode=0o700)
    for i,path in enumerate(changes):
        shutil.copy2(path,backup/(str(i)+'-'+path.name))
    try:
        for path,(_,new) in changes.items():
            path.write_text(new)
        subprocess.run(['nginx','-t'],check=True)
        subprocess.run(['systemctl','reload','nginx'],check=True)
    except BaseException:
        for path,(old,_) in changes.items():
            path.write_text(old)
        subprocess.run(['nginx','-t'],check=True)
        subprocess.run(['systemctl','reload','nginx'],check=True)
        raise
    print('Updated cityai.site favicon redirects. Backup: '+str(backup))

if __name__=='__main__':
    main()
