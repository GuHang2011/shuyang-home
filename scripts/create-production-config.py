"""Create a new private Linux service environment file without printing secrets."""
import argparse
import base64
import os
from pathlib import Path
import re
import secrets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--domain', required=True, help='Real ASCII hostname, without https:// or a path')
    parser.add_argument('--output', type=Path, required=True, help='New private .env file; existing files are never overwritten')
    args = parser.parse_args()
    domain = args.domain.lower()
    if not re.fullmatch(r'(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}', domain) or domain == 'example.com' or domain.endswith('.example.com'):
        parser.error('Use your real domain name, not the example domain')
    values = {
        'SHUYANG_PORT': '9999',
        'SHUYANG_DB_URL': 'jdbc:h2:file:/var/lib/shuyang-home/shuyang-home;DB_CLOSE_ON_EXIT=FALSE',
        'SHUYANG_DB_USER': 'sa',
        'SHUYANG_DB_PASSWORD': secrets.token_hex(32),
        'SHUYANG_ADMIN_PASSWORD': 'Syh9' + secrets.token_hex(24),
        'SHUYANG_DATA_KEY': base64.b64encode(secrets.token_bytes(32)).decode('ascii'),
        'SHUYANG_ALLOWED_ORIGINS': 'https://' + domain,
        'SHUYANG_WEATHER_LOCAL_NETWORK': 'false',
        'SHUYANG_AI_ENABLED': 'false',
    }
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    try:
        descriptor = os.open(args.output, flags, 0o600)
    except FileExistsError:
        parser.error('File already exists. Preserve the existing database password and encryption key.')
    with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as output:
        output.write('# Private production configuration. Keep the original data key with a separate secure backup.\n')
        for key, value in values.items():
            output.write(key + '=' + value + '\n')
    print('Created private configuration at', args.output)
    print('Read the initial administrator password locally, change it after login, then clear SHUYANG_ADMIN_PASSWORD.')
    print('Keep this file out of Git and never regenerate its database password or data key for an existing database.')


if __name__ == '__main__':
    main()
