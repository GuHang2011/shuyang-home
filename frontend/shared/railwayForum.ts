export const RAILWAY_BOARD = '淮新高铁';
export const railwayDiscussionTypes = ['进展讨论', '站点与接驳', '返乡出行', '资料分享', '提问求证'];

/** A portable HTTP(S) link check; mini-programs do not always provide URL. */
export function safeForumSourceUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!url || url.length > 1000 || /[\s\\<>"'`\u0000-\u001f\u007f]/.test(url)) return '';
  const match = /^https?:\/\/([^/?#]+)(?:[/?#].*)?$/i.exec(url);
  if (!match) return '';
  // Credentials obscure the actual source host, so exclude them as well.
  const authority = match[1];
  if (authority.includes('@') || !/^(?:\[[0-9a-f:]+\]|[a-z0-9\u0080-\uffff](?:[a-z0-9\u0080-\uffff.-]*[a-z0-9\u0080-\uffff])?)(?::\d{1,5})?$/i.test(authority)) return '';
  const port = /:(\d+)$/.exec(authority);
  return port && (Number(port[1]) < 1 || Number(port[1]) > 65535) ? '' : url;
}
