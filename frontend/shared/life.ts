import type { Row } from './domain';

export const lifeTypes = [
  { id: 'guide', name: '办事指南', mark: '办', intro: '把要准备的事，一件件办妥。', access: 'staff' },
  { id: 'help', name: '老乡帮办', mark: '帮', intro: '你有难处，我来搭把手。', access: 'member' },
  { id: 'job', name: '求职招聘', mark: '职', intro: '先看清工作条件，再开始沟通。', access: 'member' },
  { id: 'service', name: '便民服务', mark: '邻', intro: '找到身边愿意提供服务的老乡。', access: 'member' },
  { id: 'trip', name: '活动出行', mark: '行', intro: '集合与交通，出发前一页看清。', access: 'staff' },
  { id: 'arrival', name: '特产到货', mark: '乡', intro: '惦记的家乡味，有消息告诉你。', access: 'admin' },
  { id: 'progress', name: '共建公示', mark: '暖', intro: '每一份心意，都有后续。', access: 'member' },
  { id: 'lost', name: '失物招领', mark: '寻', intro: '帮遗失的物品，找到回家的路。', access: 'member' },
  { id: 'slot', name: '预约自提', mark: '取', intro: '选个方便的时间，把家乡味带回家。', access: 'admin' }
];
export const lifeStates: Record<string,string> = { pending:'待审核', open:'进行中', working:'处理中', confirming:'待本人确认', resolved:'已解决', paused:'已暂停', closed:'已关闭', rejected:'已退回', unavailable:'暂不可用', submitted:'待处理', accepted:'已接受', withdrawn:'已撤回', released:'已退出', reserved:'已预约', collected:'已交付' };
export type LifeField = { key: string; label: string; hint?: string; options?: string[]; source?: string; kind?: string; optional?: boolean; max?: number };
const common: LifeField[] = [
  { key:'title',label:'标题',hint:'用一句话说清楚这件事',max:80 },
  { key:'region',label:'城市／区县或地点',hint:'例如：苏州 · 吴中区',max:80 },
  { key:'category',label:'分类',hint:'例如：社保、简历修改、餐饮服务',max:40 },
  { key:'content',label:'详细说明',kind:'textarea',hint:'说明条件与安排，至少5字；请勿填写证件号码等私人信息',max:4000 },
  { key:'deadline',label:'信息有效期',kind:'date',optional:true }
];
const specific: Record<string,LifeField[]> = {
  guide:[{key:'sourceName',label:'来源机构',max:80},{key:'sourceUrl',label:'官方来源网址',hint:'https://…',max:500},{key:'verifiedOn',label:'实际核验日期',kind:'date'},{key:'checklistText',label:'材料清单',kind:'textarea',hint:'每行一项，最多30项',max:3000}],
  help:[{key:'method',label:'帮助方式',options:['线上','线下','均可']}],
  job:[{key:'employer',label:'实际用工单位',max:100},{key:'salary',label:'薪资与计薪方式',hint:'例如：月薪5000–6000元，或面议',max:100},{key:'schedule',label:'工作时间',max:150},{key:'employment',label:'用工类型',options:['全职','兼职','临时','实习']},{key:'publisher',label:'发布者身份',options:['企业直招','受委托发布','信息转发']},{key:'benefits',label:'食宿、社保等说明',optional:true,kind:'textarea',max:300}],
  service:[{key:'availability',label:'可联系时段',max:150},{key:'pricing',label:'公益／收费说明',hint:'写明服务范围和费用约定',max:300}],
  lost:[{key:'lostType',label:'信息类型',options:['寻物','招领']},{key:'occurredOn',label:'遗失／拾获日期',kind:'date'}],
  trip:[{key:'referenceId',label:'关联活动',source:'events'},{key:'meeting',label:'集合时间和入口说明',max:500},{key:'transport',label:'公交／停车说明',kind:'textarea',max:800},{key:'contact',label:'组织者公开联系渠道',hint:'仅填写对方同意公开的联系方式',max:150},{key:'meetingPointsText',label:'可选集合点',kind:'textarea',hint:'每行一个，例如地铁站出口',max:3000}],
  arrival:[{key:'referenceId',label:'关联特产',source:'products'},{key:'expectedOn',label:'预计到货日期',kind:'date'}],
  progress:[{key:'referenceId',label:'关联共建项目',source:'projects'},{key:'milestone',label:'进展类型',options:['计划安排','执行进展','延期说明','结项说明']},{key:'plannedOn',label:'计划日期',kind:'date'}],
  slot:[{key:'startsAt',label:'自提开始时间（北京时间）',kind:'datetime'},{key:'endsAt',label:'自提结束时间（北京时间）',kind:'datetime'},{key:'capacity',label:'可预约订单数',kind:'number'}]
};
export const lifeFields = (type: string) => [...common.map(f => ({ ...f, optional:f.key==='deadline' ? !['help','job','lost'].includes(type) : f.optional })), ...(specific[type] || [])];
export function freshLife(type:string): Row {
  const row:Row={type, title:'',region:'',category:'',content:'',deadline:'',photos:[]};
  lifeFields(type).forEach(f => { if(f.options)row[f.key]=f.options[0];else if(f.kind==='number')row[f.key]=10;else if(!(f.key in row))row[f.key]=''; });return row;
}
export function entryActions(row:Row,user:Row|null): { id:string;label:string }[] {
  if(!user)return [];const owner=row.ownerId===user.id,admin=['superadmin','admin'].includes(user.role),staff=admin||user.role==='organizer';
  if(row.status==='pending'&&staff)return [{id:'approve',label:'审核通过'},{id:'reject',label:'退回修改'}];
  if(!owner&&!admin)return [];const out:{id:string;label:string}[]=[];
  if(row.status==='open')out.push({id:'pause',label:'暂停受理'});
  if(row.status==='paused'&&!row.expired)out.push({id:'resume',label:'恢复受理'});
  if(['open','paused','pending','rejected'].includes(row.status)||(row.type==='lost'&&row.status==='working'))out.push({id:'close',label:row.type==='job'?'结束招聘':row.type==='lost'?'登记交接／关闭':'关闭事项'});
  if(row.type==='help'&&row.status==='confirming'&&owner)out.push({id:'resolve',label:'确认已解决'},{id:'reopen',label:'还需继续处理'});
  if(row.type==='help'&&['working','confirming'].includes(row.status)){if(owner)out.push({id:'release',label:'同意负责人退出'});if(admin)out.push({id:'coordinate',label:'协调释放负责人'});}
  return out;
}
export function calendarFile(event:Row): string {
  const esc=(value:unknown)=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const stamp=(value:string)=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Shuyang Home//Activities//ZH','BEGIN:VEVENT','UID:'+esc(event.id)+'@shuyang-home','DTSTAMP:'+stamp(new Date().toISOString()),'DTSTART:'+stamp(event.startsAt),'DTEND:'+stamp(event.endsAt),'SUMMARY:'+esc(event.title),'LOCATION:'+esc(event.location),'DESCRIPTION:以沭阳之家活动页面最新安排为准。','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
