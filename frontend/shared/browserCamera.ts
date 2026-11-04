import type { PhotoFile } from './usePhotoUpload';
import './camera.css';

export type CameraRequest = { cancelled?: boolean; cancel?: () => void };
export function cameraError(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return '未获摄像头授权。请在浏览器或系统设置中允许相机后重试，也可以关闭后选择照片。';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return '没有找到可用摄像头，请连接设备，或关闭后选择照片。';
  if (name === 'NotReadableError' || name === 'TrackStartError') return '摄像头可能被其他应用占用，请关闭其他相机应用后重试。';
  return '相机暂时无法使用，请重试，或关闭后选择照片。';
}

/** User-triggered camera only. The caller owns the returned preview URL. */
export function captureBrowserPhoto(request: CameraRequest = {}): Promise<PhotoFile | null> {
  if (request.cancelled) return Promise.resolve(null);
  return new Promise(resolve => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = document.createElement('dialog');dialog.className = 'camera-dialog';dialog.setAttribute('aria-label', '摄像头拍照');
    // All markup is constant; user/device data is assigned through textContent.
    dialog.innerHTML = `<header><div><h2>拍一张照片</h2><p>确认照片后才会上传，发布或发送仍需单独确认。</p></div><button type="button" class="outline" data-action="close">关闭相机</button></header><div class="camera-frame"><video autoplay muted playsinline aria-label="相机实时取景"></video><img hidden alt="拍摄照片预览"></div><p class="camera-status" role="status"></p><p class="camera-error" role="alert" hidden></p><div class="camera-actions"><button type="button" class="primary" data-action="take">拍照</button><button type="button" class="outline" data-action="switch">切换前后摄像头</button><button type="button" class="outline" data-action="retry" hidden>重试相机</button><button type="button" class="outline" data-action="retake" hidden>重新拍摄</button><button type="button" class="primary" data-action="use" hidden>使用这张照片</button></div>`;
    const video = dialog.querySelector('video')!, preview = dialog.querySelector('img')!;
    const status = dialog.querySelector('.camera-status')!, error = dialog.querySelector<HTMLElement>('.camera-error')!;
    const button = (action: string) => dialog.querySelector<HTMLButtonElement>('[data-action="' + action + '"]')!;
    let stream: MediaStream | null = null, photo: PhotoFile | null = null, generation = 0, finished = false, busy = false, facing = 'environment';
    video.muted = true;
    function stop() { const current = stream;stream = null;current?.getTracks().forEach(track => track.stop());video.srcObject = null; }
    function render() {
      video.hidden = !!photo;preview.hidden = !photo;
      button('take').hidden = !!photo;button('take').disabled = busy || !stream || video.readyState < 2;
      button('switch').hidden = !!photo || !stream;button('switch').disabled = busy;
      button('retry').hidden = !!photo || !!stream || busy;
      button('retake').hidden = !photo;button('use').hidden = !photo;
      button('retake').disabled = busy;button('use').disabled = busy;
    }
    function showError(message: string) { error.textContent = message;error.hidden = false; }
    function finish(result: PhotoFile | null = null) {
      if (finished) return;finished = true;++generation;stop();
      if (photo && photo !== result) URL.revokeObjectURL(photo.preview);
      photo = null;request.cancel = undefined;
      document.removeEventListener('visibilitychange', hidden);window.removeEventListener('pagehide', close);
      dialog.close?.();dialog.remove();if (previousFocus?.isConnected) previousFocus.focus();resolve(result);
    }
    const close = () => finish();
    const hidden = () => { if (document.hidden) finish(); };
    request.cancel = close;
    async function start() {
      const version = ++generation;stop();if (photo) URL.revokeObjectURL(photo.preview);photo = null;preview.removeAttribute('src');
      error.hidden = true;busy = true;status.textContent = '正在请求摄像头，请允许相机权限…';render();
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        busy = false;status.textContent = '';showError('此环境无法直接打开摄像头。请使用 HTTPS 或本机 localhost，也可以关闭后选择照片。');render();return;
      }
      try {
        const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1600 }, height: { ideal: 1200 } } });
        if (finished || version !== generation) { acquired.getTracks().forEach(track => track.stop());return; }
        stream = acquired;video.srcObject = acquired;
        acquired.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (stream === acquired && !finished) { stop();showError('摄像头已断开，请重新连接后重试。');render(); } }));
        await video.play();if (finished || version !== generation) return;
        status.textContent = '对准画面后点击拍照。设备可能只有一个摄像头。';
      } catch (e) { if (!finished && version === generation) { stop();status.textContent = '';showError(cameraError(e)); } }
      finally { if (!finished && version === generation) { busy = false;render(); } }
    }
    async function take() {
      if (busy || !stream || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      const version = generation;busy = true;error.hidden = true;render();
      try {
        const canvas = document.createElement('canvas'), scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext('2d');if (!context) throw Error('无法生成照片');context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolveBlob, reject) => canvas.toBlob(value => value ? resolveBlob(value) : reject(Error('无法生成照片')), 'image/jpeg', .88));
        if (finished || version !== generation) return;
        if (!blob.size || blob.size > 8 * 1024 * 1024) throw Error('照片过大，请重新拍摄。');
        const name = '拍照-' + new Date().toISOString().replace(/[:.]/g, '-') + '.jpg', file = new File([blob], name, { type: 'image/jpeg' });
        photo = { name, size: file.size, source: file, preview: URL.createObjectURL(file) };preview.src = photo.preview;stop();
        status.textContent = '摄像头已关闭。确认使用，或重新拍摄。';
      } catch (e) { if (!finished && version === generation) showError((e as Error).message || '拍照失败，请重试。'); }
      finally { if (!finished && version === generation) { busy = false;render(); } }
    }
    button('close').onclick = close;button('retry').onclick = () => void start();button('retake').onclick = () => void start();
    button('take').onclick = () => void take();button('switch').onclick = () => { facing = facing === 'environment' ? 'user' : 'environment';void start(); };
    button('use').onclick = () => { if (photo && !busy) finish(photo); };
    video.addEventListener('loadeddata', render);dialog.addEventListener('cancel', event => { event.preventDefault();finish(); });
    document.addEventListener('visibilitychange', hidden);window.addEventListener('pagehide', close);
    document.body.append(dialog);
    if (typeof dialog.showModal !== 'function') { finish();return; }
    dialog.showModal();button('close').focus();void start();
  });
}
