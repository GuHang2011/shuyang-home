"""Verify a locally built delivery directory and its ZIP without reading live data."""
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
version = (root / 'VERSION').read_text(encoding='utf-8').strip()
name = sys.argv[1] if len(sys.argv) > 1 else 'shuyang-home-v' + version
if not re.fullmatch(r'[a-z0-9][a-z0-9.-]*', name):
    raise SystemExit('Invalid package name')
folder = root / 'release' / name
archive = Path(str(folder) + '.zip')
# An explicitly selected historical package keeps its own version after a bump.
version = (folder / 'VERSION').read_text(encoding='utf-8').strip()
assert re.fullmatch(r'\d+\.\d+\.\d+', version), 'Invalid package version'
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
with zipfile.ZipFile(folder / ('backend/shuyang-home-' + version + '.jar')) as jar:
    classes = jar.namelist()
    for required in ['ChatController', 'WeatherController', 'WeatherService', 'MediaService', 'MediaController', 'GalleryController', 'ShopController', 'CheckinController', 'ForumPolicy', 'ForumModerationController']:
        assert 'BOOT-INF/classes/com/example/Kcsj/membership/' + required + '.class' in classes
    if tuple(map(int, version.split('.'))) >= (1, 4, 0):
        for required in ['StickerController', 'StickerCatalog']:
            assert 'BOOT-INF/classes/com/example/Kcsj/membership/' + required + '.class' in classes
        catalogue = json.loads(jar.read('BOOT-INF/classes/stickers/catalog.json'))
        stickers = [item['id'] for pack in catalogue for item in pack['stickers']]
        assert len(stickers) >= 12 and len(stickers) == len(set(stickers)), 'Incomplete sticker catalogue'
        for sticker in stickers:
            assert re.fullmatch(r'[a-z0-9-]{1,40}', sticker), 'Invalid sticker id'
            assert jar.read('BOOT-INF/classes/stickers/' + sticker + '.png').startswith(b'\x89PNG\r\n\x1a\n'), sticker
    if tuple(map(int, version.split('.'))) >= (1, 5, 0):
        for required in ['BusinessFilesController', 'BusinessWorkbook']:
            assert 'BOOT-INF/classes/com/example/Kcsj/membership/' + required + '.class' in classes
        assert any(path.startswith('BOOT-INF/lib/poi-ooxml-') for path in classes), 'Missing XLSX runtime'
    assert not any('/erp/' in p or p.endswith('Tests.class') for p in classes), 'Old or test classes included'
    for path in classes:
        if path.startswith('BOOT-INF/classes/') and not path.endswith('/'):
            content = jar.read(path)
            assert b'CommunityAdmin2026' not in content and b'CommunityMember2026' not in content, path
print(json.dumps({'package': name, 'version': version, 'files': len(files), 'bytes': archive.stat().st_size,
                  'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'verified': True}))
