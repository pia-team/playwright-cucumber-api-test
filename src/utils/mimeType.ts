import * as path from 'path';

/**
 * Resolve multipart file MIME type without forcing application/octet-stream for everything.
 * Explicit contentType wins; otherwise extension heuristics; finally octet-stream fallback.
 */
export function resolveMultipartMimeType(
  fileNameOrPath: string,
  explicitContentType?: string | null,
): string {
  const explicit = (explicitContentType || '').trim();
  if (explicit) {
    return explicit;
  }
  const ext = path.extname(fileNameOrPath || '').toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.pdf':
      return 'application/pdf';
    case '.json':
      return 'application/json';
    case '.xml':
      return 'application/xml';
    case '.txt':
    case '.log':
    case '.csv':
      return 'text/plain';
    case '.html':
    case '.htm':
      return 'text/html';
    case '.zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}
