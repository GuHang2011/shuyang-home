"""Exercise a packaged JAR with a disposable encrypted file DB, never live data."""
import base64
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[1]
java = Path(os.environ['JAVA_HOME']) / 'bin' / ('java.exe' if os.name == 'nt' else 'java')
version = (root / 'VERSION').read_text().strip()
jar = root / 'backend' / 'target' / ('shuyang-home-' + version + '.jar')
output = root / 'output' / 'production-runtime'
output.mkdir(parents=True, exist_ok=True)
checks = []
process = None
log = None


def check(condition, label):
    assert condition, label
    checks.append(label)
    print('PASS:', label, flush=True)


def stop():
    global process, log
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=45)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    if log:
        log.close()


def launch(env, database, name):
    global process, log
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    env = {**env, 'SHUYANG_DB_URL': 'jdbc:h2:file:' + database.as_posix() + ';DB_CLOSE_ON_EXIT=FALSE', 'SHUYANG_PORT': str(port)}
    log = (output / (name + '.log')).open('w', encoding='utf-8')
    process = subprocess.Popen([str(java), '-Xmx512m', '-jar', str(jar), '--spring.profiles.active=prod'],
        cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    return 'http://127.0.0.1:' + str(port)


def request(origin, path, body=None, token=None, expected=200):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    payload = None if body is None else json.dumps(body).encode()
    try:
        response = urlopen(Request(origin + path, data=payload, headers=headers), timeout=5)
    except HTTPError as error:
        response = error
    with response:
        assert response.status == expected, (path, expected, response.status)
        assert response.headers.get('Cache-Control') == 'no-store'
        return json.load(response)


def wait_ready(origin):
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError('Backend exited. Inspect ' + str(output))
        try:
            if request(origin, '/health')['data']['status'] == 'up':
                return
        except (OSError, URLError):
            pass
        time.sleep(.2)
    raise RuntimeError('Backend startup timed out')


try:
    with tempfile.TemporaryDirectory(prefix='syh-launch-', dir=output) as temp:
        work = Path(temp)
        config = work / 'production.env'
        command = [os.sys.executable, str(root / 'scripts/create-production-config.py'), '--domain', 'members.launch.test', '--output', str(config)]
        generated = subprocess.run(command, capture_output=True, text=True, check=True)
        original = config.read_bytes()
        values = dict(line.split('=', 1) for line in original.decode().splitlines() if line and not line.startswith('#'))
        check(len(base64.b64decode(values['SHUYANG_DATA_KEY'])) == 32 and values['SHUYANG_ADMIN_PASSWORD'] not in generated.stdout, 'configuration creates an AES-256 key without printing secrets')
        second = subprocess.run(command, capture_output=True)
        check(second.returncode != 0 and config.read_bytes() == original, 'configuration refuses to overwrite existing keys')
        env = {**os.environ, **values}
        database = work / 'primary'
        launch({**env, 'SHUYANG_DATA_KEY': ''}, database, 'invalid-settings')
        process.wait(timeout=30)
        check(process.returncode != 0 and not database.with_suffix('.mv.db').exists(), 'invalid production settings fail before creating a database')
        stop()
        origin = launch(env, database, 'first-start')
        wait_ready(origin)
        check(True, 'production JAR starts with encrypted file storage and working database health')
        request(origin, '/auth/me', expected=401)
        request(origin, '/missing-launch-route', expected=404)
        check(True, 'anonymous access and unknown routes return controlled 401/404 responses')
        admin = request(origin, '/auth/login', {'username': 'admin', 'password': values['SHUYANG_ADMIN_PASSWORD']})['data']['token']
        denied = request(origin, '/admin/members', token=admin, expected=403)
        check(denied['code'] == 'PASSWORD_CHANGE_REQUIRED', 'initial administrator must change password before management')
        changed = 'Changed9' + secrets.token_hex(16)
        admin = request(origin, '/auth/password', {'oldPassword': values['SHUYANG_ADMIN_PASSWORD'], 'newPassword': changed}, admin)['data']['token']
        profile = {'phone': '13800005551', 'password': 'FixtureMember123456', 'name': '部署验收会员', 'hometown': '沭阳', 'district': '苏州', 'consent': True, 'volunteer': False, 'directoryVisible': False, 'phoneVisible': False}
        member = request(origin, '/auth/register', profile)['data']
        request(origin, '/admin/members/' + member['user']['id'] + '/review', {'status': 'approved', 'note': ''}, admin)
        check(request(origin, '/auth/me', token=member['token'])['data']['status'] == 'approved', 'real registration and administrator approval persist through the HTTP API')
        stop()
        check(b'13800005551' not in database.with_suffix('.mv.db').read_bytes(), 'member data is not stored as plaintext in the file database')
        restored = work / 'restored'
        shutil.copy2(database.with_suffix('.mv.db'), restored.with_suffix('.mv.db'))
        origin = launch({**env, 'SHUYANG_ADMIN_PASSWORD': ''}, restored, 'restored-start')
        wait_ready(origin)
        restored_admin = request(origin, '/auth/login', {'username': 'admin', 'password': changed})['data']['token']
        users = request(origin, '/admin/members', token=restored_admin)['data']
        check(any(row.get('id') == member['user']['id'] for row in users), 'stopped database backup restores members and changed administrator password without re-bootstrap')
        stop()
    (output / 'result.json').write_text(json.dumps({'version': version, 'checks': checks, 'passed': len(checks)}, ensure_ascii=False, indent=2), encoding='utf-8')
finally:
    stop()
