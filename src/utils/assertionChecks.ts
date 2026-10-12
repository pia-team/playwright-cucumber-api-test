/**
 * Deterministic API assertion checks. No AI calls.
 * Schema support is partial: root type, required keys, and properties.type only.
 */

export type CriterionSpec = {
  id?: string;
  description: string;
  type: string;
  path?: string | null;
  operator?: string | null;
  expected?: unknown;
};

export type CriterionContext = {
  responseAvailable: boolean;
  json?: unknown;
  headers?: Record<string, string>;
  elapsedMs?: number | null;
  requestJson?: unknown;
  requestQuery?: Record<string, string>;
};

export type CriterionOutcome = {
  id?: string;
  description: string;
  type: string;
  status: 'PASS' | 'FAIL' | 'NOT_EVALUATED';
  expected: string;
  actual: string;
  path?: string;
  reason?: string;
  stepId?: string;
  stepLabel?: string;
  elapsedMs?: number;
};

const SENSITIVE_KEY = /(password|passwd|secret|token|api[-_]?key|credential|authorization)/i;
const SCHEMA_ROOT_KEYS = new Set(['type', 'required', 'properties']);

export function evaluateCriterion(spec: CriterionSpec, ctx: CriterionContext): CriterionOutcome {
  const base = {
    id: spec.id,
    description: spec.description || spec.type,
    type: spec.type,
    path: spec.path || undefined,
  };
  if (!ctx.responseAvailable) {
    return notEvaluated(
      base,
      'Yanıt alındı',
      'Yanıt yok',
      'HTTP isteği gerçekleşmedi veya yanıt alınamadı. Kriter PASS sayılmadı.',
    );
  }
  try {
    return check(spec, ctx, base);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Assertion çalıştırılamadı';
    return fail(base, labelExpected(spec), 'Kontrol tamamlanamadı', reason);
  }
}

export function formatCriterionFailure(outcome: CriterionOutcome): string {
  const lines = [
    `Kriter: ${outcome.description}`,
    `Sonuç: ${outcome.status}`,
    `Beklenen: ${outcome.expected}`,
    `Gerçekleşen: ${outcome.actual}`,
  ];
  if (outcome.path) lines.push(`Path: ${outcome.path}`);
  if (outcome.reason) lines.push(outcome.reason);
  return lines.join('\n');
}

/**
 * Null when the scenario should stay green.
 * - FAIL outcomes always fail the scenario (soft aggregation).
 * - NOT_EVALUATED body criteria skipped after a status mismatch are informational only.
 * - Other NOT_EVALUATED outcomes (blocked request, missing extract, soft status not run)
 *   still fail the scenario for backward-compatible chain behaviour.
 */
export function scenarioFailureMessage(outcomes: CriterionOutcome[]): string | null {
  const blocking = outcomes.filter((outcome) => {
    if (outcome.status === 'FAIL') return true;
    if (outcome.status !== 'NOT_EVALUATED') return false;
    return !String(outcome.reason || '').includes('body assertion was not evaluated');
  });
  if (blocking.length === 0) return null;
  return blocking.map((outcome) => formatCriterionFailure(outcome)).join('\n\n');
}

export function assertCriterion(spec: CriterionSpec, ctx: CriterionContext): CriterionOutcome {
  const outcome = evaluateCriterion(spec, ctx);
  if (outcome.status !== 'PASS') {
    throw new Error(formatCriterionFailure(outcome));
  }
  return outcome;
}

function check(
  spec: CriterionSpec,
  ctx: CriterionContext,
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
): CriterionOutcome {
  switch (spec.type) {
    case 'field_exists':
      return fieldExists(spec, ctx, base);
    case 'field_equals':
      return fieldEquals(spec, ctx, base);
    case 'type_check':
      return typeCheck(spec, ctx, base);
    case 'non_empty':
      return nonEmpty(spec, ctx, base);
    case 'array_contains':
      return arrayMatch(spec, ctx, base, 'contains');
    case 'array_some':
      return arrayMatch(spec, ctx, base, 'some');
    case 'array_every':
      return arrayMatch(spec, ctx, base, 'every');
    case 'request_response_eq':
      return requestResponseEq(spec, ctx, base);
    case 'response_header':
      return responseHeader(spec, ctx, base);
    case 'response_time':
      return responseTime(spec, ctx, base);
    case 'schema':
      return schemaCheck(spec, ctx, base);
    default:
      return fail(base, spec.type, 'Desteklenmiyor', `Assertion tipi desteklenmiyor: ${spec.type}`);
  }
}

