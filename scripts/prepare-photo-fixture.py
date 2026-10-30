"""Synthetic photos and accounts for the isolated local preview only."""
import json, struct, zlib
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
root=Path(__file__).resolve().parents[1]
config=json.loads((root/'.cache/membership-preview/runtime.json').read_text(encoding='utf-8-sig'))
assert config['backend']=='http://127.0.0.1:19999' and config['database'].startswith('isolated in-memory')
def call(path,body=None,token=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    with urlopen(Request(config['backend']+path,None if body is None else json.dumps(body).encode(),headers),timeout=30) as response: return json.load(response)['data']
try:
    auth=call('/auth/login',{'username':'admin','password':config['password']})
    auth=call('/auth/password',{'oldPassword':config['password'],'newPassword':'PhotoPreviewAdmin2026'},auth['token'])
except HTTPError:
    auth=call('/auth/login',{'username':'admin','password':'PhotoPreviewAdmin2026'})
admin=auth['token']
body={'phone':'13800008885','password':'PhotoPreviewMember2026','name':'照片体验会员','hometown':'沭阳沭城','district':'苏州吴中','consent':True,'volunteer':True,'directoryVisible':False,'phoneVisible':False}
try:
    member=call('/auth/register',body)
    call('/admin/members/'+member['user']['id']+'/review',{'status':'approved','note':''},admin)
except HTTPError as error:
    if error.code!=409: raise
folder=root/'output/photo-fixtures';folder.mkdir(parents=True,exist_ok=True)
def png(path,alternate=False):
    width,height=800,520
    data=bytearray()
    for y in range(height):
        data.append(0)
        for x in range(width):
            if (x-630)**2+(y-110)**2<45**2: color=(224,194,121)
            elif y>340+int(25*__import__('math').sin(x/100)): color=(52,91,106) if not alternate else (98,120,92)
            elif y>220+int(65*__import__('math').sin(x/160)): color=(123,151,147)
            else: color=(222-int(y/30),232-int(y/30),225-int(y/40))
            data.extend(color)
    def chunk(kind,payload): return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(data))+chunk(b'IEND',b''))
png(folder/'moment-a.png');png(folder/'moment-b.png',True)
(folder/'invalid.png').write_text('This is not an image.',encoding='utf-8')
(folder/'oversize.jpg').write_bytes(b'x'*(8*1024*1024+1))
print('Isolated photo acceptance fixture prepared; generated landscapes are synthetic.')
