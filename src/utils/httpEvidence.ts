/**
 * Structured HTTP evidence for CoTester API runs — secrets redacted, bodies size-capped.
 * Attached to Cucumber steps as named Allure attachments on every HTTP send.
 */

const SENSITIVE_HEADER =
  /^(authorization|cookie|set-cookie|x-api-key|api-key|apikey|x-auth-token|token|access-token|x-access-token|proxy-authorization)$/i;
const SENSITIVE_BODY_KEYS =
  /pass(word)?|secret|token|access[_-]?token|refresh[_-]?token|authorization|client_secret|api[_-]?key/i;
const SENSITIVE_QUERY =
  /^(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|secret|client[_-]?secret)$/i;

/** Default body cap for success and failure attachments. */
export const MAX_BODY = 4096;

/**
 * When `COTESTER_HTTP_EVIDENCE_FULL_BODY=1`, raise the body cap (still hard-capped).
 * Default keeps reports small and reduces accidental PII exposure.
 */
export function bodyLimit(): number {
  if (process.env.COTESTER_HTTP_EVIDENCE_FULL_BODY === '1') {
    return 64 * 1024;
  }
  return MAX_BODY;
}

export type HttpEvidence = {
  method: string;
  /** Resolved path + query (secrets redacted). */
  url: string;
  path?: string;
  query?: Record<string, string>;
  requestHeaders: Record<string, string>;
  requestBody?: string | null;
  requestBodyKind?: 'json' | 'text' | 'binary' | 'empty' | 'omitted';
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string | null;
  responseBodyKind?: 'json' | 'text' | 'binary' | 'empty' | 'omitted';
  expectedStatus?: number;
  assertionFailure?: string | null;
  authMode?: string;
  durationMs?: number;
  requestTimestamp?: string;
  transportError?: string | null;
  truncated?: boolean;
};

export type HttpAttachmentBundle = {
  summary: string;
  request: string;
  response: string;
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
    query: partial.query ?? prev?.query,
    requestHeaders: redactHeaders(partial.requestHeaders || prev?.requestHeaders || {}),
    requestBody: sanitizeBody(partial.requestBody ?? prev?.requestBody ?? null).text,
    requestBodyKind: partial.requestBodyKind ?? prev?.requestBodyKind,
    responseStatus: partial.responseStatus ?? prev?.responseStatus,
    responseHeaders: redactHeaders(partial.responseHeaders || prev?.responseHeaders || {}),
    responseBody: sanitizeBody(partial.responseBody ?? prev?.responseBody ?? null).text,
    responseBodyKind: partial.responseBodyKind ?? prev?.responseBodyKind,
    expectedStatus: partial.expectedStatus ?? prev?.expectedStatus,
    assertionFailure: partial.assertionFailure ?? prev?.assertionFailure ?? null,
    authMode: partial.authMode ?? prev?.authMode,
    durationMs: partial.durationMs ?? prev?.durationMs,
    requestTimestamp: partial.requestTimestamp ?? prev?.requestTimestamp,
    transportError: partial.transportError ?? prev?.transportError ?? null,
    truncated: partial.truncated ?? prev?.truncated,
  };
}

export function recordResponseEvidence(
  status: number,
  headers: Record<string, string>,
  bodyText: string | null,
  extras?: { durationMs?: number; transportError?: string | null },
): void {
  const sanitized = sanitizeBody(bodyText);
  beginHttpEvidence({
    responseStatus: status,
    responseHeaders: headers,
    responseBody: sanitized.text,
    responseBodyKind: sanitized.kind,
    durationMs: extras?.durationMs,
    transportError: extras?.transportError ?? null,
    truncated: sanitized.truncated || undefined,
  });
}

/**
 * Safe 401 diagnosis for INFO logs. Never returns the raw WWW-Authenticate header
 * or secret-bearing parameters (error_description, tokens, etc.).
 */
