import { createDemoState, demoRequest, demoSchema, stickerPacks } from './demo-runtime.mjs';
const release = '__DEMO_VERSION__';
const scope = new URL(self.registration.scope);
const databaseName = 'shuyang-demo:' + scope.pathname;
const database = new Promise((resolve, reject) => {
  const open = indexedDB.open(databaseName, 1);
  open.onupgradeneeded = () => open.result.createObjectStore('local');
  open.onsuccess = () => resolve(open.result);open.onerror = () => reject(open.error);
});
async function store(value) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('local', value ? 'readwrite' : 'readonly'), table = tx.objectStore('local');
    const request = value ? table.put(value, 'state') : table.get('state');
    tx.oncomplete = () => resolve(request.result);tx.onerror = () => reject(tx.error);tx.onabort = () => reject(tx.error);
  });
}
let state;
let queue = Promise.resolve();
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Demo-Version': release } });
async function handle(request) {
  try {
    if (!state) { const saved = await store();state = saved?.schema === demoSchema ? saved : createDemoState(); }
    const reset = new URL(request.url).pathname === '/api/demo/reset';
    const write = request.method !== 'GET';
    const next = write ? (reset ? createDemoState() : structuredClone(state)) : state;
    const result = await demoRequest(next, request);
    if (write) { await store(next);state = next; }
    if (result instanceof Blob) return new Response(result, { headers: { 'Content-Type': result.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    return json({ code: 0, data: result });
  } catch (error) { return json({ code: 400, message: error.message || '本机演示数据无法保存，请检查浏览器存储设置。' }, 400); }
}
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin) return;
  if (/^\/api\/chat\/stickers\/demo-[a-z]+\.png$/.test(url.pathname)) {
    const label = stickerPacks[0].stickers.find(s => url.pathname.endsWith(s.id + '.png'))?.label || '老乡好';
    event.respondWith(Promise.resolve(new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="24" fill="#ecf5ff"/><text x="80" y="98" text-anchor="middle" font-size="30" fill="#174d6b">${label}</text></svg>`, { headers: { 'Content-Type': 'image/svg+xml' } })));return;
  }
  if (url.pathname.startsWith('/api/')) {
    const response = queue.then(() => handle(event.request));queue = response.catch(() => {});event.respondWith(response);return;
  }
  // Existing app public assets use root URLs; Pages hosts this app under a repository path.
  if (/^\/(brand|static)\//.test(url.pathname)) event.respondWith(fetch(new URL(url.pathname.slice(1), scope)));
});
