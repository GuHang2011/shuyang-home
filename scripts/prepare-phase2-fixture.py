"""Create clearly labelled acceptance data in the isolated in-memory preview only."""
import json, struct, zlib, uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
root = Path(__file__).resolve().parents[1]
config = json.loads((root/'.cache/membership-preview/runtime.json').read_text(encoding='utf-8-sig'))
assert config['backend']=='http://127.0.0.1:19999' and config['database'].startswith('isolated in-memory')
out=root/'output/phase2';out.mkdir(exist_ok=True,parents=True)
def call(path, data=None, token=None, method=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    try:
        with urlopen(Request(config['backend']+path,None if data is None else json.dumps(data).encode(),headers,method=method or ('GET' if data is None else 'POST'))) as response:return json.load(response)['data']
    except Exception as e:
        if hasattr(e,'read'): print(e.read().decode())
        raise
def login(username,password):return call('/auth/login',{'username':username,'password':password})
admin=login('admin','CommunityAdmin2026')['token']
a=login('13800008881','CommunityMember2026');b=login('13800008882','CommunityMember2026')
def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
pixels=b''.join(b'\x00'+bytes([36,63,84,230,207,155])*160 for _ in range(200))
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',320,200,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b'')
(out/'fixture.png').write_bytes(png);(out/'fixture.txt').write_text('QA attachment: isolated acceptance only.',encoding='utf-8')
def upload(scope):
    boundary='qa'+uuid.uuid4().hex
    data=('--'+boundary+'\r\nContent-Disposition: form-data; name="scope"\r\n\r\n'+scope+'\r\n--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n').encode()+png+('\r\n--'+boundary+'--\r\n').encode()
    with urlopen(Request(config['backend']+'/media/upload',data,{'Authorization':'Bearer '+admin,'Content-Type':'multipart/form-data; boundary='+boundary})) as response:return json.load(response)['data']['id']
album=call('/albums',{'title':'验收相册 · 非真实活动','description':'本相册仅用于验证上传和展示。条纹图为测试素材，不是活动照片。','location':'隔离测试环境','date':datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d'),'status':'published'},admin)
photo=call('/albums/'+album['id']+'/photos',{'mediaId':upload('album'),'caption':'验收条纹图 · 非活动照片','status':'published'},admin)
product=call('/products',{'title':'验收特产 · 不销售','category':'家乡美食','description':'隔离验收中的测试商品，不是真实商品，不接受结算。','specification':'测试一份','origin':'江苏沭阳','seller':'测试供货商','sellerContact':'13800008881','afterSales':'仅用于测试订单流程，不发生真实交易。','price':'12.50','shippingFee':'5.00','stock':10,'images':[upload('product')],'status':'published'},admin)
now=datetime.now(timezone.utc)
stamp=lambda d:d.isoformat().replace('+00:00','Z')
event=call('/events',{'title':'验收活动 · 定位签到','category':'公益志愿','description':'只用于验证定位签到和时间范围，没有真实线下活动。','location':'模拟苏州签到点','capacity':10,'status':'published','startsAt':stamp(now+timedelta(minutes=30)),'endsAt':stamp(now+timedelta(hours=2))},admin)
for member in [a,b]:call('/events/'+event['id']+'/signup',{},member['token'])
call('/events/'+event['id']+'/checkin-config',{'enabled':True,'latitude':31.3,'longitude':120.6,'radius':200,'opensAt':stamp(now-timedelta(seconds=30)),'closesAt':stamp(now+timedelta(hours=2))},admin,'PUT')
topic=call('/forum/topics',{'title':'验收话题 · 家乡记忆','category':'乡情闲聊','content':'这条话题仅用于浏览器验收，欢迎用测试回复验证引用与楼层。'},a['token'])
call('/forum/topics/'+topic['id']+'/review',{'status':'approved','note':''},admin)
reply=call('/forum/topics/'+topic['id']+'/replies',{'content':'验收第一层，等待后续引用。'},b['token'])
call('/forum/replies/'+reply['id']+'/review',{'status':'approved','note':''},admin)
room=call('/chat/direct',{'recipientId':b['user']['id'],'content':'验收聊天申请，用于图片和文件跨端验证。'},a['token'])
call('/chat/conversations/'+room['id']+'/action',{'action':'accept'},b['token'])
(out/'fixture.json').write_text(json.dumps({'album':album['id'],'photo':photo['id'],'product':product['id'],'event':event['id'],'topic':topic['id'],'reply':reply['id'],'room':room['id']},ensure_ascii=False,indent=2),encoding='utf-8')
print('Prepared isolated gallery, product, event, forum, chat fixtures; no production records changed.')
