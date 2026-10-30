"""Keep the system release version consistent without installing dependencies."""
import argparse
from datetime import date
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = ['CropDiseasesDetection_vue', 'CropDiseasesDetection_vue/mobile']
MANIFEST = 'CropDiseasesDetection_vue/mobile/src/manifest.json'
POM = 'CropDiseasesDetection_springboot/pom.xml'
POM_VERSION = r'(<artifactId>shuyang-home</artifactId>\s*<version>)([^<]+)(</version>)'


def read(path):
    return (ROOT / path).read_text(encoding='utf-8-sig')


def parts(version):
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
        raise ValueError('Use a stable semantic version: MAJOR.MINOR.PATCH')
    major, minor, patch = map(int, version.split('.'))
    if minor > 999 or patch > 999 or major * 1000000 + minor * 1000 + patch > 2147483647:
        raise ValueError('Version exceeds the mobile versionCode range')
    return major, minor, patch


def code(version):
    major, minor, patch = parts(version)
    return major * 1000000 + minor * 1000 + patch


def json_text(data):
    return json.dumps(data, ensure_ascii=False, indent=2) + '\n'


def synchronize(version):
    # Prepare every file before writing, so a malformed manifest causes no edits.
    changes = {'VERSION': version + '\n'}
    for package in PACKAGES:
        for name in ['package.json', 'package-lock.json']:
            path = package + '/' + name
            data = json.loads(read(path))
            data['version'] = version
            if name == 'package-lock.json':
                data['packages']['']['version'] = version
            changes[path] = json_text(data)
    manifest = json.loads(read(MANIFEST))
    manifest.update(versionName=version, versionCode=code(version))
    changes[MANIFEST] = json_text(manifest)
    pom, count = re.subn(POM_VERSION, lambda m: m[1] + version + m[3], read(POM))
    if count != 1:
        raise ValueError('Expected exactly one backend project version')
    changes[POM] = pom
    for path, content in changes.items():
        if read(path) != content:
            (ROOT / path).write_text(content, encoding='utf-8')


def check(version, tag=None):
    expected_code = code(version)
    errors = []
    for package in PACKAGES:
        for name in ['package.json', 'package-lock.json']:
            path = package + '/' + name
            data = json.loads(read(path))
            if data.get('version') != version:
                errors.append(path + ': version differs from VERSION')
            if name == 'package-lock.json' and data['packages'][''].get('version') != version:
                errors.append(path + ': root package version differs')
    manifest = json.loads(read(MANIFEST))
    if manifest.get('versionName') != version or manifest.get('versionCode') != expected_code:
        errors.append(MANIFEST + ': versionName/versionCode differ')
    match = re.search(POM_VERSION, read(POM))
    if not match or match[2] != version:
        errors.append(POM + ': backend version differs')
    entry = re.search(r'^## \[' + re.escape(version) + r'\] - \d{4}-\d{2}-\d{2}\n(.*?)(?=^## |\Z)', read('CHANGELOG.md'), re.M | re.S)
    if not entry or 'TODO' in entry[1] or not re.search(r'^- \S', entry[1], re.M):
        errors.append('CHANGELOG.md: add completed release notes for ' + version)
    if tag and tag != 'v' + version:
        errors.append('Git tag must be v' + version)
    if errors:
        raise ValueError('\n'.join(errors))
    print('PASS: v' + version + ' matches Web, mobile, lockfiles, manifest, backend and changelog')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    checking = commands.add_parser('check')
    checking.add_argument('--tag', help='Also verify a release tag, for example v1.2.0')
    commands.add_parser('sync', help='Synchronize all versions from VERSION')
    bumping = commands.add_parser('bump', help='Increment a version and create a changelog entry; never commits or pushes')
    bumping.add_argument('level', choices=['patch', 'minor', 'major'])
    args = parser.parse_args()
    version = read('VERSION').strip()
    parts(version)
    if args.command == 'check':
        check(version, args.tag)
    elif args.command == 'sync':
        synchronize(version)
        check(version)
    else:
        check(version)
        major, minor, patch = parts(version)
        next_parts = {'patch': (major, minor, patch + 1), 'minor': (major, minor + 1, 0), 'major': (major + 1, 0, 0)}[args.level]
        next_version = '.'.join(map(str, next_parts))
        parts(next_version)
        changelog = read('CHANGELOG.md')
        heading = re.search(r'^## ', changelog, re.M)
        entry = f'## [{next_version}] - {date.today().isoformat()}\n\n- TODO: describe the changes and verification for this release.\n\n'
        index = heading.start() if heading else len(changelog)
        synchronize(next_version)
        (ROOT / 'CHANGELOG.md').write_text(changelog[:index] + entry + changelog[index:], encoding='utf-8')
        print('Updated to v' + next_version + '. Complete CHANGELOG.md, then run check before committing.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        raise SystemExit(str(error))
