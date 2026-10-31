"""Fail closed when a Playwright CLI audit log has no successful JSON result."""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'output/module-audit'
names = ['engagement', 'support-mobile', 'support-complete', 'navigation', 'photos',
         'shop', 'checkin', 'module-flows', 'session-recovery', 'chromium-matrix',
         'webkit-matrix', 'chromium-resilience', 'webkit-resilience']
reports = {}
for name in names:
    try:
        raw = (output / (name + '.log')).read_bytes()
        text = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
        match = re.search(r'### Result\s*\n(.*?)\r?\n###', text, re.S)
        if not match or '### Error' in text:
            raise ValueError('Missing successful CLI result or script error')
        data = json.loads(match.group(1))
        if not isinstance(data, dict) or not data:
            raise ValueError('Expected a non-empty result object')
        if data.get('failed') or data.get('pageErrors') or data.get('runtimeErrors'):
            raise ValueError('Reported failed checks or browser exceptions')
        if any(row.get('status') != 'passed' for row in data.get('results', [])):
            raise ValueError('A matrix check did not pass')
        reports[name] = {'status': 'passed', 'result': data}
        print(name, 'PASS', data.get('count', data.get('passed', '')) if isinstance(data.get('passed'), int) or 'count' in data else '')
    except (OSError, ValueError, TypeError) as error:
        reports[name] = {'status': 'failed', 'error': str(error)}
        print(name, 'FAIL:', error)
output.mkdir(parents=True, exist_ok=True)
(output / 'browser-summary.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
sys.exit(1 if any(row['status'] != 'passed' for row in reports.values()) else 0)
