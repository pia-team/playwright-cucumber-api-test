/** Narrow optional API/env values for strict TypeScript step files. */
export function requireNonEmptyString(
  value: string | undefined,
  label: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${label} is required but was missing or empty`);
  }
  return trimmed;
}

export function requireResponseId(
  value: string | undefined,
  resourceLabel = 'resource',
): string {
  return requireNonEmptyString(value, `${resourceLabel} id from response`);
}
