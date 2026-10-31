"""Generate original Shuyang Home sticker artwork. Requires Pillow; never used at runtime."""
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
folder = root / 'backend/src/main/resources/stickers'
font_path = os.environ.get('STICKER_FONT', 'C:/Windows/Fonts/msyhbd.ttc')
font = ImageFont.truetype(font_path, 36)
ink, cream, gold = '#294657', '#fff9e9', '#e5b962'
packs = json.loads((folder / 'catalog.json').read_text(encoding='utf-8'))
for index, item in enumerate(sticker for pack in packs for sticker in pack['stickers']):
    image = Image.new('RGBA', (320, 320), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    name = item['id']
    # Original rounded house character: roof, face and two waving arms.
    draw.ellipse((35, 283, 285, 306), fill='#e7e0ce')
    draw.rounded_rectangle((50, 74, 270, 262), radius=52, fill=cream, outline=ink, width=6)
    draw.polygon([(37, 100), (160, 22), (283, 100)], fill=gold)
    draw.line([(37,100),(160,22),(283,100)], fill=ink, width=7, joint='curve')
    draw.rounded_rectangle((224, 31, 245, 72), radius=5, fill='#719285', outline=ink, width=4)
    draw.line((57,175,29,153 if index % 2 else 196), fill=ink, width=8)
    draw.ellipse((15,140 if index % 2 else 185,40,165 if index % 2 else 210), fill=gold, outline=ink, width=3)
    draw.line((264,175,292,136 if index % 2 else 182), fill=ink, width=8)
    draw.ellipse((280,122 if index % 2 else 171,305,149 if index % 2 else 198), fill=gold, outline=ink, width=3)
    if name in ('happy','thanks','great','welcome','hug'):
        draw.arc((100,116,126,146), 190,350, fill=ink, width=5)
        draw.arc((194,116,220,146), 190,350, fill=ink, width=5)
    elif name == 'goodnight':
        draw.arc((98,120,128,140), 5,175, fill=ink, width=5)
        draw.arc((192,120,222,140), 5,175, fill=ink, width=5)
    else:
        draw.ellipse((108,125,119,141), fill=ink)
        draw.ellipse((201,125,212,141), fill=ink)
    draw.ellipse((78,153,112,169), fill='#e9b2a0')
    draw.ellipse((208,153,242,169), fill='#e9b2a0')
    if name == 'happy':
        draw.ellipse((135,148,185,189), fill=ink)
        draw.ellipse((143,174,177,188), fill='#e9b2a0')
    else:
        draw.arc((136,141,184,177), 5,175, fill=ink, width=5)
    if name in ('thanks','hug','care','meet'):
        draw.ellipse((139,183,161,204), fill='#bd685b');draw.ellipse((159,183,181,204), fill='#bd685b')
        draw.polygon([(139,195),(181,195),(160,220)], fill='#bd685b')
    elif name == 'tea':
        draw.rounded_rectangle((128,184,187,216), radius=6, fill='#719285', outline=ink, width=3)
        draw.arc((179,189,201,212),270,90,fill=ink,width=4)
        draw.line((143,178,148,167),fill='#719285',width=3);draw.line((166,178,171,167),fill='#719285',width=3)
    elif name == 'received':
        draw.line([(138,192),(153,208),(184,180)],fill='#719285',width=8)
    elif name == 'goodnight':
        draw.ellipse((259,32,298,71),fill=gold);draw.ellipse((270,25,302,60),fill=(0,0,0,0))
    else:
        draw.polygon([(160,181),(167,194),(182,196),(171,207),(173,222),(160,215),(147,222),(149,207),(138,196),(153,194)],fill=gold,outline=ink)
    draw.rounded_rectangle((42,231,278,288), radius=22, fill=ink)
    draw.text((160,255),item['label'],font=font,fill=cream,anchor='mm',stroke_width=0)
    image.save(folder / (name + '.png'), optimize=True)
print('Generated 12 original PNG stickers in backend resources.')
