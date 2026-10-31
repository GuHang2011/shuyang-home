import { type BusinessReport, type WorkbookFile } from './useBusinessFiles';

export async function readWebWorkbook(file: File): Promise<WorkbookFile> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('请选择 .xlsx 格式的 Excel 文件');
  if (file.size > 2 * 1024 * 1024) throw new Error('文件不能超过2MB');
  const bytes = new Uint8Array(await file.arrayBuffer());let raw = '';
  for (let start = 0; start < bytes.length; start += 8192) raw += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return { filename: file.name, base64: btoa(raw) };
}
export async function saveWebWorkbook(file: WorkbookFile) {
  const raw = atob(file.base64), bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');link.href = url;link.download = file.filename;document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export function reportHtml(report: BusinessReport) {
  return '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>' + escapeHtml(report.title) + '</title><style>@page{size:A4 landscape;margin:12mm}body{font:12px "Microsoft YaHei","PingFang SC",sans-serif;color:#172e3d}h1{font-size:20px}p{font-size:11px;color:#52626b}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #aeb9be;padding:6px;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#edf1f2}thead{display:table-header-group}tr{break-inside:avoid}footer{margin-top:12px;font-size:10px}</style></head><body><h1>沭阳之家 · ' + escapeHtml(report.title) + '</h1><p>生成时间：' + escapeHtml(report.generatedAt) + '（北京时间） · 共 ' + report.total + ' 条 · 状态：' + escapeHtml(report.filter.status) + ' · 搜索：' + escapeHtml(report.filter.query || '无') + '</p><table><thead><tr>' + report.headers.map(h => '<th>' + escapeHtml(h) + '</th>').join('') + '</tr></thead><tbody>' + report.rows.map(row => '<tr>' + row.map(cell => '<td>' + escapeHtml(cell) + '</td>').join('') + '</tr>').join('') + '</tbody></table><footer>本报表包含业务资料，请按管理用途妥善保管。</footer></body></html>';
}
export function printWebReport(report: BusinessReport): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');frame.setAttribute('aria-hidden', 'true');frame.tabIndex = -1;frame.title = '业务报表打印';frame.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;left:0;border:0;';
    const cleanup = () => frame.remove();
    frame.onload = () => { try { const target = frame.contentWindow;if (!target) throw new Error('无法打开打印预览');target.onafterprint = cleanup;target.focus();target.print();window.setTimeout(cleanup, 120000);resolve(); } catch (e) { cleanup();reject(e); } };
    frame.srcdoc = reportHtml(report);document.body.appendChild(frame);
  });
}
