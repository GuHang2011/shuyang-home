"""Validate completed browser results, downloaded workbooks and the printed PDF."""
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

root = Path(__file__).resolve().parents[1]
checks = [
    ('files-browser-chromium.log', 'chromium', 48),
    ('files-browser-webkit.log', 'webkit', 48),
    ('element-browser-chromium.log', 'chromium', 58),
    ('element-browser-webkit.log', 'webkit', 58),
]
total = 0
for filename, engine, minimum in checks:
    raw = (root / 'output' / filename).read_bytes()
    content = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
    if '### Error' in content or '### Result' not in content:
        raise SystemExit(f'FAIL: {filename}: no completed result')
    result, _ = json.JSONDecoder().raw_decode(content.split('### Result', 1)[1].lstrip())
    rows = result.get('results', [])
    count = result.get('passed', 0)
    if (result.get('engine') != engine or count < minimum or result.get('failed') != 0
            or len(rows) != count or result.get('errors') or not all(row.get('passed') is True for row in rows)):
        raise SystemExit(f'FAIL: {filename}: incomplete or failing checks')
    total += count
    print(f'PASS: {engine} {filename}: {count} checks')

ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for engine in ['chromium', 'webkit']:
    for name, expected in [('members-export', 2), ('members-template', 0), ('orders-export', 25), ('signups-export', 2), ('h5-export', 2)]:
        path = root / 'output/business-files' / f'{engine}-{name}.xlsx'
        with zipfile.ZipFile(path) as workbook:
            sheet = ET.fromstring(workbook.read('xl/worksheets/sheet1.xml'))
            rows = sheet.findall('s:sheetData/s:row', ns)
            assert len(rows) == expected + 1, f'{path.name}: row count mismatch'
            assert not sheet.findall('.//s:f', ns), f'{path.name}: unexpected formula'
            assert all(c.attrib.get('t') in {'s', 'inlineStr'} for c in sheet.findall('.//s:c', ns)), f'{path.name}: non-text cell'
        print(f'PASS: {path.name}: {expected} data rows, text cells only')

# Keep PDF inspection optional for environments without pypdf; never report it as verified there.
try:
    from pypdf import PdfReader
except ImportError:
    print('NOT RUN: install pypdf to inspect the generated PDF content')
else:
    pdf = PdfReader(root / 'output/business-files/orders-print.pdf')
    text = ''.join(''.join(page.extract_text().split()) for page in pdf.pages)
    fixture = json.loads((root / 'output/business-files/fixture.json').read_text(encoding='utf-8'))
    order_numbers = fixture['orders']
    assert len(order_numbers) == 25
    assert all(number in text for number in order_numbers), 'PDF omits at least one order'
    print(f'PASS: PDF: {len(pdf.pages)} pages; all 25 order numbers present')
print(f'PASS: {total} browser checks; all downloaded workbooks verified')
