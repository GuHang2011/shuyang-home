import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { type Row, eventState as describeEvent, canCancelSignup as allowCancellation, signupLabel as describeSignup } from './domain';

export const eventViews = [
  { id: 'all', label: '全部活动' }, { id: 'available', label: '可报名' },
  { id: 'mine', label: '我已报名' }, { id: 'ended', label: '已结束' }
];
function availableEvent(row: Row, now: number) {
  return row.status === 'published' && new Date(row.startsAt).getTime() > now && new Date(row.endsAt).getTime() > now && Number(row.registered) < Number(row.capacity) && !row.mySignup;
}
export function discoverEvents(rows: Row[], view: string, category: string, query: string, now: number) {
  const keywords = query.trim().toLocaleLowerCase();
  return rows.filter(row => {
    if (category !== '全部' && row.category !== category) return false;
    if (![row.title, row.location, row.description].join(' ').toLocaleLowerCase().includes(keywords)) return false;
    if (view === 'available') return availableEvent(row, now);
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
  const eventView = ref('all'), now = ref(Date.now());let timer: ReturnType<typeof setTimeout> | undefined, mounted = false;
  const filteredEvents = computed(() => discoverEvents(rows(), eventView.value, category(), query(), now.value));
  const upcoming = computed(() => upcomingEvents(rows(), now.value));
  function refreshClock() {
    clearTimeout(timer);now.value = Date.now();
    if (!mounted) return;
    // Wake at the next activity boundary, keeping the existing 30-second fallback.
    let next = now.value + 30000;
    for (const row of rows()) for (const value of [row.startsAt, row.endsAt]) {
      const time = new Date(value).getTime();if (time > now.value) next = Math.min(next, time);
    }
    timer = setTimeout(refreshClock, Math.max(1, next - now.value));
  }
  const eventState = (row: Row) => describeEvent(row, now.value);
  const canCancelSignup = (row: Row) => allowCancellation(row, now.value);
  const signupLabel = (row: Row) => describeSignup(row, now.value);
  const canSignup = (row: Row) => availableEvent(row, now.value);
  watch(rows, refreshClock, { flush: 'sync' });
  onMounted(() => { mounted = true;refreshClock(); });
  onUnmounted(() => { mounted = false;clearTimeout(timer); });
  return { eventView, filteredEvents, upcoming, eventViews, eventState, canCancelSignup, signupLabel, canSignup, refreshClock };
}
