import { computed, onMounted, ref } from 'vue';
import { type Row } from './domain';
import { useRequestScope } from './useRequestScope';

export type Sticker = { id: string; label: string; packId?: string };
type StickerPack = { id: string; name: string; stickers: Sticker[] };

export function stickerUrl(id: string, base = '/api') {
  return /^[a-z0-9-]{1,40}$/.test(id) ? base + '/chat/stickers/' + id + '.png' : '';
}
export function useStickers(api: (path: string) => Promise<any>) {
  const packs = ref<StickerPack[]>([]), selected = ref(''), loading = ref(false), error = ref('');
  const scope = useRequestScope();
  const items = computed<Sticker[]>(() => packs.value.find(pack => pack.id === selected.value)?.stickers || []);
  async function load() {
    if (loading.value) return;const current = scope.capture();loading.value = true;error.value = '';
    try {
      const data = await api('/chat/sticker-packs');if (!current()) return;
      if (!Array.isArray(data) || !data.length || data.some(pack => !pack.id || !pack.name || !Array.isArray(pack.stickers) || !pack.stickers.length || pack.stickers.some((item: Row) => !item.label || !stickerUrl(item.id)))) throw new Error('表情暂时无法加载，请重试');
      packs.value = data;if (!data.some(pack => pack.id === selected.value)) selected.value = data[0].id;
    } catch(e) { if (current()) error.value = (e as Error).message; }
    finally { if (current()) loading.value = false; }
  }
  onMounted(load);
  return { packs, selected, items, loading, error, load };
}
