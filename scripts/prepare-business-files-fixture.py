"""Synthetic XLSX fixtures and orders for the isolated in-memory preview only."""
import base64, io, json, uuid, zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

root=Path(__file__).resolve().parents[1]
config=json.loads((root/'.cache/membership-preview/runtime.json').read_text(encoding='utf-8-sig'))
assert config['backend']=='http://127.0.0.1:19999' and config['database'].startswith('isolated in-memory')
out=root/'output/business-files';out.mkdir(parents=True,exist_ok=True)
def api(path,data=None,token=None,method=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    with urlopen(Request(config['backend']+path,None if data is None else json.dumps(data).encode(),headers,method=method or ('GET' if data is None else 'POST'))) as response:return json.load(response)['data']
def login(name,password):return api('/auth/login',{'username':name,'password':password})
admin=login('admin','CommunityAdmin2026')['token'];a=login('13800008881','CommunityMember2026');b=login('13800008882','CommunityMember2026')
stamp=lambda date:date.isoformat().replace('+00:00','Z')
now=datetime.now(timezone.utc)
event=api('/events',{'title':'文件验收活动 · 非真实报名','category':'乡情聚会','description':'仅用于验证名单文件的预览、导入与打印，不涉及实际线下活动。','location':'本机隔离预览','capacity':5,'startsAt':stamp(now+timedelta(hours=2)),'endsAt':stamp(now+timedelta(hours=4)),'status':'published'},admin)
api('/events/'+event['id']+'/signup',{},a['token'])
product=api('/products?manage=true',token=admin)[0];product['stock']=80;product['price']='12.50';product['shippingFee']='5.00';api('/products',product,admin)
orders=[]
for index in range(25):
    person=a if index%2 else b
    body={'productId':product['id'],'requestId':str(uuid.uuid4()),'quantity':1,'delivery':'pickup' if index==1 else 'shipping','name':person['user']['name'],'phone':person['user']['phone'],'address':'仅供文件打印验收的合成地址，禁止发货 '+str(index+1),'consent':True}
    order=api('/orders',body,person['token']);orders.append(order)
    if index<2:api('/orders/'+order['id']+'/action',{'action':'confirm'},admin)

ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
def workbook(kind,name,rows):
    template=api('/data-files/template?kind='+kind,token=admin)
    source=io.BytesIO(base64.b64decode(template['base64']));destination=io.BytesIO()
    with zipfile.ZipFile(source) as src,zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            content=src.read(item.filename)
            if item.filename=='xl/worksheets/sheet1.xml':
                doc=ET.fromstring(content);data=doc.find('{'+ns+'}sheetData')
                for n,values in enumerate(rows,2):
                    row=ET.SubElement(data,'{'+ns+'}row',{'r':str(n)})
                    for c,value in enumerate(values):
                        cell=ET.SubElement(row,'{'+ns+'}c',{'r':chr(65+c)+str(n),'t':'inlineStr','s':'1'})
                        ET.SubElement(ET.SubElement(cell,'{'+ns+'}is'),'{'+ns+'}t').text=value
                content=ET.tostring(doc,encoding='utf-8',xml_declaration=True)
            dst.writestr(item.filename,content)
    (out/name).write_bytes(destination.getvalue())
user=a['user']
for suffix,industry in [('web','文件导入验收-Web'),('h5','文件导入验收-H5')]:
    workbook('members','members-'+suffix+'.xlsx',[[user['memberNo'],user['name'],user['hometown'],user['district'],industry,'由隔离 Excel 文件导入的测试简介']])
workbook('members','members-invalid.xlsx',[[user['memberNo'],user['name'],user['hometown'],user['district'],'不得部分写入',''],['SY-NOT-FOUND','不存在会员','沭阳城区','苏州新区','','']])
workbook('signups','signups.xlsx',[[b['user']['memberNo'],'报名']])
workbook('orders','orders.xlsx',[[orders[0]['orderNo'],'发货','测试物流单号，仅供验收12345'],[orders[1]['orderNo'],'备妥自提','测试服务点自提，仅供验收']])
(out/'fixture.json').write_text(json.dumps({'eventId':event['id'],'eventTitle':event['title'],'orders':[row['orderNo'] for row in orders]},ensure_ascii=False,indent=2),encoding='utf-8')
print('Created synthetic XLSX fixtures, one event and 25 non-payment orders in the isolated preview.')
