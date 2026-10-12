const NAMED = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

export const SAFE_JSON_PATH = /^\$(\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\])+$/;
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
  }
  return out;
}
