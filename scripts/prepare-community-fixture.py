"""Test members for the isolated community browser review; never production."""
import json
from pathlib import Path
from urllib.request import Request, urlopen
root = Path(__file__).resolve().parent.parent
config = json.loads((root / '.cache/membership-preview/runtime.json').read_text(encoding='utf-8-sig'))
assert config['backend'] == 'http://127.0.0.1:19999' and config['database'].startswith('isolated in-memory')
def call(path, data, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    with urlopen(Request(config['backend'] + path, json.dumps(data).encode(), headers)) as response:
        return json.load(response)['data']
result = call('/auth/login', {'username': 'admin', 'password': config['password']})
admin = call('/auth/password', {'oldPassword': config['password'], 'newPassword': 'CommunityAdmin2026'}, result['token'])['token']
for phone, name in [('13800008881', '资源主人测试'), ('13800008882', '交换申请测试')]:
    member = call('/auth/register', {'phone': phone, 'password': 'CommunityMember2026', 'name': name, 'hometown': '沭阳沭城', 'district': '苏州吴中', 'industry': '验收测试', 'bio': '仅用于隔离浏览器验收', 'consent': True, 'volunteer': True, 'directoryVisible': True, 'phoneVisible': False})
    call('/admin/members/' + member['user']['id'] + '/review', {'status': 'approved', 'note': ''}, admin)
print('Two isolated community test members prepared.')
