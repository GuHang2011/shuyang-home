import { type WorkbookFile, type BusinessReport } from '../../shared/useBusinessFiles';
declare const wx: { env: { USER_DATA_PATH: string } };
// #ifdef H5
import { readWebWorkbook, saveWebWorkbook, printWebReport } from '../../shared/businessFilesBrowser';
// #endif

export function chooseBusinessWorkbook(): Promise<WorkbookFile | null> {
  return new Promise((resolve, reject) => {
    const fail = (e: any) => e.errMsg?.includes('cancel') ? resolve(null) : reject(new Error('无法选择文件，请重试'));
    // #ifdef H5
    uni.chooseFile({ count: 1, type: 'all', extension: ['.xlsx'], fail, success: async result => {
      try { const file = (result.tempFiles as any[])[0];if (file.size > 2 * 1024 * 1024) throw new Error('文件不能超过2MB');const blob = await (await fetch(file.path)).blob();resolve(await readWebWorkbook(new File([blob], file.name))); } catch (e) { reject(e); }
    } });
    // #endif
    // #ifdef MP-WEIXIN
    uni.chooseMessageFile({ count: 1, type: 'file', extension: ['xlsx'], fail, success: result => {
      const file = result.tempFiles[0];if (file.size > 2 * 1024 * 1024) { reject(new Error('文件不能超过2MB'));return; }
      uni.getFileSystemManager().readFile({ filePath: file.path, encoding: 'base64', success: data => resolve({ filename: file.name, base64: String(data.data) }), fail: () => reject(new Error('无法读取文件，请重新选择')) });
    } });
    // #endif
  });
}
export async function saveBusinessWorkbook(file: WorkbookFile): Promise<void> {
  // #ifdef H5
  return saveWebWorkbook(file);
  // #endif
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    const filePath = wx.env.USER_DATA_PATH + '/shuyang-' + Date.now() + '.xlsx';
    uni.getFileSystemManager().writeFile({ filePath, data: file.base64, encoding: 'base64', success: () => {
      uni.openDocument({ filePath, fileType: 'xlsx', showMenu: true, success: () => resolve(), fail: () => reject(new Error('文件已生成，但无法预览，请检查设备文档支持')) });
    }, fail: () => reject(new Error('无法保存文件，请检查剩余存储空间')) });
  });
  // #endif
}
export async function printBusinessReport(report: BusinessReport): Promise<void> {
  // #ifdef H5
  return printWebReport(report);
  // #endif
  // #ifdef MP-WEIXIN
  throw new Error('请导出 Excel，在支持打印的办公软件中打开');
  // #endif
}
