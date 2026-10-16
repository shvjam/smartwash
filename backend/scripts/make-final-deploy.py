"""
Builds finalbackdeploy.zip: the published API with its configuration inside, ready to extract
into the site root with nothing left to edit on the server.

    python backend/scripts/make-final-deploy.py "<connection string>"

Two things about this host shape the package:

* Extracting over the site in the Plesk file manager has more than once left an old web.config
  in place. Anything carried only in web.config - the connection string, the signing key - was
  then silently missing. So configuration ships in appsettings.secrets.config, which the app
  reads itself, and web.config only has to point IIS at the app. The .config extension also
  keeps IIS from serving the file even if the ASP.NET Core handler were ever absent.

* The build is framework-dependent and relies on the .NET 8 runtime the host has installed.
  A self-contained build only works when IIS launches the bundled executable; if a stale
  web.config launches it through `dotnet` instead, it fails with HTTP 500.31. A
  framework-dependent build runs either way.

The connection string is the one secret that is never stored in this repository, so it is
passed in. Everything else comes from backend/web.config.filled, which is gitignored.
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'src' / 'SmartWash.Api' / 'SmartWash.Api.csproj'
PUBLISH = ROOT / 'publish-fdd'
TEMPLATE = ROOT / 'web.config.filled'
SECRETS = ROOT / 'appsettings.secrets.config'
OUT = ROOT / 'finalbackdeploy.zip'

# Only the ASP.NET Core module registration and the environment name. Everything the app
# needs to run lives in appsettings.secrets.config.
WEB_CONFIG = '''<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <location path="." inheritInChildApplications="false">
    <system.webServer>
      <handlers>
        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
      </handlers>
      <aspNetCore processPath="dotnet"
                  arguments=".\\SmartWash.Api.dll"
                  stdoutLogEnabled="true"
                  stdoutLogFile=".\\App_Data\\logs\\stdout"
                  hostingModel="inprocess">
        <environmentVariables>
          <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
        </environmentVariables>
      </aspNetCore>
      <httpErrors existingResponse="PassThrough" />
    </system.webServer>
  </location>
</configuration>
'''


def nest(flat: dict) -> dict:
    """Turns A__B__C keys into nested JSON, the shape .NET configuration expects."""
    out: dict = {}
    for key, value in flat.items():
        parts = key.split('__')
        node = out
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        leaf = parts[-1]
        if value.lower() in ('true', 'false'):
            node[leaf] = value.lower() == 'true'
        else:
            node[leaf] = value
    # Numeric keys under a section are array entries (Cors:AllowedOrigins:0).
    def arrays(n):
        if isinstance(n, dict):
            if n and all(k.isdigit() for k in n):
                return [arrays(n[k]) for k in sorted(n, key=int)]
            return {k: arrays(v) for k, v in n.items()}
        return n
    return arrays(out)


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].strip():
        sys.exit('usage: make-final-deploy.py "<connection string>"')
    conn = sys.argv[1].strip()

    parts = {k.strip().lower(): v for k, v in (p.split('=', 1) for p in conn.split(';') if '=' in p)}
    if not any(k in parts for k in ('server', 'data source')):
        sys.exit('connection string has no Server / Data Source')
    if not any(k in parts for k in ('database', 'initial catalog')):
        sys.exit('connection string has no Database / Initial Catalog')

    template = ET.fromstring(TEMPLATE.read_text(encoding='utf-8').encode('utf-8'))
    flat = {e.get('name'): e.get('value') for e in template.iter('environmentVariable')}
    flat['ConnectionStrings__Default'] = conn
    flat.pop('ASPNETCORE_ENVIRONMENT', None)
    flat.pop('ASPNETCORE_DETAILEDERRORS', None)

    bad = [k for k, v in flat.items() if not v or 'REPLACE-WITH' in v or v.startswith('PASTE-')]
    if bad:
        sys.exit(f'unfilled values: {bad}')

    settings = nest(flat)
    SECRETS.write_text(json.dumps(settings, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if PUBLISH.exists():
        shutil.rmtree(PUBLISH)
    subprocess.run(
        ['dotnet', 'publish', str(PROJECT), '-c', 'Release', '-r', 'win-x64',
         '--self-contained', 'false', '-o', str(PUBLISH), '--nologo', '-v', 'quiet'],
        check=True)

    runtime = json.loads((PUBLISH / 'SmartWash.Api.runtimeconfig.json').read_text(encoding='utf-8'))
    frameworks = runtime['runtimeOptions'].get('frameworks') or [runtime['runtimeOptions'].get('framework')]
    if runtime['runtimeOptions'].get('includedFrameworks'):
        sys.exit('publish came out self-contained; expected framework-dependent')

    with tempfile.TemporaryDirectory() as tmp:
        stage = pathlib.Path(tmp) / 'pkg'
        shutil.copytree(PUBLISH, stage)
        (stage / 'web.config').write_text(WEB_CONFIG, encoding='utf-8')
        shutil.copy2(SECRETS, stage / 'appsettings.secrets.config')
        logs = stage / 'App_Data' / 'logs'
        logs.mkdir(parents=True, exist_ok=True)
        (logs / '.keep').write_text('IIS stdout and Serilog logs are written here.\n', encoding='utf-8')

        if OUT.exists():
            OUT.unlink()
        with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
            for f in sorted(stage.rglob('*')):
                arc = f.relative_to(stage).as_posix()
                if f.is_dir():
                    z.writestr(arc + '/', '')
                else:
                    z.write(f, arc)

    with zipfile.ZipFile(OUT) as z:
        names = z.namelist()
    print(f'{OUT.name}: {sum(1 for n in names if not n.endswith("/"))} files, '
          f'{OUT.stat().st_size / (1024 * 1024):.1f} MB')
    print('  frameworks            :', ', '.join(f"{f['name']} {f['version']}" for f in frameworks if f))
    print('  web.config            :', 'web.config' in names)
    print('  secrets file          :', 'appsettings.secrets.config' in names)
    print('  SmartWash.Api.dll     :', 'SmartWash.Api.dll' in names)
    print('  App_Data/logs         :', any(n.startswith('App_Data/logs/') for n in names))
    print('  migrate on startup    :', settings['Database']['MigrateOnStartup'])
    print('  database              :', parts.get('database') or parts.get('initial catalog'))


if __name__ == '__main__':
    main()
