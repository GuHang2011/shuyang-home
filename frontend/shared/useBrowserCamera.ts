import { onUnmounted, ref, watch } from 'vue';
import type { CameraRequest } from './browserCamera';
export function useBrowserCamera(identity: () => unknown) {
  const taking = ref(false), cameraError = ref('');let pending: CameraRequest | null = null;
  function cancel() { if (pending) { pending.cancelled = true;pending.cancel?.();pending = null; }taking.value = false;cameraError.value = ''; }
  async function photograph() {
    if (taking.value) return null;const request: CameraRequest = {};pending = request;taking.value = true;cameraError.value = '';
    try {
      const { captureBrowserPhoto } = await import('./browserCamera');if (request.cancelled) return null;
      const photo = await captureBrowserPhoto(request);
      if (request.cancelled) { if (photo) URL.revokeObjectURL(photo.preview);return null; }
      return photo;
    }
    catch { if (!request.cancelled) cameraError.value = '相机无法打开，请重试或选择照片。';return null; }
    finally { if (pending === request) { pending = null;taking.value = false; } }
  }
  watch(identity, (next, previous) => {
    // A refreshed row may recreate the tuple without changing the camera's owner.
    if (Array.isArray(next) && Array.isArray(previous) && next.length === previous.length && next.every((value, index) => Object.is(value, previous[index]))) return;
    cancel();
  }, { flush: 'sync' });onUnmounted(cancel);
  return { taking, cameraError, photograph, cancel };
}
