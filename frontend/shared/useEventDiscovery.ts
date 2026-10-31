import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { Row } from './domain';

export const eventViews = [
  { id: 'all', label: '全部活动' }, { id: 'available', label: '可报名' },
  { id: 'mine', label: '我已报名' }, { id: 'ended', label: '已结束' }
];
export function discoverEvents(rows: Row[], view: string, category: string, query: string, now: number) {
  const keywords = query.trim().toLocaleLowerCase();
  return rows.filter(row => {
    if (category !== '全部' && row.category !== category) return false;
    if (![row.title, row.location, row.description].join(' ').toLocaleLowerCase().includes(keywords)) return false;
    if (view === 'available') return row.status === 'published' && new Date(row.startsAt).getTime() > now && new Date(row.endsAt).getTime() > now && Number(row.registered) < Number(row.capacity) && !row.mySignup;
    if (view === 'mine') return !!row.mySignup;
    if (view === 'ended') return row.status === 'published' && new Date(row.endsAt).getTime() <= now;
    return true;
  });
}
export function upcomingEvents(rows: Row[], now: number) {
  return rows.filter(row => row.status === 'published' && new Date(row.endsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}
export function useEventDiscovery(rows: () => Row[], category: () => string, query: () => string) {
  const eventView = ref('all'), now = ref(Date.now());let timer: ReturnType<typeof setInterval>;
  const filteredEvents = computed(() => discoverEvents(rows(), eventView.value, category(), query(), now.value));
  const upcoming = computed(() => upcomingEvents(rows(), now.value));
  onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 30000); });
  onUnmounted(() => clearInterval(timer));
  return { eventView, filteredEvents, upcoming, eventViews };
}
