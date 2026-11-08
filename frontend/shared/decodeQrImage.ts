import type { BrowserQRCodeReader } from '@zxing/browser';

/** Generated cards can confuse finder detection; retry their monochrome image directly. */
export async function decodeQrImage(reader: BrowserQRCodeReader, url: string): Promise<string> {
  try { return (await reader.decodeFromImageUrl(url)).getText(); }
  catch {
    const { default: DecodeHintType } = await import('@zxing/library/es2015/core/DecodeHintType');
    const previous = reader.hints;
    reader.hints = new Map(previous);reader.hints.set(DecodeHintType.PURE_BARCODE, true);
    try { return (await reader.decodeFromImageUrl(url)).getText(); }
    finally { reader.hints = previous; }
  }
}