function fieldExists(
  spec: CriterionSpec,
  ctx: CriterionContext,
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
): CriterionOutcome {
  const located = locate(ctx.json, spec.path || '$');
  if (!located.keyPresent) {
    return fail(base, 'Alan mevcut', 'Alan bulunamadı', 'Alan yanıtta yok.');
  }
  if (located.value === null) {
    return fail(base, 'Alan mevcut', 'null', 'Alan var ancak değeri null. Null, mevcut değer sayılmaz.');
  }
  return pass(base, 'Alan mevcut', 'Alan mevcut');
}

function fieldEquals(
  spec: CriterionSpec,
  ctx: CriterionContext,
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
): CriterionOutcome {
  const located = locate(ctx.json, spec.path || '$');
  if (!located.keyPresent) {
    return fail(base, show(spec.expected), 'Alan bulunamadı');
  }
  if (!strictEqual(located.value, spec.expected)) {
    return fail(
      base,
      show(spec.expected),
      show(located.value),
      `Tip güvenli karşılaştırma başarısız (${jsonType(located.value)} ≠ ${jsonType(spec.expected)}).`,
    );
  }
  return pass(base, show(spec.expected), show(located.value));
}

function typeCheck(
  spec: CriterionSpec,
  ctx: CriterionContext,
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
): CriterionOutcome {
  const expectedType = String(spec.operator || spec.expected || '').toLowerCase();
  const located = locate(ctx.json, spec.path || '$');
  if (!located.keyPresent) {
    return fail(base, expectedType, 'Alan bulunamadı');
  }
  const actualType = jsonType(located.value);
  const ok =
    expectedType === 'integer'
      ? typeof located.value === 'number' && Number.isInteger(located.value)
      : actualType === expectedType;
  if (!ok) {
    return fail(base, expectedType, actualType, 'Tip eşleşmedi.');
  }
  return pass(base, expectedType, actualType);
}

function nonEmpty(
  spec: CriterionSpec,
  ctx: CriterionContext,
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
): CriterionOutcome {
  const located = locate(ctx.json, spec.path || '$');
  if (!located.keyPresent || located.value === undefined) {
    return fail(base, 'Boş değil', 'Alan bulunamadı');
  }
  const value = located.value;
  if (typeof value === 'string') {
    return value.length > 0
      ? pass(base, 'Boş değil', `Uzunluk ${value.length}`)
      : fail(base, 'Boş değil', 'Boş metin');
  }
  if (Array.isArray(value)) {
    return value.length > 0
      ? pass(base, 'Boş değil', `${value.length} eleman`)
      : fail(base, 'Boş değil', 'Boş dizi');
  }
  if (value && typeof value === 'object') {
    const size = Object.keys(value as object).length;
    return size > 0 ? pass(base, 'Boş değil', `${size} alan`) : fail(base, 'Boş değil', 'Boş nesne');
  }
  return fail(base, 'Boş değil', show(value), 'Bu tip için boşluk kontrolü uygulanamaz.');
}

function arrayMatch(
  spec: CriterionSpec,
  ctx: CriterionContext,
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
  mode: 'contains' | 'some' | 'every',
): CriterionOutcome {
  const located = locate(ctx.json, spec.path || '$');
  if (!located.keyPresent || !Array.isArray(located.value)) {
    return fail(base, mode, located.keyPresent ? jsonType(located.value) : 'Alan bulunamadı', 'Değer bir dizi değil.');
  }
  const items = located.value;
  if (mode === 'every' && items.length === 0) {
    return fail(base, 'Bütün elemanlar koşulu sağlar', 'Boş dizi', 'Boş dizi every koşulunu sağlamaz.');
  }
  const hits = items.filter((item) => elementMatches(item, spec.expected));
  if (mode === 'contains' || mode === 'some') {
    return hits.length > 0
      ? pass(base, show(spec.expected), `${hits.length} eşleşme`)
      : fail(base, show(spec.expected), 'Eşleşen eleman yok');
  }
  return hits.length === items.length
    ? pass(base, show(spec.expected), `${items.length} elemanın tamamı eşleşti`)
    : fail(base, show(spec.expected), `${hits.length}/${items.length} eleman eşleşti`);
}

