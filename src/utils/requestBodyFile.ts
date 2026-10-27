import { promises as fs } from 'fs';
import { testData } from './testData';

/**
 * Load raw request-body bytes from a Data Center binding (run manifest localPath).
 * Returns a Buffer so PDF/PNG/ZIP bytes are preserved; UTF-8 text files remain
 * valid JSON/TXT on the wire when sent as `data: Buffer`.
 */
export async function loadRequestBodyBufferFromBinding(bindingKey: string): Promise<Buffer> {
  const key = (bindingKey || '').trim();
  if (!key) {
    throw new Error('Data Center body file binding key is required.');
  }
  let filePath: string;
  try {
    filePath = await testData.getFile(key);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : `Data Center file binding "${key}" is not available.`,
    );
  }
  return fs.readFile(filePath);
}

/** Evidence-safe summary for a binary or text body payload. */
export function summarizeRequestBodyBytes(body: string | Buffer | null | undefined): {
  text: string | null;
  kind: 'json' | 'text' | 'binary' | 'empty' | 'omitted';
  truncated: boolean;
} {
  if (body == null) return { text: null, kind: 'empty', truncated: false };
  if (Buffer.isBuffer(body)) {
    return {
      text: `[binary omitted; ${body.length} bytes]`,
      kind: 'binary',
      truncated: true,
    };
  }
  if (body === '') return { text: '', kind: 'empty', truncated: false };
  return { text: body, kind: 'text', truncated: false };
}
