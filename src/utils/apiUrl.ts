/** Build absolute API URL from Swagger baseURI + path (required for Playwright request). */
export function buildApiUrl(baseURI: string, path: string): string {
  const base = baseURI.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
