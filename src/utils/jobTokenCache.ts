/**
 * Job-scoped encrypted token cache (AUTH-SUITE-1) with expiration + proactive renewal (AUTH-SUITE-2).
 *
 * Coordination: AES-256-GCM under COTESTER_JOB_AUTH_DIR + exclusive mkdir lock.
 * Key from COTESTER_JOB_AUTH_KEY only. Never log tokens or the key.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { loadRuntimeCredentialsFile } from './runtimeCredentials';

/**
 * Unknown lifetime: short conservative reuse only.
 * Rationale: without IdP expiry we must not claim ~1h validity; AUTH-SUITE-3 covers surprise 401.
 */
export const CONSERVATIVE_FALLBACK_TTL_MS = 5 * 60 * 1000;
/** @deprecated Use CONSERVATIVE_FALLBACK_TTL_MS — kept as alias for AUTH-SUITE-1 call sites. */
export const DEFAULT_TTL_MS = CONSERVATIVE_FALLBACK_TTL_MS;
export const MAX_TTL_MS = 24 * 60 * 60 * 1000;
export const MIN_VALID_EXPIRES_IN_SEC = 1;
export const MAX_EXPIRES_IN_SEC = Math.floor(MAX_TTL_MS / 1000);
/** Short-lived tokens: no proactive margin (renew only when expired) to avoid refresh loops. */
export const NO_PROACTIVE_RENEWAL_LIFETIME_MS = 45_000;
function lockWaitMs(): number {
  const raw = Number(process.env.COTESTER_JOB_AUTH_LOCK_WAIT_MS);
  if (Number.isFinite(raw) && raw >= 50 && raw <= 120_000) {
    return Math.floor(raw);
  }
  return 30_000;
}

const LOCK_POLL_MS = 40;

export type ExpirationSource = 'expires_in' | 'expires_at' | 'jwt_exp' | 'fallback';

/** Non-secret recipe to re-acquire a managed token (AUTH-SUITE-3 recovery). */
export type TokenAcquisitionRecipe = {
  method: string;
  path: string;
  body: string | null;
  contentType: string | null;
  authMode: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  resolveCredentialBody: boolean;
  extracts: Array<{ name: string; path: string }>;
  expectedStatus: number;
};

export type CachedTokenEntry = {
  values: Record<string, string>;
  expectedStatus: number;
  acquiredAt: number;
  /** Absolute epoch ms. */
  expiresAt: number;
  generation: number;
  expirationSource?: ExpirationSource;
  /** Nominal lifetime used for adaptive safety margin. */
  lifetimeMs?: number;
  /** Present for AUTH-SUITE-3 recovery re-acquisition. */
  recipe?: TokenAcquisitionRecipe;
};

export type ExpirationResolution = {
  expiresAt: number;
  lifetimeMs: number;
  source: ExpirationSource;
};

export type AcquireResult =
  | { kind: 'hit'; entry: CachedTokenEntry }
  | {
      kind: 'acquire';
      cacheKey: string;
      lockPath: string;
      previousGeneration: number;
      renewing: boolean;
    }
  | { kind: 'disabled' };

export type StoreResult = { stored: boolean; reason?: 'stale_generation' | 'disabled' | 'empty' | 'invalid_meta' };

function authDir(): string | null {
  const dir = process.env.COTESTER_JOB_AUTH_DIR?.trim();
  return dir || null;
}

function authKey(): Buffer | null {
  const raw = process.env.COTESTER_JOB_AUTH_KEY?.trim();
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, 'base64');
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function jobAuthCacheEnabled(): boolean {
  return Boolean(authDir() && authKey() && process.env.COTESTER_RUN_JOB_ID?.trim());
}

/** Credential identity without putting secret values into the cache key string itself. */
export function credentialIdentityDigest(): string {
  const key = authKey();
  const file = loadRuntimeCredentialsFile();
  const h = crypto.createHmac('sha256', key || Buffer.alloc(32));
  if (!file) {
    h.update('cred:none');
    return h.digest('hex').slice(0, 32);
  }
  h.update(`type:${file.type}\n`);
  const secrets = file.secrets || {};
  for (const name of Object.keys(secrets).sort()) {
    h.update(`${name}=`);
    h.update(secrets[name] ?? '');
    h.update('\n');
  }
  return h.digest('hex').slice(0, 32);
}

