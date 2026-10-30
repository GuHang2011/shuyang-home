import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

export const homeSlides = [
  { id: 'welcome', label: '一份乡情，一生牵挂', first: '把日子过好，', second: '和老乡一起。', description: '赴一场相聚，分享一份所长。', detail: '把他乡的日常，慢慢过成家的模样。', action: '去看看活动', target: 'events', note: '苏州 · 沭阳，让乡情发生在每一天', theme: 'ink', artFirst: '见字如面', artSecond: '乡音如故' },
  { id: 'gather', label: '走出屏幕，见见老乡', first: '相聚的时光，', second: '一起去创造。', description: '一次相约，一声熟悉的问候。', detail: '从乡情聚会到公益志愿，总有一份温暖等你。', action: '发现乡情活动', target: 'events', note: '乡情聚会 · 公益志愿 · 温暖同行', theme: 'green', artFirst: '赴一场相聚', artSecond: '续一份乡情' },
  { id: 'memories', label: '把美好，留在家里的相册', first: '每一张照片，', second: '都有家的温度。', description: '有乡音，有笑脸，也有难忘的瞬间。', detail: '翻开相聚相册，重温我们一起走过的日子。', action: '翻开相聚相册', target: 'gallery', note: '相聚有时，回忆常在', theme: 'clay', artFirst: '记录相聚', artSecond: '珍藏乡情' }
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
    api('/albums').then(data => { if (!disposed) cover.value = (data.albums || []).find((album: any) => album.status === 'published' && album.cover)?.cover || ''; }).catch(() => { /* Brand artwork remains available when an optional cover cannot load. */ });
  });
  onUnmounted(() => { disposed = true;clearTimeout(timer);if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);motion?.removeEventListener?.('change', preference); });
  return { slides: homeSlides, index, current, paused, hovered, focused, touching, hidden, reducedMotion, playing, cover, select, next, previous };
}
