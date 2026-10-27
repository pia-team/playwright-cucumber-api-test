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

/**
 * Send multiple files under the same multipart field name (OpenAPI binary array).
 * Uses FormData so the wire format repeats `name="{fieldName}"` for each file.
 */
export async function postMultipartFiles(
  apiClient: ApiClient,
  url: string,
  fieldName: string,
  filePaths: string[],
  extraFields?: Record<string, string>,
) {
  if (!filePaths || filePaths.length === 0) {
    throw new Error('postMultipartFiles requires at least one file path');
  }
  if (filePaths.length === 1) {
    return postMultipartFile(apiClient, url, fieldName, filePaths[0], extraFields);
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(extraFields ?? {})) {
    form.append(key, value);
  }
  for (const filePath of filePaths) {
    const buffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    form.append(fieldName, blob, fileName);
  }
  return apiClient.postMultipartForm(url, form);
}
