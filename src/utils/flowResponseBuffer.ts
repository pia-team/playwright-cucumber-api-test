/**
 * Deterministic API Flow capture buffer: last N HTTP JSON responses with method/URL/status.
 * Replaces silent "__cotesterLastJsonBody only" selection.
 */

export type FlowHttpCapture = {
  method: string;
  url: string;
  status: number;
  body: unknown;
  at: number;
};

const MAX = 40;

function buf(): FlowHttpCapture[] {
  const g = globalThis as typeof globalThis & { __cotesterFlowHttpBuffer?: FlowHttpCapture[] };
  if (!g.__cotesterFlowHttpBuffer) {
    g.__cotesterFlowHttpBuffer = [];
  }
  return g.__cotesterFlowHttpBuffer;
}

export function recordFlowHttpResponse(entry: {
  method: string;
  url: string;
  status: number;
  body: unknown;
}): void {
  const method = (entry.method || '').toUpperCase();
  if (!method || !entry.url) return;
  const list = buf();
  list.push({
    method,
    url: entry.url,
    status: entry.status,
    body: entry.body,
    at: Date.now(),
  });
  while (list.length > MAX) {
    list.shift();
  }
  // Back-compat for older readers
  (globalThis as any).__cotesterLastJsonBody = entry.body;
  (globalThis as any).__cotesterLastMethod = method;
  (globalThis as any).__cotesterLastUrl = entry.url;
}

export function clearFlowHttpBuffer(): void {
  const g = globalThis as typeof globalThis & { __cotesterFlowHttpBuffer?: FlowHttpCapture[] };
  g.__cotesterFlowHttpBuffer = [];
}

function urlMatches(pattern: string | undefined, url: string): boolean {
  if (!pattern || !pattern.trim()) return true;
  const p = pattern.trim();
  try {
    if (p.startsWith('/') && p.endsWith('/') && p.length > 2) {
      return new RegExp(p.slice(1, -1), 'i').test(url);
    }
  } catch {
    // fall through
  }
  return url.toLowerCase().includes(p.toLowerCase());
}

export function extractJsonPath(body: unknown, jsonPath: string | undefined): string | undefined {
  if (body == null) return undefined;
  if (!jsonPath || jsonPath === '$') {
    return typeof body === 'string' ? body : JSON.stringify(body);
  }
  const parts = jsonPath.replace(/^\$\.?/, '').split('.').filter(Boolean);
  let cur: any = body;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  if (cur == null) return undefined;
  return typeof cur === 'string' || typeof cur === 'number' || typeof cur === 'boolean'
    ? String(cur)
    : JSON.stringify(cur);
}

export type CaptureRule = {
  variableKey: string;
  required?: boolean;
  sourceType?: string;
  sourceDefinition?: {
    method?: string;
    urlPattern?: string;
    jsonPath?: string;
    status?: number;
  };
};

export type CaptureApplyResult = {
  values: Record<string, string>;
  errors: string[];
};

/**
 * Apply binding rules against the buffer. Fail-closed:
 * - 0 matches → error when required
 * - >1 matches with identical method+urlPattern specificity → error (no silent last-wins)
 *   (We take the most recent single match after filtering; if filter is empty and multiple
 *    unfiltered responses exist for a required rule without method/url, error.)
 */
export function applyCaptureRules(rules: CaptureRule[]): CaptureApplyResult {
  const values: Record<string, string> = {};
  const errors: string[] = [];
  const responses = [...buf()].reverse();

  for (const rule of rules) {
    if ((rule.sourceType || 'NETWORK_RESPONSE') !== 'NETWORK_RESPONSE') continue;
    const def = rule.sourceDefinition || {};
    const hasSelector = Boolean(def.method || def.urlPattern || def.status);
    const matches = responses.filter((r) => {
      if (def.method && r.method.toUpperCase() !== String(def.method).toUpperCase()) return false;
      if (def.status != null && r.status !== Number(def.status)) return false;
      return urlMatches(def.urlPattern, r.url);
    });

    if (matches.length === 0) {
      if (rule.required !== false) {
        errors.push(
          `No HTTP response matched capture for "${rule.variableKey}"` +
            (hasSelector
              ? ` (method=${def.method || '*'}, url=${def.urlPattern || '*'})`
              : ' — add method/urlPattern to the binding source'),
        );
      }
      continue;
    }

    if (matches.length > 1 && rule.required !== false) {
      errors.push(
        `Ambiguous capture for "${rule.variableKey}": ${matches.length} matching responses` +
          (hasSelector
            ? ' — narrow method/urlPattern/status until one response matches'
            : ' — add method/urlPattern to the binding source'),
      );
      continue;
    }

    const hit = matches[0];
    const value = extractJsonPath(hit.body, def.jsonPath || '$.id');
    if (value == null || value === '') {
      if (rule.required !== false) {
        errors.push(
          `JSONPath ${def.jsonPath || '$.id'} not found for "${rule.variableKey}" on ${hit.method} ${hit.url}`,
        );
      }
      continue;
    }
    values[rule.variableKey] = value;
  }

  return { values, errors };
}
