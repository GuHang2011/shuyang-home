"""Fail closed on missing/incomplete Playwright CLI results (including UTF-16 logs)."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
checks = [
    ('sticker-browser.log', 'chromium', 76, 'passed'),
    ('sticker-webkit-browser.log', 'webkit', 76, 'passed'),
    ('sticker-mobile-matrix.log', 'chromium', 112, 'status'),
    ('sticker-webkit-matrix.log', 'webkit', 112, 'status'),
]
total = 0
for filename, engine, expected, field in checks:
    raw = (root / 'output' / filename).read_bytes()
    content = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
    if '### Error' in content or '### Result' not in content:
        raise SystemExit(f'FAIL: {filename}: no completed result')
    result, _ = json.JSONDecoder().raw_decode(content.split('### Result', 1)[1].lstrip())
    rows = result.get('results', [])
    if (result.get('engine') != engine or result.get('passed') != expected or result.get('failed') != 0
            or len(rows) != expected or result.get('errors') or result.get('pageErrors')
            or not all(row.get(field) == (True if field == 'passed' else 'passed') for row in rows)):
        raise SystemExit(f'FAIL: {filename}: incomplete or failing checks')
    total += expected
    print(f'PASS: {engine} {filename}: {expected} checks')
print(f'PASS: {total} browser checks; no uncaught page errors')