export function buildRuntimeCacheKey(fingerprint: string): string {
  const jobId = process.env.COTESTER_RUN_JOB_ID?.trim() || 'no-job';
  const project =
    process.env.API_PROJECT_KEY?.trim()
    || process.env.COTESTER_PROJECT_KEY?.trim()
    || 'no-project';
  const baseUrl = (process.env.COTESTER_API_BASE_URL || process.env.BASE_URL || '').trim();
  const cred = credentialIdentityDigest();
  const material = [jobId, project, cred, baseUrl, fingerprint.trim()].join('|');
  return crypto.createHash('sha256').update(material, 'utf8').digest('hex');
}

/** Reject non-hex cache keys to prevent path traversal / odd filenames. */
function assertSafeCacheKey(cacheKey: string): string {
  if (!/^[a-f0-9]{64}$/.test(cacheKey)) {
    throw new Error('Invalid token cache key (fail-closed).');
  }
  return cacheKey;
}

function entryPath(cacheKey: string): string {
  const safe = assertSafeCacheKey(cacheKey);
  const dir = authDir()!;
  const file = path.resolve(dir, 'tokens', `${safe}.bin`);
  if (!file.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error('Token cache path escaped job auth dir (fail-closed).');
  }
  return file;
}

function lockPathFor(cacheKey: string): string {
  const safe = assertSafeCacheKey(cacheKey);
  const dir = authDir()!;
  const lock = path.resolve(dir, 'locks', safe);
  if (!lock.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error('Token lock path escaped job auth dir (fail-closed).');
  }
  return lock;
}

/** Strip accidental secret-looking header values from recipes before persistence. */
export function sanitizeAcquisitionRecipe(recipe: TokenAcquisitionRecipe): TokenAcquisitionRecipe {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(recipe.headers || {})) {
    if (/^(authorization|proxy-authorization|cookie|set-cookie)$/i.test(k)) {
      continue;
    }
    if (/(password|secret|token|api[_-]?key)/i.test(String(v || ''))) {
      continue;
    }
    headers[k] = v;
  }
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(recipe.query || {})) {
    if (/(password|secret|token|api[_-]?key)/i.test(k) || /(password|secret|token)/i.test(String(v || ''))) {
      continue;
    }
    query[k] = v;
  }
  // Body templates may contain {{password}} placeholders — keep placeholders only patterns.
  let body = recipe.body;
  if (body && !/\{\{[A-Za-z_][A-Za-z0-9_]*\}\}/.test(body)) {
    if (/(password|client_secret|access_token)\s*[=:]/i.test(body) && !/\{\{/.test(body)) {
      body = null;
    }
  }
  return {
    ...recipe,
    headers,
    query,
    body,
    extracts: (recipe.extracts || [])
      .filter((e) => e && e.name && e.path)
      .map((e) => ({ name: String(e.name), path: String(e.path) })),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encrypt(plain: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

function decrypt(blob: Buffer, key: Buffer): Buffer {
  if (blob.length < 28) {
    throw new Error('Token cache entry corrupt');
  }
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Adaptive safety margin before hard expiry.
 * - ≤45s lifetime: no proactive renewal (avoid refresh loops)
 * - ≤5m: up to 20% / 30s
 * - ≤60m: up to 10% / 120s
 * - longer: up to 5% / 300s
 */
export function safetyMarginMs(lifetimeMs: number): number {
  if (!Number.isFinite(lifetimeMs) || lifetimeMs <= 0) {
    return 0;
  }
  if (lifetimeMs <= NO_PROACTIVE_RENEWAL_LIFETIME_MS) {
    return 0;
  }
  if (lifetimeMs <= 5 * 60 * 1000) {
    return Math.min(30_000, Math.floor(lifetimeMs * 0.2));
  }
  if (lifetimeMs <= 60 * 60 * 1000) {
    return Math.min(120_000, Math.floor(lifetimeMs * 0.1));
  }
  return Math.min(300_000, Math.floor(lifetimeMs * 0.05));
}

export function entryLifetimeMs(entry: CachedTokenEntry): number {
  if (entry.lifetimeMs != null && Number.isFinite(entry.lifetimeMs) && entry.lifetimeMs > 0) {
    return entry.lifetimeMs;
  }
  const delta = entry.expiresAt - entry.acquiredAt;
  return Number.isFinite(delta) && delta > 0 ? delta : CONSERVATIVE_FALLBACK_TTL_MS;
}

/** True when token may still be reused (not expired and not inside proactive renewal window). */
export function isUsable(entry: CachedTokenEntry, now = Date.now()): boolean {
  if (!entry || typeof entry !== 'object') return false;
  if (!entry.values || typeof entry.values !== 'object') return false;
  if (!Number.isFinite(entry.expiresAt) || !Number.isFinite(entry.acquiredAt)) return false;
  if (Object.keys(entry.values).length === 0) return false;
  const margin = safetyMarginMs(entryLifetimeMs(entry));
  return entry.expiresAt - margin > now;
}

function parsePositiveSeconds(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < MIN_VALID_EXPIRES_IN_SEC || raw > MAX_EXPIRES_IN_SEC) return null;
    return Math.floor(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw.trim());
    if (!Number.isFinite(n) || n < MIN_VALID_EXPIRES_IN_SEC || n > MAX_EXPIRES_IN_SEC) return null;
    return Math.floor(n);
  }
  return null;
}

function parseExpiresAtMs(raw: unknown, acquiredAt: number): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // unix seconds vs ms
    const ms = raw < 1e12 ? Math.floor(raw * 1000) : Math.floor(raw);
    if (ms <= acquiredAt || ms - acquiredAt > MAX_TTL_MS) return null;
    return ms;
  }
  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return parseExpiresAtMs(Number(trimmed), acquiredAt);
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isFinite(parsed)) return null;
    if (parsed <= acquiredAt || parsed - acquiredAt > MAX_TTL_MS) return null;
    return parsed;
  }
  return null;
}

