import { onUnmounted } from 'vue';

/** Ignore responses belonging to a previous identity or a disposed page. */
export function useRequestScope() {
  let version = 0;
  function invalidate() { version++; }
  function capture() { const current = version; return () => current === version; }
  onUnmounted(invalidate);
  return { capture, invalidate };
}
