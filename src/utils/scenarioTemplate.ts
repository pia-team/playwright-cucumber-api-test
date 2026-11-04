const NAMED = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

/**
 * User-facing extract paths are relative (`order.id`).
 * Legacy absolute JSONPath (`$.order.id`, `$[0].order.id`) remains accepted.
 */
export const SAFE_JSON_PATH =
  /^(?:\$(\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\])+|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;

export const SAFE_VARIABLE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function placeholderNames(input: string): string[] {
  return [...input.matchAll(NAMED)].map((match) => match[1]);
}

export function missingPlaceholders(input: string, vars?: Record<string, string>): string[] {
  const missing = new Set<string>();
  for (const name of placeholderNames(input)) {
    const value = vars?.[name];
    if (value == null || value === '') missing.add(name);
  }
  return [...missing];
}

export function hasInvalidPlaceholder(input: string): boolean {
  const stripped = input.replace(NAMED, '');
  return stripped.includes('{{') || stripped.includes('}}');
}

/** Replaces {{name}} only. Names that are not identifiers are left in place and rejected separately. */
export function substituteTemplates(
  input: string,
  vars: Record<string, string> | undefined,
  encode: boolean,
): string {
  return input.replace(NAMED, (full, name: string) => {
    const value = vars?.[name];
    if (value == null || value === '') return full;
    return encode ? encodeURIComponent(value) : escapeInserted(value);
  });
}

function escapeInserted(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

export function redactStoredValues(text: string, values: string[]): string {
  let out = text;
  const sorted = [...values]
    .filter((value) => value && value.length >= 3)
    .sort((left, right) => right.length - left.length);
  for (const value of sorted) {
    out = out.split(value).join('[REDACTED]');
    const encoded = encodeURIComponent(value);
    if (encoded !== value) {
      out = out.split(encoded).join('[REDACTED]');
    }
  }
  return out;
}

/** Split `order.id` / `$.order.id` / `$[0].order.id` into property/index segments. */
export function jsonPathSegments(pathExpr: string): string[] {
  const raw = (pathExpr || '').trim();
  if (!raw || raw === '$') return [];
  let expr = raw;
  if (expr.startsWith('$.')) expr = expr.slice(2);
  else if (expr.startsWith('$')) expr = expr.slice(1);
  if (expr.startsWith('.')) expr = expr.slice(1);
  return expr.split(/\.|\[|\]/).filter(Boolean);
}

function readAlong(root: unknown, segments: string[]): unknown {
  let cur: any = root;
  for (const part of segments) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function isSuccessItem(item: unknown): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const status = (item as { status?: unknown }).status;
  return String(status ?? '').toUpperCase() === 'SUCCESS';
}

/**
 * Resolve a response path for extract/assert.
 * - `order.id` works on a single object body
 * - On an array body (1..N items), walks items — SUCCESS first, then others — until a value is found
 * - Explicit `$[0].order.id` still works without fallback
 */
export function resolveJsonPath(root: unknown, pathExpr: string): unknown {
  const path = (pathExpr || '').trim();
  if (!path) return undefined;
  if (path === '$') return root;
  if (!SAFE_JSON_PATH.test(path)) return undefined;

  const segments = jsonPathSegments(path);
  const direct = readAlong(root, segments);
  if (direct !== undefined && direct !== null) {
    return direct;
  }

  // Relative paths (no leading $): if body is a batch array, search each element.
  const relative = !path.startsWith('$');
  if (relative && Array.isArray(root) && root.length > 0) {
    const successFirst = [
      ...root.filter(isSuccessItem),
      ...root.filter((item) => !isSuccessItem(item)),
    ];
    for (const item of successFirst) {
      const value = readAlong(item, segments);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }

  return undefined;
}

/** @deprecated Prefer {@link resolveJsonPath} — kept as a thin alias for call sites. */
export function getByJsonPath(root: unknown, pathExpr: string): unknown {
  return resolveJsonPath(root, pathExpr);
}
