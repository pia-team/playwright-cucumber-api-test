/**
 * Re-acquire Bearer from Credential TOKEN_CURL template (401 recovery / missing API_TOKEN).
 * Never logs secret or token values.
 */
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { loadRuntimeCredentialsFile } from './runtimeCredentials';

const PLACEHOLDER = /\{\{(username|password|client_id|client_secret)\}\}/g;

function isMasked(value: string | undefined | null): boolean {
  if (value == null) return true;
  const v = value.trim();
  if (!v) return true;
  if (v === '********' || v === '••••••••' || v === '***') return true;
  const upper = v.toUpperCase();
  return upper.includes('[REDACTED') || upper === 'REDACTED';
}

function resolveBody(template: string, secrets: Record<string, string>): string {
  const form = !template.trim().startsWith('{') && template.includes('=');
  return template.replace(PLACEHOLDER, (_full, name: string) => {
    const key =
      name === 'client_id' ? 'clientId' : name === 'client_secret' ? 'clientSecret' : name;
    const value = secrets[key];
    if (isMasked(value)) {
      throw new Error(
        `Credential field "${key}" is required to resolve {{${name}}}. Token was not acquired.`,
      );
    }
    return form ? encodeURIComponent(value) : value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  });
}

function readJsonPath(obj: unknown, path: string): string | null {
  if (!path || path === '$') return null;
  if (!path.startsWith('$.')) return null;
  const parts = path.slice(2).split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[p];
  }
  if (cur == null) return null;
  const text = String(cur);
  return text && !isMasked(text) ? text : null;
}

function hostAllowed(hostname: string, trusted: Set<string>): boolean {
  const h = hostname.toLowerCase();
  if (h === 'metadata.google.internal' || h === 'metadata') return false;
  if (trusted.has(h)) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return false;
  return true; // public hosts OK; private IP checks are best-effort below
}

function assertNotPrivateIp(hostname: string, trusted: Set<string>): void {
  if (trusted.has(hostname.toLowerCase())) return;
  // Literal IPv4 private ranges
  const m = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) {
    throw new Error('Private token host is not allowlisted. Token was not acquired.');
  }
}

function requestOnce(
  method: string,
  urlStr: string,
  headers: Record<string, string>,
  body: string | null,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout: 15_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', () => reject(new Error('Token request network error. Token was not acquired.')));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Token request timed out. Token was not acquired.'));
    });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Acquire access token from runtime TOKEN_CURL credential file.
 * Sets process.env.API_TOKEN on success.
 */
export async function acquireTokenFromCurlCredential(): Promise<string> {
  const file = loadRuntimeCredentialsFile();
  if (!file || file.type !== 'TOKEN_CURL') {
    throw new Error(
      'TOKEN_CURL Credential Profile is required for cURL token acquisition. Token was not acquired.',
    );
  }
  const s = file.secrets || {};
  const method = (s.tokenMethod || 'POST').trim().toUpperCase();
  const url = (s.tokenUrl || '').trim();
  if (!url) {
    throw new Error('TOKEN_CURL credential is missing tokenUrl. Token was not acquired.');
  }
  const jsonPath = (s.tokenJsonPath || '$.access_token').trim();
  const bodyTemplate = s.tokenBody || '';
  const body = bodyTemplate ? resolveBody(bodyTemplate, s) : null;

  let headers: Record<string, string> = { Accept: 'application/json' };
  if (s.tokenHeadersJson) {
    try {
      headers = { ...headers, ...(JSON.parse(s.tokenHeadersJson) as Record<string, string>) };
    } catch {
      // ignore
    }
  }
  if (body && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = body.trim().startsWith('{')
      ? 'application/json'
      : 'application/x-www-form-urlencoded';
  }

  const parsed = new URL(url);
  const trusted = new Set<string>();
  trusted.add(parsed.hostname.toLowerCase());
  for (const envUrl of [process.env.COTESTER_API_BASE_URL, process.env.BASE_URL]) {
    if (!envUrl) continue;
    try {
      trusted.add(new URL(envUrl).hostname.toLowerCase());
    } catch {
      // ignore
    }
  }
  if (!hostAllowed(parsed.hostname, trusted)) {
    throw new Error('Token host is not allowed. Token was not acquired.');
  }
  assertNotPrivateIp(parsed.hostname, trusted);

  const res = await requestOnce(method, url, headers, body);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Token endpoint returned HTTP ${res.status}. Token was not acquired.`);
  }
  let json: unknown;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new Error('Token response could not be parsed. Token was not acquired.');
  }
  const token = readJsonPath(json, jsonPath);
  if (!token) {
    throw new Error(`Token response missing value at ${jsonPath}. Token was not acquired.`);
  }
  process.env.API_TOKEN = token;
  return token;
}

export function isTokenCurlCredential(): boolean {
  return (
    process.env.COTESTER_TOKEN_CURL === '1' ||
    loadRuntimeCredentialsFile()?.type === 'TOKEN_CURL'
  );
}