/** Decode JWT payload exp without verifying signature — scheduling hint only. */
export function jwtExpMs(token: string | null | undefined): number | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= 0) {
      return null;
    }
    const ms = Math.floor(payload.exp * 1000);
    if (ms > Date.now() + MAX_TTL_MS) return null;
    return ms;
  } catch {
    return null;
  }
}

/**
 * Resolve absolute expiry. Priority: expires_in → expires_at → JWT exp → conservative fallback.
 */
export function resolveExpiration(
  acquiredAt: number,
  body: unknown,
  tokenValue?: string | null,
): ExpirationResolution {
  const obj = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;

  const expiresIn = obj ? parsePositiveSeconds(obj.expires_in) : null;
  if (expiresIn != null) {
    const lifetimeMs = Math.min(expiresIn * 1000, MAX_TTL_MS);
    return {
      expiresAt: acquiredAt + lifetimeMs,
      lifetimeMs,
      source: 'expires_in',
    };
  }

  const expiresAtField = obj
    ? parseExpiresAtMs(obj.expires_at ?? obj.expiresAt, acquiredAt)
    : null;
  if (expiresAtField != null) {
    return {
      expiresAt: expiresAtField,
      lifetimeMs: expiresAtField - acquiredAt,
      source: 'expires_at',
    };
  }

  const jwtExp = jwtExpMs(tokenValue ?? null);
  if (jwtExp != null && jwtExp > acquiredAt) {
    const lifetimeMs = Math.min(jwtExp - acquiredAt, MAX_TTL_MS);
    if (lifetimeMs >= MIN_VALID_EXPIRES_IN_SEC * 1000) {
      return {
        expiresAt: acquiredAt + lifetimeMs,
        lifetimeMs,
        source: 'jwt_exp',
      };
    }
  }

  return {
    expiresAt: acquiredAt + CONSERVATIVE_FALLBACK_TTL_MS,
    lifetimeMs: CONSERVATIVE_FALLBACK_TTL_MS,
    source: 'fallback',
  };
}

/** Backward-compatible helper used by older call sites / tests. */
export function computeExpiresAt(acquiredAt: number, expiresInSeconds?: number | null): number {
  if (expiresInSeconds != null && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
    const sec = parsePositiveSeconds(expiresInSeconds);
    if (sec != null) {
      return acquiredAt + Math.min(sec * 1000, MAX_TTL_MS);
    }
  }
  return acquiredAt + CONSERVATIVE_FALLBACK_TTL_MS;
}

