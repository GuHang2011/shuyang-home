import { computed, ref } from 'vue';
import type { Row } from './domain';

export const railwayCategories = ['淮新高铁', '一凡说高铁'] as const;
export const railwayPlaces = [
  { name: '新沂', label: '北向关注', text: '关注新沂方向的铁路衔接、规划公示与官方答复。' },
  { name: '沭阳', label: '家乡关注', text: '把沭阳相关的规划、站点信息与出行变化集中整理，让在外的老乡更方便了解家乡。' },
  { name: '淮安', label: '南向关注', text: '关注淮安方向的铁路衔接与区域出行信息。具体停靠站和车次以正式公告为准。' }
];
export const railwayQuestions = [
  { question: '什么时候可以乘坐淮新高铁？', answer: '本专题暂未收录已核实的开通公告。规划、批复、开工与通车是不同阶段；出行前请以铁路运营公告和 12306 实际可售车次为准。' },
  { question: '这里展示的是正式站点和线路图吗？', answer: '页面展示新沂、沭阳、淮安三个关注区域，帮助阅读相关资讯，不代表正式站点或施工线路。站名、选址、里程及设计标准以正式批复和公示为准。' },
  { question: '“一凡解读”和专题资讯有什么区别？', answer: '专题资讯用于整理公开信息与来源；“一凡解读”是个人观察和解读栏目。观点会单独标注，方便你结合原文作出判断。' },
  { question: '去哪里查现在能坐的车？', answer: '在铁路 12306 查询实际出发地、目的地和日期。涉及换乘时，请留足接驳和进站时间，核对车票上的车站全名。' }
];
export const railwaySources = [
  { title: '江苏省交通运输厅', description: '交通规划、公示与政务信息', url: 'https://jtyst.jiangsu.gov.cn/' },
  { title: '国家发展改革委', description: '规划与项目批复信息', url: 'https://www.ndrc.gov.cn/' },
  { title: '铁路 12306', description: '查询已开行车次与出行服务', url: 'https://www.12306.cn/' }
];
export function safeRailwayUrl(value: unknown) {
  const url = String(value || '').trim();
  // Also works in mini-program runtimes without the browser URL constructor.
  return /^https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#][^\s<>]*)?$/i.test(url) ? url : '';
}
export function railwayDate(value: unknown) {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replace(/-/g, '.') : '';
}
export function useRailway(notices: () => Row[]) {
  const section = ref('全部'), place = ref(1), expanded = ref(''), question = ref(-1);
  const articles = computed(() => notices().filter(row => railwayCategories.includes(row.category) && row.status === 'published')
    .sort((a, b) => String(b.sourceDate || b.createdAt || '').localeCompare(String(a.sourceDate || a.createdAt || ''))));
  const filtered = computed(() => articles.value.filter(row => section.value === '全部' || row.category === section.value));
  function chooseSection(value: string) { section.value = value; expanded.value = ''; }
  return { section, place, expanded, question, articles, filtered, chooseSection };
}
