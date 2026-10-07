import { randomInt, randomUUID } from 'crypto';

/**
 * Values generated while a test runs — never sampled when a test is written or migrated.
 * Every generator returns a string, so results can be kept in `scenarioVars` for later steps
 * of the same scenario.
 *
 * The same file is shipped in every runner (UI, API, mobile); keep the copies identical.
 */

export type TimestampFormat = 'epochMillis' | 'epochSeconds' | 'iso' | 'isoDate';

export interface TimestampOptions {
  /** Default `epochMillis`. `iso` is UTC (`toISOString`), `isoDate` is the local `yyyy-MM-dd`. */
  format?: TimestampFormat;
  /** Local time with tokens `yyyy yy MM dd HH mm ss SSS`; other letters are rejected. */
  pattern?: string;
}

export type NumericOptions = { length: number } | { min?: number; max: number };

export interface AlphanumericOptions {
  length: number;
  /** `alphanumeric` (default): A–Z, a–z, 0–9. `alpha`: A–Z, a–z. */
  charset?: 'alphanumeric' | 'alpha';
}

export interface PatternOptions {
  /** Case of the letters produced for `?` (default `upper`). */
  letterCase?: 'upper' | 'lower';
  /** Fill `#` from the trailing digits of the current time first (legacy `uniqueFromPattern`). */
  clockDigits?: boolean;
}

export type FakerKind = 'firstName' | 'lastName' | 'fullName' | 'email' | 'username' | 'phoneNumber';

export const FAKER_KINDS: readonly FakerKind[] = Object.freeze([
  'firstName',
  'lastName',
  'fullName',
  'email',
  'username',
  'phoneNumber',
]);

const DIGITS = '0123456789';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const MAX_LENGTH = 1000;
const MAX_RANGE = 2 ** 48;

const FIRST_NAMES = [
  'Alex', 'Ayla', 'Ben', 'Can', 'Clara', 'Deniz', 'Elif', 'Emma', 'Eren', 'Hugo',
  'Ida', 'Jonas', 'Kerem', 'Lara', 'Leo', 'Lina', 'Maya', 'Mert', 'Nina', 'Omar',
  'Selin', 'Sofia', 'Theo', 'Yusuf', 'Zeynep',
];
const LAST_NAMES = [
  'Aksoy', 'Baker', 'Brown', 'Celik', 'Demir', 'Evans', 'Fischer', 'Garcia', 'Kaya', 'Keller',
  'Lopez', 'Martin', 'Meyer', 'Novak', 'Ozturk', 'Peters', 'Sahin', 'Silva', 'Taylor', 'Yildiz',
];

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

function pickOne<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}

function requireLength(name: string, length: unknown): number {
  if (typeof length !== 'number' || !Number.isInteger(length) || length < 1 || length > MAX_LENGTH) {
    throw new Error(`runtimeData.${name} requires an integer length between 1 and ${MAX_LENGTH}`);
  }
  return length;
}

function repeat(length: number, chars: string): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += pick(chars);
  }
  return out;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function formatLocal(date: Date, pattern: string): string {
  const tokens: Record<string, string> = {
    yyyy: String(date.getFullYear()),
    yy: pad(date.getFullYear() % 100, 2),
    MM: pad(date.getMonth() + 1, 2),
    dd: pad(date.getDate(), 2),
    HH: pad(date.getHours(), 2),
    mm: pad(date.getMinutes(), 2),
    ss: pad(date.getSeconds(), 2),
    SSS: pad(date.getMilliseconds(), 3),
  };
  return pattern.replace(/([A-Za-z])\1*/g, (token) => {
    const value = tokens[token];
    if (value === undefined) {
      throw new Error(`runtimeData.timestamp does not support the pattern token "${token}"`);
    }
    return value;
  });
}

function uuid(): string {
  return randomUUID();
}

function timestamp(options: TimestampOptions = {}): string {
  const now = new Date();
  if (options.pattern !== undefined) {
    if (options.format !== undefined) {
      throw new Error('runtimeData.timestamp accepts either format or pattern, not both');
    }
    if (!options.pattern) {
      throw new Error('runtimeData.timestamp requires a non-empty pattern');
    }
    return formatLocal(now, options.pattern);
  }
  switch (options.format ?? 'epochMillis') {
    case 'epochMillis':
      return String(now.getTime());
    case 'epochSeconds':
      return String(Math.floor(now.getTime() / 1000));
    case 'iso':
      return now.toISOString();
    case 'isoDate':
      return formatLocal(now, 'yyyy-MM-dd');
    default:
      throw new Error(`runtimeData.timestamp does not support the format "${String(options.format)}"`);
  }
}

function numeric(options: NumericOptions): string {
  if (options && 'length' in options) {
    return repeat(requireLength('numeric', options.length), DIGITS);
  }
  const min = options?.min ?? 0;
  const max = options?.max;
  if (!Number.isSafeInteger(min) || typeof max !== 'number' || !Number.isSafeInteger(max) || max < min
      || max - min + 1 > MAX_RANGE) {
    throw new Error('runtimeData.numeric requires { length } or integer { min, max } with min <= max');
  }
  return String(min + randomInt(max - min + 1));
}

function alphanumeric(options: AlphanumericOptions): string {
  const length = requireLength('alphanumeric', options?.length);
  const charset = options.charset ?? 'alphanumeric';
  if (charset !== 'alphanumeric' && charset !== 'alpha') {
    throw new Error(`runtimeData.alphanumeric does not support the charset "${String(charset)}"`);
  }
  return repeat(length, charset === 'alpha' ? UPPER + LOWER : UPPER + LOWER + DIGITS);
}

/** `#` → digit, `?` → letter; every other character is kept as-is. */
function pattern(template: string, options: PatternOptions = {}): string {
  if (typeof template !== 'string' || !template) {
    throw new Error('runtimeData.pattern requires a non-empty pattern');
  }
  const letters = options.letterCase === 'lower' ? LOWER : UPPER;
  const clock = options.clockDigits ? Date.now().toString() : '';
  let clockIndex = clock.length;
  return template.replace(/[#?]/g, (token) => {
    if (token === '?') {
      return pick(letters);
    }
    clockIndex -= 1;
    return clockIndex >= 0 ? clock[clockIndex] : pick(DIGITS);
  });
}

function faker(kind: FakerKind): string {
  switch (kind) {
    case 'firstName':
      return pickOne(FIRST_NAMES);
    case 'lastName':
      return pickOne(LAST_NAMES);
    case 'fullName':
      return `${pickOne(FIRST_NAMES)} ${pickOne(LAST_NAMES)}`;
    case 'email':
      return `${pickOne(FIRST_NAMES)}.${pickOne(LAST_NAMES)}.${repeat(6, LOWER + DIGITS)}@example.com`.toLowerCase();
    case 'username':
      return `${pickOne(FIRST_NAMES)}${pickOne(LAST_NAMES)}${repeat(4, DIGITS)}`.toLowerCase();
    case 'phoneNumber':
      return pattern('555#######');
    default:
      throw new Error(`runtimeData.faker does not support "${String(kind)}"; supported: ${FAKER_KINDS.join(', ')}`);
  }
}

export const runtimeData = Object.freeze({ uuid, timestamp, numeric, alphanumeric, pattern, faker });
