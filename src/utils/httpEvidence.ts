/**
 * Structured HTTP evidence for CoTester API runs — secrets redacted, bodies size-capped.
 * Attached to Cucumber steps on failure (and compact summary on success).
 */

const SENSITIVE_HEADER =
  /^(authorization|cookie|set-cookie|x-api-key|api-key|apikey|x-auth-token|token|access-token|x-access-token|proxy-authorization)$/i;
const SENSITIVE_BODY_KEYS =
  /pass(word)?|secret|token|access[_-]?token|refresh[_-]?token|authorization|client_secret|api[_-]?key/i;
const MAX_BODY = 4096;

export type HttpEvidence = {
  method: string;
  url: string;
  path?: string;
  requestHeaders: Record<string, string>;
  requestBody?: string | null;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string | null;
  expectedStatus?: number;
  assertionFailure?: string | null;
  authMode?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __cotesterHttpEvidence: HttpEvidence | undefined;
}

export function resetHttpEvidence(): void {
  (global as any).__cotesterHttpEvidence = undefined;
}

export function beginHttpEvidence(partial: Partial<HttpEvidence>): void {
  const prev = (global as any).__cotesterHttpEvidence as HttpEvidence | undefined;
  (global as any).__cotesterHttpEvidence = {
    method: partial.method || prev?.method || 'GET',
    url: partial.url || prev?.url || '',
    path: partial.path ?? prev?.path,
    requestHeaders: redactHeaders(partial.requestHeaders || prev?.requestHeaders || {}),
    requestBody: redactBody(partial.requestBody ?? prev?.requestBody ?? null),
    responseStatus: partial.responseStatus ?? prev?.responseStatus,
    responseHeaders: redactHeaders(partial.responseHeaders || prev?.responseHeaders || {}),
    responseBody: redactBody(partial.responseBody ?? prev?.responseBody ?? null),
    expectedStatus: partial.expectedStatus ?? prev?.expectedStatus,
    assertionFailure: partial.assertionFailure ?? prev?.assertionFailure ?? null,
    authMode: partial.authMode ?? prev?.authMode,
  };
}

export function recordResponseEvidence(
  status: number,
  headers: Record<string, string>,
  bodyText: string | null,
): void {
  beginHttpEvidence({
    responseStatus: status,
    responseHeaders: headers,
    responseBody: bodyText,
  });
}

export function recordAssertionFailure(message: string): void {
  beginHttpEvidence({ assertionFailure: message });
}

export function getHttpEvidence(): HttpEvidence | undefined {
  return (global as any).__cotesterHttpEvidence as HttpEvidence | undefined;
}

/** Compact evidence for successful steps; full detail when failed or assertion failed. */
export function evidenceForAttach(failed: boolean): string | null {
  const ev = getHttpEvidence();
  if (!ev) return null;
  if (!failed && !ev.assertionFailure) {
    return JSON.stringify(
      {
        method: ev.method,
        url: redactUrl(ev.url),
        responseStatus: ev.responseStatus,
        authMode: ev.authMode || 'NONE',
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      ...ev,
      url: redactUrl(ev.url),
      requestHeaders: redactHeaders(ev.requestHeaders || {}),
      responseHeaders: redactHeaders(ev.responseHeaders || {}),
      requestBody: redactBody(ev.requestBody),
      responseBody: redactBody(ev.responseBody),
    },
    null,
    2,
  );
}

function isSensitiveHeaderName(name: string): boolean {
  if (SENSITIVE_HEADER.test(name)) {
    return true;
  }
  const apiKeyHeader = process.env.API_KEY_HEADER?.trim();
  if (apiKeyHeader && name.toLowerCase() === apiKeyHeader.toLowerCase()) {
    return true;
  }
  return false;
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (isSensitiveHeaderName(k)) {
      out[k] = '[REDACTED]';
    } else if (/^basic\s+/i.test(String(v ?? ''))) {
      out[k] = 'Basic [REDACTED]';
    } else {
      out[k] = String(v ?? '');
    }
  }
  return out;
}

export function redactBody(body: string | null | undefined): string | null {
  if (body == null || body === '') return body ?? null;
  let text = String(body);
  try {
    const parsed = JSON.parse(text);
    text = JSON.stringify(redactJson(parsed));
  } catch {
    text = text.replace(/(Bearer\s+)[A-Za-z0-9._\-+=/]+/gi, '$1[REDACTED]');
    text = text.replace(/(Basic\s+)[A-Za-z0-9+/=]+/gi, '$1[REDACTED]');
  }
  if (text.length > MAX_BODY) {
    return text.slice(0, MAX_BODY) + '…[truncated]';
  }
  return text;
}

function redactJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactJson);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_BODY_KEYS.test(k) ? '[REDACTED]' : redactJson(v);
    }
    return out;
  }
  return value;
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url, 'http://placeholder.local');
    const apiKeyQuery = process.env.API_KEY_QUERY?.trim();
    for (const key of [...u.searchParams.keys()]) {
      if (
        SENSITIVE_BODY_KEYS.test(key) ||
        (apiKeyQuery && key.toLowerCase() === apiKeyQuery.toLowerCase())
      ) {
        u.searchParams.set(key, '[REDACTED]');
      }
    }
    const q = u.searchParams.toString();
    const path = u.pathname + (q ? `?${q}` : '');
    if (url.startsWith('http')) {
      return `${u.protocol}//${u.host}${path}`;
    }
    return path;
  } catch {
    return url;
  }
}
