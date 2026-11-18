"""Run the real Nginx template against a disposable production JAR and static builds.

Requires JAVA_HOME, SHUYANG_NGINX_PATH and SHUYANG_OPENSSL_PATH. Uses only temporary
data, local ports and a generated local TLS certificate; never changes system services.
"""
import base64
import gzip
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import ssl
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[1]
nginx = Path(os.environ['SHUYANG_NGINX_PATH']).resolve()
openssl = Path(os.environ['SHUYANG_OPENSSL_PATH']).resolve()
java = Path(os.environ['JAVA_HOME']) / 'bin' / ('java.exe' if os.name == 'nt' else 'java')
version = (root / 'VERSION').read_text().strip()
output = root / 'output' / 'production-proxy'
output.mkdir(parents=True, exist_ok=True)
flags = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


with tempfile.TemporaryDirectory(prefix='shuyang-proxy-') as temp:
    work = Path(temp).resolve()
    assert work.parent == Path(tempfile.gettempdir()).resolve()
    backend_port, https_port, http_port = port(), port(), port()
    (work / 'logs').mkdir()
    (work / 'temp').mkdir()
    shutil.copyfile(nginx.parent / 'conf/mime.types', work / 'mime.types')
    shutil.copytree(root / 'frontend/dist', work / 'site')
    shutil.copytree(root / 'frontend/mobile/dist/build/h5', work / 'site/mobile')
    subprocess.run([str(openssl), 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
        '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
        '-keyout', str(work / 'key.pem'), '-out', str(work / 'cert.pem')], check=True, capture_output=True, **flags)
    template = (root / 'deploy/nginx.conf.example').read_text()
    template = template.replace('listen 80;', f'listen 127.0.0.1:{http_port};').replace('listen 443 ssl;', f'listen 127.0.0.1:{https_port} ssl;')
    template = template.replace('/etc/letsencrypt/live/members.example.com/fullchain.pem', (work / 'cert.pem').as_posix())
    template = template.replace('/etc/letsencrypt/live/members.example.com/privkey.pem', (work / 'key.pem').as_posix())
    template = template.replace('/var/www/shuyang-home', (work / 'site').as_posix()).replace('members.example.com', 'localhost')
    template = template.replace('127.0.0.1:9999', f'127.0.0.1:{backend_port}')
    config = f'worker_processes 1;\npid logs/proxy.pid;\nerror_log logs/error.log;\nevents {{ worker_connections 128; }}\nhttp {{\ninclude mime.types;\naccess_log off;\n{template}\n}}\n'
    (work / 'nginx.conf').write_text(config, encoding='utf-8')
    command = [str(nginx), '-p', work.as_posix() + '/', '-c', 'nginx.conf']
    syntax = subprocess.run([*command, '-t'], capture_output=True, **flags)
    assert syntax.returncode == 0, syntax.stderr.decode(errors='replace')
    env = {**os.environ, 'SHUYANG_PORT': str(backend_port), 'SHUYANG_DB_URL': 'jdbc:h2:file:' + (work / 'data').as_posix(),
        'SHUYANG_DB_PASSWORD': secrets.token_hex(24), 'SHUYANG_DATA_KEY': base64.b64encode(secrets.token_bytes(32)).decode(),
        'SHUYANG_ADMIN_PASSWORD': 'Initial9' + secrets.token_hex(16), 'SHUYANG_ALLOWED_ORIGINS': 'https://127.0.0.1:' + str(https_port),
        'SHUYANG_WEATHER_LOCAL_NETWORK': 'false', 'SHUYANG_AI_ENABLED': 'false'}
    backend = proxy = None
    context = ssl.create_default_context(cafile=str(work / 'cert.pem'))
    origin = 'https://127.0.0.1:' + str(https_port)
    try:
        with (output / 'backend.log').open('w', encoding='utf-8') as log:
            backend = subprocess.Popen([str(java), '-Xmx512m', '-jar', str(root / 'backend/target' / ('shuyang-home-' + version + '.jar')), '--spring.profiles.active=prod'], env=env, stdout=log, stderr=subprocess.STDOUT, **flags)
            proxy = subprocess.Popen([*command, '-g', 'daemon off;'], cwd=work, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **flags)
            for _ in range(100):
                try:
                    with urlopen(origin + '/api/health', context=context, timeout=2) as response:
                        if response.status == 200:
                            break
                except (OSError, URLError):
                    time.sleep(.2)
            else:
                raise RuntimeError('Local HTTPS service did not become ready')
            def deployment_check():
                return subprocess.run([os.sys.executable, str(root / 'scripts/check-deployment.py'), origin, '--mobile'],
                    env={**os.environ, 'SSL_CERT_FILE': str(work / 'cert.pem')}, capture_output=True, text=True, encoding='utf-8', **flags)

            result = deployment_check()
            (output / 'checks.log').write_text(result.stdout + result.stderr, encoding='utf-8')
            print(result.stdout, end='')
            assert result.returncode == 0, result.stderr
            # Mutate only this disposable site's manifest to reproduce mixed/demo deployments.
            metadata_path = work / 'site/mobile/release.json'
            metadata_original = metadata_path.read_bytes()
            regressions = []
            try:
                for label, change in [('old H5 version', {'version': '0.0.0'}), ('demo H5 build', {'demo': True})]:
                    metadata = json.loads(metadata_original)
                    metadata.update(change)
                    metadata_path.write_text(json.dumps(metadata), encoding='utf-8')
                    changed_result = deployment_check()
                    rejected = changed_result.returncode != 0 and 'FAIL /mobile/release.json expected production h5 release' in changed_result.stdout and 'Completed: 1 failure(s).' in changed_result.stdout
                    regressions.append((label, rejected))
                    print(('PASS:' if rejected else 'FAIL:'), 'deployment checker rejects', label)
            finally:
                metadata_path.write_bytes(metadata_original)
            # Verify actual wire compression and decoded bytes, not merely config text.
            compression = []
            for suffix in ['js', 'css']:
                asset = max((work / 'site/assets').glob('*.' + suffix), key=lambda path: path.stat().st_size)
                with urlopen(Request(origin + '/assets/' + asset.name, headers={'Accept-Encoding': 'gzip'}), context=context, timeout=10) as response:
                    payload = response.read()
                    compressed = response.headers.get('Content-Encoding') == 'gzip'
                    regressions.append((suffix + ' compression', compressed))
                    if compressed:
                        assert gzip.decompress(payload) == asset.read_bytes()
                        assert len(payload) < asset.stat().st_size
                        assert 'Accept-Encoding' in response.headers.get('Vary', '')
                    compression.append({'type': suffix, 'original': asset.stat().st_size, 'transferred': len(payload)})
                    print(('PASS:' if compressed else 'FAIL:'), suffix, 'wire compression:', len(payload), '/', asset.stat().st_size)
            assert all(passed for _, passed in regressions), regressions
            for route, expected in [('/api/data-files/preview', 401), ('/api/auth/login', 413)]:
                try:
                    response = urlopen(Request(origin + route, data=json.dumps({'kind': 'members', 'base64': 'A' * 100000}).encode(), headers={'Content-Type': 'application/json'}), context=context, timeout=10)
                except HTTPError as error:
                    response = error
                with response:
                    assert response.status == expected, (route, response.status, expected)
                print('PASS:', route, 'request-size policy')
            if os.environ.get('SHUYANG_CHROMIUM_PATH'):
                def fixture_request(route, body, token=None):
                    headers = {'Content-Type': 'application/json'}
                    if token:
                        headers['Authorization'] = 'Bearer ' + token
                    try:
                        response = urlopen(Request(origin + '/api' + route, data=json.dumps(body).encode(), headers=headers), context=context, timeout=10)
                    except HTTPError as error:
                        # Do not include request bodies, headers or authentication responses in logs.
                        raise AssertionError(f'Browser fixture failed: {route} HTTP {error.code}') from None
                    with response:
                        assert response.status == 200, (route, response.status)
                        return json.load(response)['data']

                admin = fixture_request('/auth/login', {'username': 'admin', 'password': env['SHUYANG_ADMIN_PASSWORD']})['token']
                admin = fixture_request('/auth/password', {'oldPassword': env['SHUYANG_ADMIN_PASSWORD'], 'newPassword': 'Changed9' + secrets.token_hex(16)}, admin)['token']
                profile = {'phone': '13800005552', 'password': 'Fixture9' + secrets.token_hex(16), 'name': '高铁版主权限验收', 'hometown': '沭阳', 'district': '苏州', 'consent': True, 'volunteer': False, 'directoryVisible': False, 'phoneVisible': False}
                member = fixture_request('/auth/register', profile)['user']
                fixture_request('/admin/members/' + member['id'] + '/review', {'status': 'approved', 'note': ''}, admin)
                browser_env = {**os.environ, 'SHUYANG_TEST_ADMIN_TOKEN': admin, 'SHUYANG_TEST_MEMBER_ID': member['id'], 'SHUYANG_TEST_MEMBER_NAME': profile['name']}
                browser = subprocess.run(['node', str(root / 'scripts/test-production-browser.cjs'), origin], env=browser_env, capture_output=True, text=True, encoding='utf-8', **flags)
                (output / 'browser.log').write_text(browser.stdout + browser.stderr, encoding='utf-8')
                print(browser.stdout, end='')
                assert browser.returncode == 0, browser.stderr
            (output / 'result.json').write_text(json.dumps({'version': version, 'https': True, 'checks': 16, 'passed': True, 'compression': compression}), encoding='utf-8')
    finally:
        if proxy:
            subprocess.run([*command, '-s', 'quit'], capture_output=True, **flags)
            try:
                proxy.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proxy.terminate();proxy.wait(timeout=5)
        if backend and backend.poll() is None:
            backend.terminate();backend.wait(timeout=45)
