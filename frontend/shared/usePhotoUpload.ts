import { computed, onUnmounted, ref, watch } from 'vue';
import type { Row } from './domain';

export type PhotoFile = { name: string; size: number; preview: string; source: any };
export type PhotoItem = PhotoFile & { key: number; status: 'waiting' | 'uploading' | 'done' | 'failed'; progress: number; error: string; media?: Row };

/** Keep failed selections visible and ignore uploads from an earlier account or form. */
export function usePhotoUpload(options: {
  identity: () => unknown;
  max: number;
  upload: (file: PhotoFile, progress: (value: number) => void) => Promise<Row>;
  changed: (photos: Row[]) => void;
  pending: (value: boolean) => void;
  release?: (file: PhotoFile) => void;
}) {
  const items = ref<PhotoItem[]>([]), error = ref(''), running = ref(false);
  let generation = 0, serial = 0;
  const remaining = computed(() => Math.max(0, options.max - items.value.length));
  function sync() {
    options.changed(items.value.filter(p => p.status === 'done').map(p => p.media!));
    options.pending(items.value.some(p => p.status !== 'done'));
  }
  async function run() {
    if (running.value) return;
    const version = generation;
    running.value = true;
    try {
      for (const item of items.value) {
        if (version !== generation) return;
        if (item.status !== 'waiting') continue;
        item.status = 'uploading';item.error = '';item.progress = 0;
        try {
          const media = await options.upload(item, value => { if (version === generation) item.progress = value; });
          if (version !== generation) return;
          item.media = media;item.status = 'done';item.progress = 100;
        } catch (e) {
          if (version !== generation) return;
          item.status = 'failed';item.error = e instanceof Error ? e.message : '上传失败，请重试';
        }
        sync();
      }
    } finally { if (version === generation) running.value = false; }
  }
  function add(files: PhotoFile[]) {
    error.value = '';
    const accepted = files.slice(0, remaining.value);
    if (accepted.length < files.length) error.value = `最多选择 ${options.max} 张照片，多出的照片未添加。`;
    files.slice(accepted.length).forEach(file => options.release?.(file));
    items.value.push(...accepted.map(file => ({ ...file, key: ++serial, status: 'waiting' as const, progress: 0, error: '' })));
    sync();void run();
  }
  function remove(key: number) {
    if (running.value) return;
    const item = items.value.find(p => p.key === key);
    if (item) options.release?.(item);
    items.value = items.value.filter(p => p.key !== key);sync();
  }
  function retry(key: number) {
    if (running.value) return;
    const item = items.value.find(p => p.key === key);
    if (item?.status === 'failed') { item.status = 'waiting';sync();void run(); }
  }
  function reset() {
    ++generation;items.value.forEach(file => options.release?.(file));items.value = [];running.value = false;error.value = '';sync();
  }
  watch(options.identity, reset, { flush: 'sync' });
  onUnmounted(() => { ++generation;items.value.forEach(file => options.release?.(file)); });
  return { items, error, running, remaining, add, remove, retry, reset };
}
