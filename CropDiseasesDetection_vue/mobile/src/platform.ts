const tokenKey = 'shuyang_home_token';
export const getToken = () => String(uni.getStorageSync(tokenKey) || '');
export function uploadMedia(filePath: string, scope: string, roomId = '', originalName = ''): Promise<any> { return new Promise((resolve, reject) => { uni.uploadFile({ url: baseUrl() + '/media/upload', filePath, name: 'file', formData: { scope, roomId, originalName }, header: { Authorization: 'Bearer ' + getToken() }, success: response => { try { const result = JSON.parse(response.data);if (response.statusCode !== 200 || result.code !== 0) throw new Error(result.message || '上传失败');resolve(result.data); } catch(e) { reject(e); } }, fail: () => reject(new Error('上传失败，请检查网络或文件大小')) }); }); }
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
export function downloadMedia(id: string): Promise<string> { return new Promise((resolve, reject) => { uni.downloadFile({ url: baseUrl() + '/media/' + encodeURIComponent(id), header: getToken() ? { Authorization: 'Bearer ' + getToken() } : {}, success: response => response.statusCode === 200 ? resolve(response.tempFilePath) : reject(new Error('附件不可用或无权访问')), fail: () => reject(new Error('附件下载失败')) }); }); }
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
      success: response => { const data = response.data as any; if (response.statusCode >= 200 && response.statusCode < 300 && data.code === 0) resolve(data.data); else { if (response.statusCode === 401 && requestToken && requestToken === getToken()) { setToken(''); uni.$emit('session-expired'); } reject(new Error(data.message || '服务暂时不可用，请稍后重试')); } },
      fail: () => reject(new Error('连接失败，请检查网络后重试')),
    });
  });
}
