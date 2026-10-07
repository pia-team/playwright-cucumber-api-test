import * as fs from 'fs/promises';
import * as path from 'path';
import { ApiClient } from '../core/api/apiClient';

export async function postMultipartFile(
  apiClient: ApiClient,
  url: string,
  fieldName: string,
  filePath: string,
  extraFields?: Record<string, string>,
) {
  const buffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    ...(extraFields ?? {}),
    [fieldName]: {
      name: fileName,
      mimeType: 'application/octet-stream',
      buffer,
    },
  };
  return apiClient.postMultipart(url, multipart);
}
