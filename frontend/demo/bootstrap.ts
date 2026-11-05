import './demo.css';

export async function startDemo() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) throw new Error('请使用支持本地存储的现代浏览器，并通过 HTTPS 或 localhost 打开体验版。');
  const registration = await navigator.serviceWorker.register(new URL('demo-worker.js', document.baseURI), { type: 'module', updateViaCache: 'none' });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { navigator.serviceWorker.removeEventListener('controllerchange', changed);reject(new Error('演示环境加载超时，请刷新重试。')); }, 15000);
    function changed() { clearTimeout(timer);resolve(); }
    navigator.serviceWorker.addEventListener('controllerchange', changed, { once: true });
  });
  void registration.update().catch(() => {});
  const actorKey = 'shuyang_demo_identity', tokenKey = 'shuyang_home_session';
  const selected = sessionStorage.getItem(actorKey) || 'demo-member';
  const setActor = (actor: string) => { sessionStorage.setItem(actorKey, actor);actor === 'guest' ? sessionStorage.removeItem(tokenKey) : sessionStorage.setItem(tokenKey, actor); };
  setActor(['demo-member', 'demo-admin', 'guest'].includes(selected) ? selected : 'demo-member');
  const bar = document.createElement('aside');bar.className = 'demo-toolbar';bar.setAttribute('aria-label', '演示环境控制');
  bar.innerHTML = '<div class="demo-description"><strong>沭阳之家 · 在线体验</strong><span>虚构样例 · 数据和照片仅存于当前浏览器</span></div><div class="demo-actions"><label>体验身份<select aria-label="演示身份"><option value="demo-member">演示会员</option><option value="demo-admin">演示管理员</option><option value="guest">游客</option></select></label><button type="button" class="demo-guide">体验指引</button><button type="button" class="demo-reset">重置数据</button></div>';
  const select = bar.querySelector('select')!;select.value = sessionStorage.getItem(actorKey)!;
  select.onchange = () => { setActor(select.value);location.hash = select.value === 'demo-admin' ? 'admin' : 'home';location.reload(); };
  const guide = document.createElement('dialog');guide.className = 'demo-dialog';guide.setAttribute('aria-label', '在线体验指引');
  guide.innerHTML = '<h2>从这些流程开始体验</h2><ol><li>点击“换肤”，选择温暖乡情、简洁商务、深色，也可跟随系统。</li><li>以会员身份体验活动报名、论坛发帖、聊天表情与拍照、特产下单。</li><li>切换管理员，体验会员及内容审核、相册拍照、商品和广播管理。</li><li>打开乡情大屏查看图表与插画轮播，管理员可上传照片或MP4视频。</li><li>在乡友通讯录保存分组、星标和私人备注；生活服务可体验指南与个人材料清单。</li></ol><p>数据与附件保存在这个浏览器。不同访客之间不共享，不会发送真实消息、生成真实订单或收款。重置会删除本机演示记录和照片。</p><p>演示账号 demo / admin，密码均为 Demo12345678。扩展业务、文件报表与定位签到请在完整部署版本中验收。</p><button type="button">开始体验</button>';
  guide.querySelector('button')!.onclick = () => guide.close();
  bar.querySelector<HTMLButtonElement>('.demo-guide')!.onclick = () => guide.showModal();
  bar.querySelector<HTMLButtonElement>('.demo-reset')!.onclick = async () => {
    if (!confirm('重置将删除这个浏览器中的演示记录和照片，恢复初始样例。是否继续？')) return;
    try { const response = await fetch('/api/demo/reset', { method: 'POST' });const result = await response.json();if (!response.ok || result.code !== 0) throw Error(result.message || '重置失败');location.reload(); }
    catch (error) { alert((error as Error).message); }
  };
  document.documentElement.classList.add('demo-mode');document.body.prepend(bar);document.body.append(guide);
  const resize = () => document.documentElement.style.setProperty('--demo-toolbar-height', bar.getBoundingClientRect().height + 'px');
  new ResizeObserver(resize).observe(bar);resize();
}