export function summarizeUnauthorizedChallenge(
  status: number,
  headers: Record<string, string> | undefined | null,
): string {
  const statusText = status === 401 ? 'Unauthorized' : String(status);
  if (status !== 401) {
    return `HTTP ${status} ${statusText}`;
  }
  const raw = findHeader(headers, 'www-authenticate');
  if (!raw) {
    return 'HTTP 401 Unauthorized — no WWW-Authenticate challenge on the response (token not logged; validity not determined)';
  }
  const scheme = (raw.match(/^([A-Za-z0-9._+-]+)/) || [])[1] || 'unknown';
  const error = matchAuthParam(raw, 'error');
  const parts = [`scheme=${scheme}`];
  if (error) parts.push(`error=${error}`);
  return (
    `HTTP 401 Unauthorized — auth challenge present (${parts.join(', ')}); `
    + 'sensitive challenge parameters redacted; token validity not determined'
  );
}

function findHeader(
  headers: Record<string, string> | undefined | null,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const want = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === want && value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return undefined;
}

function matchAuthParam(header: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i');
  const quoted = header.match(re);
  if (quoted?.[1]) return quoted[1].replace(/[^\w.-]/g, '').slice(0, 64) || undefined;
  const bare = header.match(new RegExp(`${name}\\s*=\\s*([^,\\s]+)`, 'i'));
  if (bare?.[1]) return bare[1].replace(/[^\w.-]/g, '').slice(0, 64) || undefined;
  return undefined;
}

export function recordAssertionFailure(message: string): void {
  beginHttpEvidence({ assertionFailure: message });
}

export function getHttpEvidence(): HttpEvidence | undefined {
  return (global as any).__cotesterHttpEvidence as HttpEvidence | undefined;
}

/** Build path?query from a resolved path and query map (values should already be substituted). */
export function buildResolvedUrl(path: string, query?: Record<string, string>): string {
  const base = path || '/';
  if (!query || Object.keys(query).length === 0) {
    return base;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key == null || key === '') continue;
    params.append(key, value ?? '');
  }
  const qs = params.toString();
  if (!qs) return base;
  return base.includes('?') ? `${base}&${qs}` : `${base}?${qs}`;
}

/**
 * Legacy single-blob helper (kept for auth e2e / concurrent workers).
 * Prefer {@link buildHttpAttachmentBundle} for Allure named attachments.
 */
export function evidenceForAttach(failed: boolean): string | null {
  const bundle = buildHttpAttachmentBundle();
  if (!bundle) return null;
  if (!failed && !getHttpEvidence()?.assertionFailure) {
    return bundle.summary;
  }
  return JSON.stringify(
    {
      summary: JSON.parse(bundle.summary),
      request: JSON.parse(bundle.request),
      response: JSON.parse(bundle.response),
    },
    null,
    2,
  );
}

/** Named Allure attachment payloads (already redacted / size-capped). */
export function buildHttpAttachmentBundle(): HttpAttachmentBundle | null {
  const ev = getHttpEvidence();
  if (!ev) return null;

  const url = redactUrl(ev.url || '');
  const requestHeaders = redactHeaders(ev.requestHeaders || {});
  const responseHeaders = redactHeaders(ev.responseHeaders || {});
  const requestBody = sanitizeBody(ev.requestBody).text;
  const responseBody = sanitizeBody(ev.responseBody).text;
  const query = redactQueryMap(ev.query || {});

  const summary = {
    method: ev.method,
    url,
    responseStatus: ev.responseStatus ?? null,
    durationMs: ev.durationMs ?? null,
    authMode: ev.authMode || 'NONE',
    requestTimestamp: ev.requestTimestamp ?? null,
    assertionFailure: ev.assertionFailure ?? null,
    transportError: ev.transportError ?? null,
    truncated: Boolean(ev.truncated),
  };

  const request = {
    method: ev.method,
    url,
    path: ev.path || null,
    query,
    headers: requestHeaders,
    body: requestBody,
    bodyKind: ev.requestBodyKind || inferBodyKind(requestBody),
    authMode: ev.authMode || 'NONE',
    timestamp: ev.requestTimestamp ?? null,
  };

  const response = {
    status: ev.responseStatus ?? null,
    headers: responseHeaders,
    body: responseBody,
    bodyKind: ev.responseBodyKind || inferBodyKind(responseBody),
    durationMs: ev.durationMs ?? null,
    transportError: ev.transportError ?? null,
    truncated: Boolean(ev.truncated),
  };

  return {
    summary: JSON.stringify(summary, null, 2),
    request: JSON.stringify(request, null, 2),
    response: JSON.stringify(response, null, 2),
  };
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
    } else if (/^bearer\s+/i.test(String(v ?? ''))) {
      out[k] = 'Bearer [REDACTED]';
    } else if (/^basic\s+/i.test(String(v ?? ''))) {
      out[k] = 'Basic [REDACTED]';
    } else {
      out[k] = String(v ?? '');
    }
  }
  return out;
}

