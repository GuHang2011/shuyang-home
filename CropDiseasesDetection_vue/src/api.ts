const tokenKey = 'shuyang_home_session';
export const getToken = () => sessionStorage.getItem(tokenKey) || '';
export async function uploadMedia(file: File, scope: string, roomId = '') {
  const body = new FormData();body.append('file', file);body.append('scope', scope);body.append('roomId', roomId);
  const response = await fetch('/api/media/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body });
  const result = await response.json();if (!response.ok || result.code !== 0) throw new Error(result.message || '上传失败');return result.data;
}
export async function mediaBlob(id: string) { const response = await fetch('/api/media/' + encodeURIComponent(id), { headers: getToken() ? { Authorization: 'Bearer ' + getToken() } : {} });if (!response.ok) { const error = await response.json();throw new Error(error.message || '附件暂不可用'); }return response.blob(); }
export function setToken(token: string) { token ? sessionStorage.setItem(tokenKey, token) : sessionStorage.removeItem(tokenKey); }
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController();
  const requestToken = getToken();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(requestToken ? { Authorization: 'Bearer ' + requestToken } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    const result = await response.json().catch(() => ({ message: '服务响应异常，请稍后重试' }));
    if (!response.ok || result.code !== 0) {
      if (response.status === 401 && requestToken && requestToken === getToken()) { setToken(''); window.dispatchEvent(new Event('session-expired')); }
      throw new Error(result.message || '请求未完成，请重试');
    }
    return result.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('连接超时，请稍后重试');
    throw error;
  } finally { clearTimeout(timeout); }
}