function requestResponseEq(
  spec: CriterionSpec,
  ctx: CriterionContext,
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
): CriterionOutcome {
  const requestField = requestFieldName(spec.expected);
  const responseLocated = locate(ctx.json, spec.path || '$');
  const requestValue = lookupRequest(requestField, ctx);
  if (!responseLocated.keyPresent) {
    return fail(base, `request.${requestField}`, 'Alan bulunamadı');
  }
  if (requestValue === undefined) {
    return fail(base, `request.${requestField}`, show(responseLocated.value), 'Gönderilen istekte alan yok.');
  }
  if (!strictEqual(responseLocated.value, requestValue)) {
    return fail(base, show(requestValue), show(responseLocated.value), 'Response değeri gönderilen request değeriyle aynı değil.');
  }
  return pass(base, show(requestValue), show(responseLocated.value));
}

function responseHeader(
  spec: CriterionSpec,
  ctx: CriterionContext,
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
): CriterionOutcome {
  const name = spec.path || '';
  const headers = ctx.headers || {};
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name.toLowerCase());
  const actual = key ? String(headers[key]) : '';
  const expected = spec.expected == null ? '' : String(spec.expected);
  const op = (spec.operator || 'eq').toLowerCase();
  const ok =
    op === 'contains'
      ? actual.toLowerCase().includes(expected.toLowerCase())
      : actual === expected;
  if (!ok) {
    return fail(base, expected || '(boş)', actual ? show(actual) : 'Header yok');
  }
  return pass(base, expected, show(actual));
}

function responseTime(
  spec: CriterionSpec,
  ctx: CriterionContext,
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
): CriterionOutcome {
  if (ctx.elapsedMs == null || Number.isNaN(ctx.elapsedMs)) {
    return fail(base, `${spec.expected} ms`, 'Ölçülemedi', 'HTTP süresi ölçülemedi.');
  }
  const limit = Number(spec.expected);
  const op = (spec.operator || 'lt').toLowerCase();
  const ok = op === 'lte' ? ctx.elapsedMs <= limit : ctx.elapsedMs < limit;
  if (!ok) {
    return fail(base, `${op} ${limit} ms`, `${ctx.elapsedMs} ms`);
  }
  return pass(base, `${op} ${limit} ms`, `${ctx.elapsedMs} ms`);
}

function schemaCheck(
  spec: CriterionSpec,
  ctx: CriterionContext,
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
): CriterionOutcome {
  const schema = spec.expected;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return fail(base, 'Kısmi şema', 'Şema nesnesi değil');
  }
  const record = schema as Record<string, unknown>;
  const extra = Object.keys(record).filter((key) => !SCHEMA_ROOT_KEYS.has(key));
  if (extra.length > 0) {
    return fail(
      base,
      'Kısmi şema (type, required, properties.type)',
      extra.join(', '),
      'Desteklenmeyen şema anahtarı var. Bu kontrol tam JSON Schema değildir.',
    );
  }
  const body = spec.path && spec.path !== '$' ? locate(ctx.json, spec.path).value : ctx.json;
  if (record.type === 'object' && (body === null || typeof body !== 'object' || Array.isArray(body))) {
    return fail(base, 'Kısmi şema: object', jsonType(body));
  }
  if (record.type === 'array' && !Array.isArray(body)) {
    return fail(base, 'Kısmi şema: array', jsonType(body));
  }
  const required = Array.isArray(record.required) ? record.required : [];
  for (const key of required) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || !(String(key) in (body as object))) {
      return fail(base, `Kısmi şema: required ${String(key)}`, 'Alan bulunamadı', `Eksik zorunlu alan "${String(key)}".`);
    }
  }
  const properties = record.properties;
  if (properties && typeof properties === 'object' && !Array.isArray(properties) && body && typeof body === 'object' && !Array.isArray(body)) {
    for (const [key, rule] of Object.entries(properties as Record<string, unknown>)) {
      if (!rule || typeof rule !== 'object') continue;
      const ruleKeys = Object.keys(rule as object).filter((item) => item !== 'type');
      if (ruleKeys.length > 0) {
        return fail(base, 'Kısmi şema', ruleKeys.join(', '), 'properties içinde yalnızca type desteklenir.');
      }
      if (!(key in (body as object))) continue;
      const expectedType = String((rule as { type?: string }).type || '');
      const actual = (body as Record<string, unknown>)[key];
      if (expectedType && jsonType(actual) !== expectedType) {
        return fail(base, `${key}: ${expectedType}`, `${key}: ${jsonType(actual)}`);
      }
    }
  }
  return pass(base, 'Kısmi şema (type, required, properties.type)', 'Kısmi şema geçti');
}

