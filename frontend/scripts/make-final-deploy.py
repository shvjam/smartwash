"""
Builds finalfrontdeploy.zip: the production web app, ready to extract into the site root.

    py frontend/scripts/make-final-deploy.py

Two things this guards against, both of which have shipped broken packages before:

* Vite reads .env.local in every mode, production included. A developer's .env.local points
  the app at http://localhost:5080, and a build made on that machine quietly calls localhost
  from the live site. The API address is therefore passed to the build explicitly, and the
  package is refused if a local API address (localhost or 127.0.0.1 with a port) appears
  anywhere in the bundle. React Router's own "http://localhost" default has no port and is
  not a problem.

* A zip written by Windows tools can store paths with backslashes ("assets\\index.js"). Some
  hosts extract those as single files with a backslash in the name, so the site loads with
  no scripts. Every entry here is written with forward slashes.
"""
import os
import pathlib
import re
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
OUT = ROOT / 'finalfrontdeploy.zip'
API = os.environ.get('SMARTWASH_API', 'https://api.appsmartwash.com')
LOCAL_API = re.compile(r'https?://(?:localhost|127\.0\.0\.1):\d+')


def main() -> None:
    env = {**os.environ, 'VITE_API_BASE_URL': API}
    subprocess.run('pnpm build', cwd=ROOT, env=env, shell=True, check=True)

    leaks = [f.relative_to(DIST).as_posix() for f in DIST.rglob('*.js')
             if LOCAL_API.search(f.read_text(encoding='utf-8', errors='ignore'))]
    if leaks:
        sys.exit(f'refusing to package: a local API address is baked into {leaks}')
    if not (DIST / 'web.config').exists():
        sys.exit('dist/web.config is missing; IIS would not rewrite routes to index.html')

    if OUT.exists():
        OUT.unlink()
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in sorted(DIST.rglob('*')):
            if f.is_file():
                z.write(f, f.relative_to(DIST).as_posix())

    with zipfile.ZipFile(OUT) as z:
        names = z.namelist()
    print(f'{OUT.name}: {len(names)} files, {OUT.stat().st_size / (1024 * 1024):.1f} MB')
    print('  api                   :', API)
    print('  index.html            :', 'index.html' in names)
    print('  web.config            :', 'web.config' in names)
    print('  photos                :', sum(1 for n in names if n.startswith('assets/photos/')))
    print('  backslash paths       :', sum(1 for n in names if '\\' in n))


if __name__ == '__main__':
    main()