export function redactQueryMap(query: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const apiKeyQuery = process.env.API_KEY_QUERY?.trim();
  for (const [k, v] of Object.entries(query || {})) {
    if (
      SENSITIVE_QUERY.test(k) ||
      SENSITIVE_BODY_KEYS.test(k) ||
      (apiKeyQuery && k.toLowerCase() === apiKeyQuery.toLowerCase())
    ) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = String(v ?? '');
    }
  }
  return out;
}

export function redactBody(body: string | null | undefined): string | null {
  return sanitizeBody(body).text;
}

function inferBodyKind(body: string | null | undefined): HttpEvidence['requestBodyKind'] {
  if (body == null || body === '') return 'empty';
  const trimmed = body.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('[binary ') || trimmed.includes('…[binary omitted]')) return 'binary';
  return 'text';
}

/** Detect obvious binary / non-text payloads before attaching. */
export function looksBinary(body: string | null | undefined): boolean {
  if (body == null || body === '') return false;
  if (body.includes('\u0000')) return true;
  let suspicious = 0;
  const sample = body.slice(0, 512);
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code < 9 || (code > 13 && code < 32)) suspicious += 1;
  }
  return suspicious > sample.length * 0.1;
}

const OMITTED_REDACTION_FAILED = '[body omitted: redaction failed]';

/** True when text looks like application/x-www-form-urlencoded (or query-string style). */
export function looksLikeFormUrlEncoded(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return false;
  }
  if (!trimmed.includes('=')) {
    return false;
  }
  // At least one key=value pair; allow repeated keys and empty values.
  return /(?:^|[&?])[^=&\s]+=/.test(trimmed);
}

/**
 * Redact sensitive keys in form-urlencoded bodies. Preserves non-sensitive fields
 * (e.g. grant_type). Returns null when the body cannot be safely treated as form data.
 */
export function redactFormUrlEncoded(body: string): string | null {
  try {
    const trimmed = body.trim();
    const pairs = trimmed.split('&');
    const out: string[] = [];
    for (const pair of pairs) {
      if (pair === '') {
        out.push('');
        continue;
      }
      const eq = pair.indexOf('=');
      if (eq < 0) {
        out.push(pair);
        continue;
      }
      const rawKey = pair.slice(0, eq);
      const rawVal = pair.slice(eq + 1);
      let key = rawKey;
      try {
        key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      } catch {
        // keep raw key
      }
      if (isSensitiveFormKey(key)) {
        out.push(`${rawKey}=[REDACTED]`);
      } else {
        out.push(`${rawKey}=${rawVal}`);
      }
    }
    return out.join('&');
  } catch {
    return null;
  }
}

function isSensitiveFormKey(key: string): boolean {
  return SENSITIVE_BODY_KEYS.test(key) || SENSITIVE_QUERY.test(key);
}