function elementMatches(item: unknown, expected: unknown): boolean {
  if (typeof expected === 'string' && expected.includes('=') && !expected.startsWith('request.')) {
    const index = expected.indexOf('=');
    const field = expected.slice(0, index);
    const raw = expected.slice(index + 1);
    const actual = getByJsonPath(item, field.startsWith('$.') ? field : `$.${field}`);
    return strictEqual(actual, coerceLiteral(raw));
  }
  return strictEqual(item, expected);
}

function requestFieldName(expected: unknown): string {
  const text = String(expected ?? '');
  return text.replace(/^request\.?/, '');
}

function lookupRequest(field: string, ctx: CriterionContext): unknown {
  const path = field.startsWith('$.') ? field : `$.${field}`;
  if (ctx.requestJson !== undefined && ctx.requestJson !== null) {
    const located = locate(ctx.requestJson, path);
    if (located.keyPresent) return located.value;
  }
  if (ctx.requestQuery && Object.prototype.hasOwnProperty.call(ctx.requestQuery, field)) {
    return ctx.requestQuery[field];
  }
  return undefined;
}

/**
 * Supported path subset (aligned with BE JsonPathSupport / AssertionPlanValidator):
 * $, $.a.b, $.items[0], $.items[0].category, $['customer-name']
 */
export function tokenizeJsonPath(path: string): string[] | null {
  if (!path || path === '$') return [];
  if (!path.startsWith('$')) return null;
  const tokens: string[] = [];
  let i = 1;
  while (i < path.length) {
    const ch = path[i];
    if (ch === '.') {
      i += 1;
      const start = i;
      while (i < path.length && /[A-Za-z0-9_]/.test(path[i]!)) i += 1;
      if (i === start) return null;
      tokens.push(path.slice(start, i));
      continue;
    }
    if (ch === '[') {
      i += 1;
      if (path[i] === "'") {
        i += 1;
        const start = i;
        while (i < path.length && path[i] !== "'") i += 1;
        if (path[i] !== "'") return null;
        tokens.push(path.slice(start, i));
        i += 1;
        if (path[i] !== ']') return null;
        i += 1;
        continue;
      }
      const start = i;
      while (i < path.length && /\d/.test(path[i]!)) i += 1;
      if (i === start || path[i] !== ']') return null;
      tokens.push(path.slice(start, i));
      i += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

export function locate(root: unknown, path: string): { keyPresent: boolean; value: unknown } {
  if (!path || path === '$') return { keyPresent: root !== undefined, value: root };
  const parts = tokenizeJsonPath(path);
  if (!parts) return { keyPresent: false, value: undefined };
  let current: any = root;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (current == null || (typeof current !== 'object' && !Array.isArray(current))) {
      return { keyPresent: false, value: undefined };
    }
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(part)) return { keyPresent: false, value: undefined };
      const index = Number(part);
      if (index < 0 || index >= current.length) return { keyPresent: false, value: undefined };
      current = current[index];
    } else if (!Object.prototype.hasOwnProperty.call(current, part)) {
      return { keyPresent: false, value: undefined };
    } else {
      current = current[part];
    }
    if (i === parts.length - 1) return { keyPresent: true, value: current };
  }
  return { keyPresent: false, value: undefined };
}

export function getByJsonPath(root: unknown, path: string): unknown {
  return locate(root, path).value;
}

function strictEqual(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  return false;
}

function coerceLiteral(raw: string): unknown {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value === undefined) return 'missing';
  return typeof value === 'object' ? 'object' : typeof value;
}

function labelExpected(spec: CriterionSpec): string {
  if (spec.type === 'schema') return 'Kısmi şema (type, required, properties.type)';
  return show(spec.expected);
}

function pass(
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
  expected: string,
  actual: string,
): CriterionOutcome {
  return { ...base, status: 'PASS', expected, actual };
}

function notEvaluated(
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
  expected: string,
  actual: string,
  reason?: string,
): CriterionOutcome {
  return { ...base, status: 'NOT_EVALUATED', expected, actual, reason };
}

function fail(
  base: Pick<CriterionOutcome, 'id' | 'description' | 'type' | 'path'>,
  expected: string,
  actual: string,
  reason?: string,
): CriterionOutcome {
  return { ...base, status: 'FAIL', expected, actual, reason };
}

function show(value: unknown): string {
  if (value === undefined) return 'Alan bulunamadı';
  const safe = redact(value);
  const text = typeof safe === 'string' ? safe : JSON.stringify(safe);
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(child);
    }
    return out;
  }
  if (typeof value === 'string' && /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./.test(value)) {
    return '[REDACTED]';
  }
  return value;
}
