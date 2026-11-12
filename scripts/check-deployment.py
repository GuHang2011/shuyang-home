"""Read-only checks for the HTTPS website after deployment; never uses a login token."""
import argparse
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url', help='Site origin, for example https://members.your-domain.cn')
    parser.add_argument('--mobile', action='store_true', help='Also verify the optional /mobile/ H5 deployment')
    args = parser.parse_args()
    origin = args.url.rstrip('/')
    parsed = urlsplit(origin)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.path or parsed.query or parsed.fragment or parsed.username:
        parser.error('Provide a plain HTTPS site origin without a path, credentials, query or fragment')
    failures = []

    def check(path, status=200, kind='json'):
        try:
            try:
                response = urlopen(Request(origin + path, headers={'User-Agent': 'Shuyang-Deployment-Check'}), timeout=20)
            except HTTPError as error:
                response = error
            with response:
                body = response.read(2 * 1024 * 1024).decode('utf-8', errors='replace')
                if response.status != status:
                    raise ValueError(f'expected HTTP {status}, got {response.status}')
                if kind and kind not in response.headers.get('Content-Type', ''):
                    raise ValueError('unexpected Content-Type')
                if path in ['/', '/mobile/', '/api/health'] and 'no-store' not in response.headers.get('Cache-Control', ''):
                    raise ValueError('missing no-store cache policy')
                if response.headers.get('X-Content-Type-Options') != 'nosniff':
                    raise ValueError('missing nosniff header')
                if path == '/api/health' and json.loads(body).get('data', {}).get('status') != 'up':
                    raise ValueError('database readiness check failed')
                print('PASS', path)
                return body
        except (ValueError, URLError, OSError) as error:
            failures.append(path)
            print('FAIL', path, str(error))
            return ''

    for page in ['/', *(['/mobile/'] if args.mobile else [])]:
        html = check(page, kind='text/html')
        scripts = re.findall(r'<script[^>]+src="([^"]+\.js)"', html)
        if not scripts:
            failures.append(page + ' script');print('FAIL', page, 'missing entry script')
        for script in scripts:
            asset = script if script.startswith('/') else page + script.removeprefix('./')
            check(asset, kind='javascript')
    check('/api/health')
    check('/api/auth/me', 401)
    check('/assets/nonexistent-deployment-check.js', 404, '')
    check('/demo-worker.js', 404, '')
    print(f'Completed: {len(failures)} failure(s).')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
