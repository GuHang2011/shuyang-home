"""Generate a synthetic test tone, not a recording of a person."""
import json, math, struct, wave
from pathlib import Path
root = Path(__file__).resolve().parents[1]
config = json.loads((root / '.cache/membership-preview/runtime.json').read_text(encoding='utf-8-sig'))
assert config['backend'] == 'http://127.0.0.1:19999' and config['database'].startswith('isolated in-memory')
folder = root / 'output/forum-audio'
folder.mkdir(parents=True, exist_ok=True)
with wave.open(str(folder / 'tone.wav'), 'wb') as audio:
    audio.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
    audio.writeframes(b''.join(struct.pack('<h', int(1000 * math.sin(2 * math.pi * 440 * i / 8000))) for i in range(8000 * 6)))
print('Generated 6-second synthetic WAV fixture; no real voice data.')