function readEntryRaw(cacheKey: string): CachedTokenEntry | null {
  const key = authKey();
  const dir = authDir();
  if (!key || !dir) return null;
  const file = entryPath(cacheKey);
  if (!fs.existsSync(file)) return null;
  try {
    const blob = fs.readFileSync(file);
    const json = decrypt(blob, key).toString('utf8');
    const parsed = JSON.parse(json) as CachedTokenEntry;
    if (!parsed || typeof parsed !== 'object' || !parsed.values) return null;
    return parsed;
  } catch {
    // Corrupt ciphertext: treat as absent for hit path (fail-closed — never return bad token).
    return null;
  }
}

function readUsableEntry(cacheKey: string): CachedTokenEntry | null {
  const raw = readEntryRaw(cacheKey);
  if (!raw || !isUsable(raw)) return null;
  return raw;
}

function atomicWrite(file: string, data: Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows
  }
}

/**
 * Single-flight acquire / renew: hit if usable; else exclusive lock for HTTP fetch.
 * Waiters poll until a usable entry appears (no unsafe orphan-lock deletion).
 */
export async function beginAcquisition(fingerprint: string): Promise<AcquireResult> {
  if (!jobAuthCacheEnabled()) {
    return { kind: 'disabled' };
  }
  const cacheKey = buildRuntimeCacheKey(fingerprint);
  const started = Date.now();
  const waitMs = lockWaitMs();
  while (Date.now() - started < waitMs) {
    const hit = readUsableEntry(cacheKey);
    if (hit) {
      return { kind: 'hit', entry: hit };
    }
    const lockPath = lockPathFor(cacheKey);
    try {
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
      fs.mkdirSync(lockPath);
      const again = readUsableEntry(cacheKey);
      if (again) {
        releaseLock(lockPath);
        return { kind: 'hit', entry: again };
      }
      const previous = readEntryRaw(cacheKey);
      const previousGeneration =
        previous && Number.isFinite(previous.generation) ? Math.max(0, Math.floor(previous.generation)) : 0;
      return {
        kind: 'acquire',
        cacheKey,
        lockPath,
        previousGeneration,
        renewing: previousGeneration > 0 || Boolean(previous),
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'EEXIST') {
        throw new Error(
          'Job token cache lock failed (fail-closed). Token was not reused or fetched.',
        );
      }
      await sleep(LOCK_POLL_MS);
    }
  }
  throw new Error(
    'Timed out waiting for shared token acquisition (fail-closed). Token was not fetched.',
  );
}

export function storeEntry(
  cacheKey: string,
  entry: CachedTokenEntry,
  lockPath?: string | null,
): StoreResult {
  const key = authKey();
  if (!key || !authDir()) {
    if (lockPath) releaseLock(lockPath);
    return { stored: false, reason: 'disabled' };
  }
  if (!entry?.values || Object.keys(entry.values).length === 0) {
    if (lockPath) releaseLock(lockPath);
    throw new Error('Refusing to cache empty token entry (fail-closed).');
  }
  if (!Number.isFinite(entry.acquiredAt) || !Number.isFinite(entry.expiresAt)) {
    if (lockPath) releaseLock(lockPath);
    throw new Error('Refusing to cache token entry without validity metadata (fail-closed).');
  }
  if (!Number.isFinite(entry.generation) || entry.generation < 1) {
    if (lockPath) releaseLock(lockPath);
    throw new Error('Refusing to cache token entry without generation (fail-closed).');
  }

  const existing = readEntryRaw(cacheKey);
  if (existing && Number.isFinite(existing.generation) && existing.generation > entry.generation) {
    if (lockPath) releaseLock(lockPath);
    return { stored: false, reason: 'stale_generation' };
  }

  const toStore: CachedTokenEntry = {
    ...entry,
    lifetimeMs: entry.lifetimeMs ?? entryLifetimeMs(entry),
  };
  const plain = Buffer.from(JSON.stringify(toStore), 'utf8');
  atomicWrite(entryPath(cacheKey), encrypt(plain, key));
  if (lockPath) releaseLock(lockPath);
  return { stored: true };
}

