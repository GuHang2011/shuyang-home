const tokenKey = 'shuyang_home_token';
export const getToken = () => String(uni.getStorageSync(tokenKey) || '');
export function uploadMedia(filePath: string, scope: string, roomId = '', originalName = '', progress?: (value: number) => void): Promise<any> { const requestToken = getToken();return new Promise((resolve, reject) => { const task = uni.uploadFile({ url: baseUrl() + '/media/upload', filePath, name: 'file', formData: { scope, roomId, originalName }, timeout: 60000, header: { Authorization: 'Bearer ' + requestToken }, success: response => { if (response.statusCode === 401 && requestToken && requestToken === getToken()) { setToken('');uni.$emit('session-expired'); }try { const result = JSON.parse(response.data);if (response.statusCode !== 200 || result.code !== 0) throw new Error(result.message || '上传失败');resolve(result.data); } catch(e) { reject(e); } }, fail: () => reject(new Error('上传失败，请检查网络或文件大小')) });task.onProgressUpdate(event => progress?.(event.progress)); }); }
export function chooseAudioFile(): Promise<{ path: string; name: string; size: number }> {
  return new Promise((resolve, reject) => {
    const success = (result: any) => { const file = result.tempFiles[0];resolve({ path: file.path, name: file.name, size: file.size }); };
    const fail = () => reject(new Error('未选择音频文件'));
    // #ifdef MP-WEIXIN
    uni.chooseMessageFile({ count: 1, type: 'file', extension: ['mp3','m4a','wav'], success, fail });
    // #endif
    // #ifdef H5
    uni.chooseFile({ count: 1, type: 'all', extension: ['.mp3','.m4a','.wav'], success, fail });
    // #endif
  });
}
export function downloadMedia(id: string): Promise<string> {
  const requestToken = getToken();
  return new Promise((resolve, reject) => {
    uni.downloadFile({ url: baseUrl() + '/media/' + encodeURIComponent(id), timeout: 60000,
      header: requestToken ? { Authorization: 'Bearer ' + requestToken } : {},
      success: response => {
        if (response.statusCode === 401 && requestToken && requestToken === getToken()) { setToken('');uni.$emit('session-expired'); }
        if (response.statusCode === 200) resolve(response.tempFilePath);
        else reject(new Error(response.statusCode === 401 ? '登录已失效，请重新登录后下载' : '附件不可用或无权访问'));
      }, fail: () => reject(new Error('附件下载失败，请检查网络后重试'))
    });
  });
}
export function choosePhotos(count: number, camera = false): Promise<import('../../shared/usePhotoUpload').PhotoFile[]> {
  return new Promise((resolve, reject) => uni.chooseImage({
    count, sizeType: ['compressed'], sourceType: camera ? ['camera'] : ['album'],
    success: result => {
      const files = result.tempFiles as any[];
      resolve(files.map((file, index) => ({ source: file.path, preview: file.path, size: file.size,
        name: file.name || ('照片-' + (index + 1) + (/\.png(?:$|\?)/i.test(file.path) ? '.png' : '.jpg')) })));
    },
    fail: error => error.errMsg?.includes('cancel') ? resolve([]) : reject(new Error('无法打开相机或相册，请检查权限后重试'))
  }));
}
export function choosePhoto(camera = false): Promise<string> { return new Promise((resolve, reject) => uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: camera ? ['camera'] : ['album'], success: result => resolve(result.tempFilePaths[0]), fail: () => reject(new Error('未选择照片，请检查相机或相册权限')) })); }
export function chooseFile(): Promise<string> { return new Promise((resolve, reject) => {
  // #ifdef MP-WEIXIN
  uni.chooseMessageFile({ count: 1, type: 'file', success: result => resolve(result.tempFiles[0].path), fail: () => reject(new Error('未选择文件')) });
  // #endif
  // #ifdef H5
  uni.chooseFile({ count: 1, type: 'all', success: result => resolve(result.tempFilePaths[0]), fail: () => reject(new Error('未选择文件')) });
  // #endif
}); }
export function setToken(token: string) { token ? uni.setStorageSync(tokenKey, token) : uni.removeStorageSync(tokenKey); }
export function baseUrl() {
  let base = String(import.meta.env.VITE_SHUYANG_API_URL || '').replace(/\/$/, '');
  // #ifdef H5
  if (!base) base = '/api';
  // #endif
  if (!base) throw new Error('服务暂未配置，请联系平台工作人员');
  return base;
}
export function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const requestToken = getToken();
  return new Promise((resolve, reject) => {
    let base: string;
    try { base = baseUrl(); } catch (e) { reject(e); return; }
    uni.request({ url: base + path, method: method as any, data: body as any, timeout: 20000,
      header: { 'Content-Type': 'application/json', ...(requestToken ? { Authorization: 'Bearer ' + requestToken } : {}) },
      success: response => {
        if (response.statusCode === 401 && requestToken && requestToken === getToken()) { setToken('');uni.$emit('session-expired'); }
        const data = response.data;
        if (!data || typeof data !== 'object' || Array.isArray(data) || data instanceof ArrayBuffer) { reject(new Error('服务响应异常，请稍后重试'));return; }
        if (response.statusCode >= 200 && response.statusCode < 300 && data.code === 0) resolve(data.data);
        else reject(new Error(typeof data.message === 'string' ? data.message : '服务暂时不可用，请稍后重试'));
      },
      fail: () => reject(new Error('连接失败，请检查网络后重试')),
    });
  });
}
