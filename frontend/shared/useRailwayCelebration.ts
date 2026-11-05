import { ref } from 'vue';

const key = 'shuyang-railway-15th-dismissed-until';
export function useRailwayCelebration(storage: { get: (key: string) => unknown; set: (key: string, value: string) => void }) {
  const visible = ref(true);
  try { visible.value = Number(storage.get(key) || 0) <= Date.now(); } catch { /* Storage may be disabled. */ }
  function dismiss() {
    visible.value = false;
    try { storage.set(key, String(Date.now() + 24 * 60 * 60 * 1000)); } catch { /* Still closed for this visit. */ }
  }
  return { visible, dismiss };
}
