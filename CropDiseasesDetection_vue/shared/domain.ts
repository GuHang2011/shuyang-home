export type Row = Record<string, any>;
export const eventCategories = ['乡情聚会', '公益志愿', '交流分享', '家乡文化'];
export const postCategories = ['求职招聘', '资源合作', '生活互助', '家乡分享'];
export const forumCategories = ['乡情闲聊', '苏州生活', '创业交流', '家乡故事'];
export const resourceCategories = ['技能服务', '闲置物品', '场地设备', '信息渠道'];
export const placementNames: Record<string, string> = { home: '首页推荐位', events: '活动页面' };
export const contactStates: Record<string, string> = { pending: '待同意', accepted: '已交换', rejected: '已拒绝', cancelled: '已取消', revoked: '已撤销展示' };
export const pledgeStates: Record<string, string> = { pledged: '已认领', delivered: '已核实交付', cancelled: '已取消' };
export function requestId() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16); }); }
export function adState(ad: Row) { if (ad.status !== 'approved') return statusNames[ad.status] || ad.status; if (new Date(ad.endsAt).getTime() <= Date.now()) return '已到期'; if (new Date(ad.startsAt).getTime() > Date.now()) return '待展示'; return '展示中'; }
export function pollState(poll: Row) { return poll.ended ? '已结束' : new Date(poll.startsAt).getTime() > Date.now() ? '未开始' : '投票中'; }
export function localDateInput(date = new Date()) { return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16); }
export function fromLocalInput(value: string) { const date = new Date(value.replace(' ', 'T') + ':00+08:00'); if (!Number.isFinite(date.getTime())) throw new Error('请填写完整的北京时间'); return date.toISOString(); }
export const exchangeNames: Record<string, string> = { pending: '待回应', accepted: '交换中', rejected: '已拒绝', cancelled: '已取消', completed: '双方已确认完成', unavailable: '资源已有其他交换' };
export const statusNames: Record<string, string> = { deleted: '已删除', hidden: '已隐藏', pending: '待审核', approved: '已通过', rejected: '已退回', published: '已发布', draft: '草稿', cancelled: '已取消', closed: '已关闭', registered: '已报名', checked_in: '已签到', withdrawn: '已撤下' };
export const roleNames: Record<string, string> = { superadmin: '超级管理员', admin: '普通管理员', moderator: '版主', organizer: '志愿组织者', member: '会员' };
export const privacy = '手机号用于账号登录及入会联系，不默认公开。姓名、家乡、现居地区和行业仅在您主动开启名录公开后向已审核会员展示；手机号需另行选择公开。活动组织者可为报名联络查看报名者姓名、手机号。互助联系方式仅向已审核会员展示。论坛主题、审核通过的回帖和资源描述会公开展示，请勿在正文中填写敏感信息。交换申请、交付确认及申请联系方式仅双方与组织者可见。广告内容及主动填写的广告联系方式经审核后公开展示。众筹项目公开，个人认领数量与留言仅本人、项目发起人及组织者可见；资金仅登记意向，不在线收款。联系方式交换仅在双方同意后向双方展示，可撤销后续展示，但无法收回对方已经保存的信息。投票公开汇总结果，不公开个人选项。内部聊天的文字、图片及文件仅当前会话成员可见，私聊经接收人同意后继续，群聊自愿加入且加入后可查看历史；支持屏蔽与两分钟内撤回，撤回无法收回他人已保存的信息。活动相册与商品图片发布后公开展示，请仅上传已获展示授权的内容。下单时填写的姓名、手机号和地址仅买家与管理员用于订单履约；商品在线下单、人工确认、线下结算，本平台不在线扣款。地点签到在你主动授权后核验报名、时间、距离及定位精度，保存签到时间和距离，不保存你的原始坐标或连续轨迹。天气定位仅在主动授权后用于天气查询，坐标降低精度后交由Open-Meteo天气服务处理，不写入会员位置档案；也可手动选城。平台记录必要的审核与操作日志。您可以随时关闭名录公开，或联系平台申请账号注销及个人资料删除（联系电话13862597517）。';
export const agreement = '我自愿加入乡情交流，确认所填信息真实；尊重他人、文明交流，不发布违法、诈骗及虚假信息。入会与活动自愿参与、无强制收费；选购家乡特产时单独确认商品、售后和线下结算说明。';
export function formatTime(value: string) { if (!value) return ''; const d = new Date(value); if (!Number.isFinite(d.getTime())) return ''; return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); }
export function eventState(event: Row) { if (event.status === 'cancelled') return '已取消'; if (event.status === 'draft') return '草稿'; if (new Date(event.endsAt).getTime() < Date.now()) return '已结束'; if (new Date(event.startsAt).getTime() <= Date.now()) return '进行中'; if (event.registered >= event.capacity) return '已满员'; return '报名中'; }
export const newProfile = () => ({ name: '', phone: '', password: '', hometown: '', district: '', industry: '', bio: '', volunteer: false, directoryVisible: false, phoneVisible: false, consent: false });
