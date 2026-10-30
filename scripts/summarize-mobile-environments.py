"""Extract machine-readable results from Playwright CLI logs (PowerShell or UTF-8)."""
import json
import re
import sys
from pathlib import Path

output = Path(__file__).resolve().parents[1] / 'output/mobile-environments'
reports = {}
for name in ['chromium-matrix', 'webkit-matrix', 'chromium-resilience', 'webkit-resilience']:
    file = output / (name + '.log')
    if not file.exists():
        reports[name] = {'status': 'missing', 'log': str(file)}
        print(name, 'MISSING LOG')
        continue
    raw = file.read_bytes()
    text = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
    match = re.search(r'### Result\s*\n(.*?)\r?\n###', text, re.S)
    if not match:
        print(name, 'NO RESULT', text[:250])
        reports[name] = {'status': 'incomplete', 'log': str(file)}
        continue
    data = json.loads(match.group(1))
    reports[name] = data
    (output / (name + '.json')).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    if 'results' in data:
        print(name, 'passed=', data['passed'], 'failed=', data['failed'], 'pageErrors=', len(data['pageErrors']))
        for row in data['results']:
            if row['status'] == 'failed':
                print(' ', row['profile'], row['surface'], row.get('screen', ''), row.get('failures', ''), row.get('smallButtons', ''), row.get('error', '').split('\n')[0])
    else:
        print(name, 'passed=', data['count'], 'pageErrors=', len(data['pageErrors']))
        for reason in data.get('skipped', []):
            print('  SKIPPED:', reason)
(output / 'summary.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
sys.exit(1 if any(report.get('status') in ('missing', 'incomplete') or report.get('failed', 0) or report.get('pageErrors') for report in reports.values()) else 0)
