import { runtimeData, type FakerKind, type TimestampFormat } from './runtimeData';

const FAKER_KINDS = new Set<string>([
  'firstName',
  'lastName',
  'fullName',
  'email',
  'username',
  'phoneNumber',
]);

const TIMESTAMP_FORMATS = new Set<string>([
  'epochMillis',
  'epochSeconds',
  'iso',
  'isoDate',
]);

/**
 * Resolve a compact runtime-generate spec into a string value via existing runtimeData helpers.
 * Specs: email | firstName | … | uuid | timestamp | timestamp:iso |
 * numeric:6 | alphanumeric:10 | alphanumeric:10:alpha | pattern:TEST######
 */
export function generateRuntimeValue(spec: string): string {
  const raw = (spec || '').trim();
  if (!raw) {
    throw new Error('Runtime generate spec must not be empty');
  }

  if (raw.startsWith('pattern:')) {
    const pattern = raw.slice('pattern:'.length);
    if (!pattern) {
      throw new Error('pattern: requires a non-empty pattern (e.g. pattern:TEST######)');
    }
    if (!pattern.includes('#') && !pattern.includes('?')) {
      throw new Error('pattern: requires at least one # or ? token (e.g. pattern:TEST######)');
    }
    return runtimeData.pattern(pattern, { clockDigits: true });
  }

  if (raw.startsWith('numeric:')) {
    const length = Number(raw.slice('numeric:'.length));
    if (!Number.isInteger(length) || length < 1) {
      throw new Error('numeric: requires a positive integer length (e.g. numeric:6)');
    }
    return runtimeData.numeric({ length });
  }

  if (raw.startsWith('alphanumeric:')) {
    const rest = raw.slice('alphanumeric:'.length);
    const [lengthPart, charsetPart] = rest.split(':');
    const length = Number(lengthPart);
    if (!Number.isInteger(length) || length < 1) {
      throw new Error('alphanumeric: requires a positive integer length (e.g. alphanumeric:10)');
    }
    if (charsetPart !== undefined && charsetPart !== '' && charsetPart !== 'alpha' && charsetPart !== 'alphanumeric') {
      throw new Error(
        `alphanumeric charset must be "alphanumeric" or "alpha" (got "${charsetPart}")`,
      );
    }
    const charset = charsetPart === 'alpha' ? 'alpha' : 'alphanumeric';
    return runtimeData.alphanumeric({ length, charset });
  }

  if (raw === 'timestamp') {
    return runtimeData.timestamp();
  }
  if (raw.startsWith('timestamp:')) {
    const format = raw.slice('timestamp:'.length);
    if (!TIMESTAMP_FORMATS.has(format)) {
      throw new Error(
        `timestamp format must be one of ${[...TIMESTAMP_FORMATS].join(', ')} (got "${format}")`,
      );
    }
    return runtimeData.timestamp({ format: format as TimestampFormat });
  }

  if (raw === 'uuid') {
    return runtimeData.uuid();
  }

  if (FAKER_KINDS.has(raw)) {
    return runtimeData.faker(raw as FakerKind);
  }

  throw new Error(
    `Unsupported runtime generate spec "${raw}". Use email|firstName|lastName|fullName|username|phoneNumber|uuid|timestamp|numeric:N|alphanumeric:N|pattern:…`,
  );
}
