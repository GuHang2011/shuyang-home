"""Verify a locally built delivery directory and its ZIP without reading live data."""
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
name = sys.argv[1] if len(sys.argv) > 1 else 'shuyang-home-20261028-r4'
if not name or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in name):
    raise SystemExit('Invalid package name')
folder = root / 'release' / name
archive = folder.with_suffix('.zip')
manifest = {}
for line in (folder / 'SHA256SUMS').read_text(encoding='utf-8-sig').splitlines():
    digest, path = line.split('  ', 1)
    manifest[path] = digest
files = {p.relative_to(folder).as_posix(): p for p in folder.rglob('*') if p.is_file()}
assert set(files) == set(manifest) | {'SHA256SUMS'}, 'Unlisted or missing files'
for relative, path in files.items():
    assert not any(part in {'.cache', 'archives', 'node_modules', 'data', 'output', '.git'} for part in path.relative_to(folder).parts), relative
    assert not relative.endswith(('.mv.db', '.trace.db', '.env', '.pem', '.key')), relative
    assert path.name != 'runtime.json', relative
    content = path.read_bytes()
    assert b'CommunityAdmin2026' not in content and b'CommunityMember2026' not in content, relative
    if relative != 'SHA256SUMS':
        assert hashlib.sha256(content).hexdigest() == manifest[relative], relative
with zipfile.ZipFile(archive) as z:
    entries = {p.filename.replace('\\', '/'): p for p in z.infolist() if not p.is_dir()}
    assert set(entries) == {name + '/' + path for path in files}, 'ZIP file set differs'
    for relative, path in files.items():
        assert z.read(entries[name + '/' + relative]) == path.read_bytes(), relative
with zipfile.ZipFile(folder / 'backend/shuyang-home-1.0.0.jar') as jar:
    classes = jar.namelist()
    for required in ['ChatController', 'WeatherController', 'WeatherService', 'MediaService', 'MediaController', 'GalleryController', 'ShopController', 'CheckinController', 'ForumPolicy', 'ForumModerationController']:
        assert 'BOOT-INF/classes/com/example/Kcsj/membership/' + required + '.class' in classes
    assert not any('/erp/' in p or p.endswith('Tests.class') for p in classes), 'Old or test classes included'
    for path in classes:
        if path.startswith('BOOT-INF/classes/') and not path.endswith('/'):
            content = jar.read(path)
            assert b'CommunityAdmin2026' not in content and b'CommunityMember2026' not in content, path
print(json.dumps({'package': name, 'files': len(files), 'bytes': archive.stat().st_size,
                  'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'verified': True}))
