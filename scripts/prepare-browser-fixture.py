"""Initialise only the isolated preview administrator for browser acceptance."""
import json
from pathlib import Path
from urllib.request import Request, urlopen
root = Path(__file__).resolve().parent.parent
config = json.loads((root / '.cache/membership-preview/runtime.json').read_text(encoding='utf-8-sig'))
assert config['backend'] == 'http://127.0.0.1:19999' and config['database'].startswith('isolated in-memory')
def call(path, body, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    with urlopen(Request(config['backend'] + path, json.dumps(body).encode(), headers)) as response:
        return json.load(response)['data']
result = call('/auth/login', {'username': 'admin', 'password': config['password']})
call('/auth/password', {'oldPassword': config['password'], 'newPassword': 'BrowserAdmin2026'}, result['token'])
print('Isolated browser administrator prepared; production database untouched.')