export function mergeStoreValue(
  cacheKey: string,
  varName: string,
  value: string,
  expectedStatus: number,
  expiration: ExpirationResolution | number,
  lockPath?: string | null,
  previousGeneration = 0,
  recipe?: TokenAcquisitionRecipe | null,
): StoreResult {
  if (!value || !String(value).trim()) {
    if (lockPath) releaseLock(lockPath);
    throw new Error('Refusing to cache empty access token (fail-closed).');
  }
  const existing = readEntryRaw(cacheKey);
  const acquiredAt = Date.now();
  const resolved: ExpirationResolution =
    typeof expiration === 'number'
      ? {
          expiresAt: expiration,
          lifetimeMs: Math.max(0, expiration - acquiredAt),
          source: 'fallback',
        }
      : expiration;

  // Same acquisition wave: keep generation; first write bumps from previousGeneration.
  let generation: number;
  if (existing && existing.generation > previousGeneration) {
    // Newer token already published — merge only if same generation wave, else stale.
    if (existing.generation > previousGeneration + 1) {
      if (lockPath) releaseLock(lockPath);
      return { stored: false, reason: 'stale_generation' };
    }
    generation = existing.generation;
  } else {
    generation = previousGeneration + 1;
  }

  const values = { ...(existing && existing.generation === generation ? existing.values : {}), [varName]: value };
  // Prefer tighter expiry if merging extracts from the same response wave.
  const expiresAt =
    existing && existing.generation === generation && existing.expiresAt < resolved.expiresAt
      ? existing.expiresAt
      : resolved.expiresAt;
  const lifetimeMs =
    existing && existing.generation === generation && existing.lifetimeMs
      ? existing.lifetimeMs
      : resolved.lifetimeMs;
  const nextRecipeRaw =
    recipe
    || (existing && existing.generation === generation ? existing.recipe : undefined)
    || existing?.recipe;
  const nextRecipe = nextRecipeRaw ? sanitizeAcquisitionRecipe(nextRecipeRaw) : undefined;

  return storeEntry(
    cacheKey,
    {
      values,
      expectedStatus,
      acquiredAt: existing && existing.generation === generation ? existing.acquiredAt : acquiredAt,
      expiresAt,
      lifetimeMs,
      expirationSource: resolved.source,
      generation,
      recipe: nextRecipe,
    },
    lockPath,
  );
}

/** Read raw entry (may be expired) for recovery / generation checks. */
export function peekRawEntry(fingerprint: string): CachedTokenEntry | null {
  if (!jobAuthCacheEnabled()) return null;
  return readEntryRaw(buildRuntimeCacheKey(fingerprint));
}

/** Mark a specific generation unusable without deleting newer generations. */
export function markGenerationUnusable(fingerprint: string, generation: number): boolean {
  if (!jobAuthCacheEnabled()) return false;
  const cacheKey = buildRuntimeCacheKey(fingerprint);
  const raw = readEntryRaw(cacheKey);
  if (!raw || raw.generation !== generation) return false;
  const result = storeEntry(cacheKey, {
    ...raw,
    expiresAt: Date.now() - 1,
  });
  return result.stored;
}

/**
 * AUTH-SUITE-3: prefer a newer usable generation; otherwise invalidate stale generation
 * and single-flight acquire/renew.
 */
export async function beginRecoveryAcquisition(
  fingerprint: string,
  staleGeneration: number,
): Promise<AcquireResult> {
  if (!jobAuthCacheEnabled()) {
    return { kind: 'disabled' };
  }
  const raw = peekRawEntry(fingerprint);
  if (raw && raw.generation > staleGeneration && isUsable(raw)) {
    return { kind: 'hit', entry: raw };
  }
  if (raw && raw.generation === staleGeneration) {
    markGenerationUnusable(fingerprint, staleGeneration);
  }
  return beginAcquisition(fingerprint);
}

export function releaseLock(lockPath: string | null | undefined): void {
  if (!lockPath) return;
  try {
    fs.rmSync(lockPath, { recursive: true, force: true });
  } catch {
    // best-effort — never delete locks we do not own via heuristics
  }
}

/** Test helper: force-write raw entry (bypasses generation guard when replacing). */
export function forceStoreEntryForTests(cacheKey: string, entry: CachedTokenEntry): void {
  const key = authKey();
  if (!key || !authDir()) return;
  const plain = Buffer.from(JSON.stringify(entry), 'utf8');
  atomicWrite(entryPath(cacheKey), encrypt(plain, key));
}

/** Test helper: wipe job auth dir contents (not the key env). */
export function clearJobAuthCacheForTests(): void {
  const dir = authDir();
  if (!dir || !fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

/** Test helper: corrupt ciphertext for fail-closed coverage. */
export function corruptCacheFileForTests(cacheKey: string): void {
  const file = entryPath(cacheKey);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from('not-valid-gcm-payload'), { mode: 0o600 });
}