/** Detect leftover sensitive key=value pairs that were not redacted (fail-closed guard). */
export function hasUnredactedSensitivePairs(text: string): boolean {
  const re =
    /(?:^|[&?\s])((?:password|passwd|client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|secret|token))\s*=\s*(?!\[REDACTED\])([^\s&]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) != null) {
    const value = match[2] ?? '';
    if (value.length > 0 && value !== '[REDACTED]') {
      return true;
    }
  }
  return false;
}

export function sanitizeBody(body: string | null | undefined): {
  text: string | null;
  kind: NonNullable<HttpEvidence['requestBodyKind']>;
  truncated: boolean;
} {
  if (body == null) return { text: null, kind: 'empty', truncated: false };
  if (body === '') return { text: '', kind: 'empty', truncated: false };

  if (looksBinary(body)) {
    return {
      text: `[binary omitted; ${body.length} bytes]`,
      kind: 'binary',
      truncated: true,
    };
  }

  let text = String(body);
  let kind: NonNullable<HttpEvidence['requestBodyKind']> = 'text';
  try {
    const parsed = JSON.parse(text);
    text = JSON.stringify(redactJson(parsed), null, 2);
    kind = 'json';
  } catch {
    if (looksLikeFormUrlEncoded(text)) {
      const form = redactFormUrlEncoded(text);
      if (form == null) {
        return { text: OMITTED_REDACTION_FAILED, kind: 'omitted', truncated: true };
      }
      text = form;
      kind = 'text';
    } else {
      text = text.replace(/(Bearer\s+)[A-Za-z0-9._\-+=/]+/gi, '$1[REDACTED]');
      text = text.replace(/(Basic\s+)[A-Za-z0-9+/=]+/gi, '$1[REDACTED]');
      // Best-effort key=value redaction for ambiguous text bodies.
      if (text.includes('=')) {
        const form = redactFormUrlEncoded(text);
        if (form != null) {
          text = form;
        }
      }
      kind = 'text';
    }
  }

  const knownSecrets = ((global as any).__cotesterRedactValues || []) as string[];
  if (knownSecrets.length > 0) {
    text = applySensitiveValueRedaction(text, knownSecrets);
  }

  if (hasUnredactedSensitivePairs(text) || jsonStillContainsSensitiveScalars(text, kind)) {
    return { text: OMITTED_REDACTION_FAILED, kind: 'omitted', truncated: true };
  }

  const limit = bodyLimit();
  if (text.length > limit) {
    return { text: text.slice(0, limit) + '…[truncated]', kind, truncated: true };
  }
  return { text, kind, truncated: false };
}

function jsonStillContainsSensitiveScalars(
  text: string,
  kind: NonNullable<HttpEvidence['requestBodyKind']>,
): boolean {
  if (kind !== 'json') {
    return false;
  }
  try {
    const parsed = JSON.parse(text);
    return findUnredactedSensitiveJson(parsed);
  } catch {
    return true;
  }
}

function findUnredactedSensitiveJson(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(findUnredactedSensitiveJson);
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_BODY_KEYS.test(k)) {
        if (v !== '[REDACTED]' && v != null && String(v).length > 0) {
          return true;
        }
      } else if (findUnredactedSensitiveJson(v)) {
        return true;
      }
    }
  }
  return false;
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

export function redactUrl(url: string): string {
  try {
    const u = new URL(url, 'http://placeholder.local');
    const apiKeyQuery = process.env.API_KEY_QUERY?.trim();
    for (const key of [...u.searchParams.keys()]) {
      if (
        SENSITIVE_BODY_KEYS.test(key) ||
        SENSITIVE_QUERY.test(key) ||
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

/** Apply extra sensitive value redaction (explicit secrets) onto a string. */
export function applySensitiveValueRedaction(text: string, values: string[]): string {
  let out = text;
  const sorted = [...values]
    .filter((value) => value && value.length >= 3)
    .sort((left, right) => right.length - left.length);
  for (const value of sorted) {
    out = out.split(value).join('[REDACTED]');
  }
  return out;
}
