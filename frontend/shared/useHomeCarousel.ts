import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

export const homeSlides = [
  { id: 'welcome', label: '沭阳之家', first: '沭阳老乡，', second: '在苏州相聚', description: '看看近期活动，认识身边的老乡。', detail: '也可以到互助广场发布需求。', action: '查看活动', target: 'events', theme: 'ink' },
  { id: 'gather', label: '一起参与', first: '周末有什么', second: '活动？', description: '活动时间、地点和报名情况，一起查看。', detail: '选好活动后，可在线报名和签到。', action: '查看活动', target: 'events', theme: 'green' },
  { id: 'memories', label: '活动记录', first: '翻翻大家的', second: '活动照片', description: '按相册查看照片，或打开往期活动原相册。', detail: '自己的照片也可以发到论坛。', action: '查看相册', target: 'gallery', theme: 'clay' }
] as const;

/** One timer for Web, H5 and mini-program; background views never advance. */
export function useHomeCarousel(api: (path: string) => Promise<any>, enabled: () => boolean = () => true) {
  const index = ref(0), paused = ref(false), hovered = ref(false), focused = ref(false), touching = ref(false), hidden = ref(false), reducedMotion = ref(false), cover = ref('');
  const current = computed(() => homeSlides[index.value]);
  const playing = computed(() => enabled() && !paused.value && !hovered.value && !focused.value && !touching.value && !hidden.value && !reducedMotion.value);
  let timer: ReturnType<typeof setTimeout> | undefined, disposed = false;
  let motion: MediaQueryList | undefined;
  function select(value: number) { index.value = ((value % homeSlides.length) + homeSlides.length) % homeSlides.length; }
  function next() { select(index.value + 1); }
  function previous() { select(index.value - 1); }
  function schedule() { clearTimeout(timer);if (!disposed && playing.value) timer = setTimeout(next, 6000); }
  function visibility() { hidden.value = document.hidden; }
  function preference() { reducedMotion.value = !!motion?.matches; }
  watch([playing, index], schedule);
  onMounted(() => {
    if (typeof document !== 'undefined') { visibility();document.addEventListener('visibilitychange', visibility); }
    if (typeof window !== 'undefined' && window.matchMedia) { motion = window.matchMedia('(prefers-reduced-motion: reduce)');preference();motion.addEventListener?.('change', preference); }
    schedule();
    api('/albums').then(data => { if (!disposed) cover.value = (data.albums || []).find((album: any) => album.status === 'published' && album.cover)?.cover || ''; }).catch(() => { /* The credited city photograph remains available. */ });
  });
  onUnmounted(() => { disposed = true;clearTimeout(timer);if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);motion?.removeEventListener?.('change', preference); });
  return { slides: homeSlides, index, current, paused, hovered, focused, touching, hidden, reducedMotion, playing, cover, select, next, previous };
}
