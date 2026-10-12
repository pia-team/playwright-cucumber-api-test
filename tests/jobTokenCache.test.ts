import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  beginAcquisition,
  buildRuntimeCacheKey,
  clearJobAuthCacheForTests,
  computeExpiresAt,
  CONSERVATIVE_FALLBACK_TTL_MS,
  corruptCacheFileForTests,
  forceStoreEntryForTests,
  isUsable,
  jobAuthCacheEnabled,
  jwtExpMs,
  mergeStoreValue,
  releaseLock,
  resolveExpiration,
  safetyMarginMs,
  storeEntry,
} from '../src/utils/jobTokenCache';
import { resetRuntimeCredentialsCacheForTests } from '../src/utils/runtimeCredentials';

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

describe('jobTokenCache', () => {
  let authDir = '';
  const key = crypto.randomBytes(32).toString('base64');

  beforeEach(() => {
    authDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-auth-'));
    process.env.COTESTER_JOB_AUTH_DIR = authDir;
    process.env.COTESTER_JOB_AUTH_KEY = key;
    process.env.COTESTER_RUN_JOB_ID = '11111111-1111-1111-1111-111111111111';
    process.env.API_PROJECT_KEY = 'Demo';
    process.env.COTESTER_API_BASE_URL = 'https://api.example.test';
    delete process.env.COTESTER_RUNTIME_CREDENTIALS_FILE;
    resetRuntimeCredentialsCacheForTests();
    clearJobAuthCacheForTests();
  });

  afterEach(() => {
    clearJobAuthCacheForTests();
    if (authDir) fs.rmSync(authDir, { recursive: true, force: true });
    resetRuntimeCredentialsCacheForTests();
  });

  it('is enabled only when job auth env is complete', () => {
    assert.equal(jobAuthCacheEnabled(), true);
    delete process.env.COTESTER_JOB_AUTH_KEY;
    assert.equal(jobAuthCacheEnabled(), false);
  });

  it('reuses stored token on second beginAcquisition (cache hit)', async () => {
    const fp = 'a'.repeat(32);
    const first = await beginAcquisition(fp);
    assert.equal(first.kind, 'acquire');
    if (first.kind !== 'acquire') return;
    const acquiredAt = Date.now();
    const exp = resolveExpiration(acquiredAt, { expires_in: 3600 }, 'tok');
    storeEntry(
      first.cacheKey,
      {
        values: { access_token: 'tok-shared-1' },
        expectedStatus: 200,
        acquiredAt,
        expiresAt: exp.expiresAt,
        lifetimeMs: exp.lifetimeMs,
        expirationSource: exp.source,
        generation: first.previousGeneration + 1,
      },
      first.lockPath,
    );

    const second = await beginAcquisition(fp);
    assert.equal(second.kind, 'hit');
    if (second.kind !== 'hit') return;
    assert.equal(second.entry.values.access_token, 'tok-shared-1');
    assert.equal(second.entry.expectedStatus, 200);
    assert.ok(second.entry.generation >= 1);
  });

  it('isolates cache keys by job id and base URL', () => {
    const fp = 'b'.repeat(32);
    const a = buildRuntimeCacheKey(fp);
    process.env.COTESTER_RUN_JOB_ID = '22222222-2222-2222-2222-222222222222';
    const b = buildRuntimeCacheKey(fp);
    assert.notEqual(a, b);
    process.env.COTESTER_RUN_JOB_ID = '11111111-1111-1111-1111-111111111111';
    process.env.COTESTER_API_BASE_URL = 'https://other.example.test';
    const c = buildRuntimeCacheKey(fp);
    assert.notEqual(a, c);
  });

  it('isolates cache keys by credential identity', () => {
    const fp = 'c'.repeat(32);
    const credA = path.join(authDir, 'cred-a.json');
    const credB = path.join(authDir, 'cred-b.json');
    fs.writeFileSync(credA, JSON.stringify({ type: 'KEYCLOAK', secrets: { username: 'u1', password: 'p1' } }));
    fs.writeFileSync(credB, JSON.stringify({ type: 'KEYCLOAK', secrets: { username: 'u2', password: 'p2' } }));
    process.env.COTESTER_RUNTIME_CREDENTIALS_FILE = credA;
    resetRuntimeCredentialsCacheForTests();
    const a = buildRuntimeCacheKey(fp);
    process.env.COTESTER_RUNTIME_CREDENTIALS_FILE = credB;
    resetRuntimeCredentialsCacheForTests();
    const b = buildRuntimeCacheKey(fp);
    assert.notEqual(a, b);
  });

  it('treats expired entries as miss (not unlimited reuse)', async () => {
    const fp = 'd'.repeat(32);
    const first = await beginAcquisition(fp);
    assert.equal(first.kind, 'acquire');
    if (first.kind !== 'acquire') return;
    storeEntry(
      first.cacheKey,
      {
        values: { access_token: 'expired-tok' },
        expectedStatus: 200,
        acquiredAt: Date.now() - 120_000,
        expiresAt: Date.now() - 1_000,
        lifetimeMs: 60_000,
        generation: 1,
      },
      first.lockPath,
    );
    const second = await beginAcquisition(fp);
    assert.equal(second.kind, 'acquire');
    if (second.kind === 'acquire') {
      assert.equal(second.renewing, true);
      assert.equal(second.previousGeneration, 1);
      releaseLock(second.lockPath);
    }
  });

  it('missing expires_in uses conservative fallback TTL (not 55m assumption)', () => {
    const at = 1_000_000;
    const resolved = resolveExpiration(at, { access_token: 'x' }, 'x');
    assert.equal(resolved.source, 'fallback');
    assert.equal(resolved.lifetimeMs, CONSERVATIVE_FALLBACK_TTL_MS);
    assert.equal(computeExpiresAt(at, null), at + CONSERVATIVE_FALLBACK_TTL_MS);
    assert.equal(computeExpiresAt(at, 60), at + 60_000);
  });

  it('resolves expires_in over expires_at and JWT', () => {
    const at = Date.now();
    const jwt = `${b64url({ alg: 'none' })}.${b64url({ exp: Math.floor(at / 1000) + 10 })}.sig`;
    const r = resolveExpiration(
      at,
      { expires_in: 3600, expires_at: new Date(at + 60_000).toISOString() },
      jwt,
    );
    assert.equal(r.source, 'expires_in');
    assert.equal(r.lifetimeMs, 3_600_000);
  });

  it('falls back to expires_at then JWT exp', () => {
    const at = Date.now();
    const r1 = resolveExpiration(at, { expires_at: Math.floor((at + 120_000) / 1000) }, 'plain');
    assert.equal(r1.source, 'expires_at');
    const jwt = `${b64url({ alg: 'none' })}.${b64url({ exp: Math.floor(at / 1000) + 90 })}.sig`;
    const r2 = resolveExpiration(at, {}, jwt);
    assert.equal(r2.source, 'jwt_exp');
    assert.ok(jwtExpMs(jwt)! > at);
  });

  it('malformed expiration values fall through safely', () => {
    const at = Date.now();
    const r = resolveExpiration(at, { expires_in: -5, expires_at: 'not-a-date' }, 'not.jwt');
    assert.equal(r.source, 'fallback');
    const r2 = resolveExpiration(at, { expires_in: 0 }, null);
    assert.equal(r2.source, 'fallback');
    const r3 = resolveExpiration(at, { expires_in: 999999999 }, null);
    assert.equal(r3.source, 'fallback');
  });

  it('adaptive safety margin: long renews early, short avoids refresh loop', () => {
    assert.equal(safetyMarginMs(30_000), 0);
    assert.ok(safetyMarginMs(5 * 60 * 1000) > 0);
    assert.ok(safetyMarginMs(60 * 60 * 1000) >= 60_000);
    const longLived = {
      values: { access_token: 't' },
      expectedStatus: 200,
      acquiredAt: Date.now() - 50 * 60 * 1000,
      expiresAt: Date.now() + 2 * 60 * 1000,
      lifetimeMs: 60 * 60 * 1000,
      generation: 1,
    };
    assert.equal(isUsable(longLived), false); // inside proactive window
    const shortLived = {
      values: { access_token: 't' },
      expectedStatus: 200,
      acquiredAt: Date.now() - 10_000,
      expiresAt: Date.now() + 20_000,
      lifetimeMs: 30_000,
      generation: 1,
    };
    assert.equal(isUsable(shortLived), true); // no proactive margin
  });

  it('proactive renewal triggers acquire before hard expiry', async () => {
    const fp = 'p'.repeat(32);
    const first = await beginAcquisition(fp);
    assert.equal(first.kind, 'acquire');
    if (first.kind !== 'acquire') return;
    const acquiredAt = Date.now() - 50 * 60 * 1000;
    storeEntry(
      first.cacheKey,
      {
        values: { access_token: 'soon-expire' },
        expectedStatus: 200,
        acquiredAt,
        expiresAt: Date.now() + 60_000,
        lifetimeMs: 60 * 60 * 1000,
        expirationSource: 'expires_in',
        generation: 1,
      },
      first.lockPath,
    );
    const second = await beginAcquisition(fp);
    assert.equal(second.kind, 'acquire');
    if (second.kind === 'acquire') {
      assert.equal(second.renewing, true);
      releaseLock(second.lockPath);
    }
  });

  it('stale generation cannot overwrite newer token', async () => {
    const fp = 'g'.repeat(32);
    const first = await beginAcquisition(fp);
    assert.equal(first.kind, 'acquire');
    if (first.kind !== 'acquire') return;
    const at = Date.now();
    storeEntry(
      first.cacheKey,
      {
        values: { access_token: 'gen2' },
        expectedStatus: 200,
        acquiredAt: at,
        expiresAt: at + 3_600_000,
        lifetimeMs: 3_600_000,
        generation: 2,
      },
      first.lockPath,
    );
    const stale = storeEntry(first.cacheKey, {
      values: { access_token: 'gen1-stale' },
      expectedStatus: 200,
      acquiredAt: at,
      expiresAt: at + 3_600_000,
      lifetimeMs: 3_600_000,
      generation: 1,
    });
    assert.equal(stale.stored, false);
    assert.equal(stale.reason, 'stale_generation');
    const hit = await beginAcquisition(fp);
    assert.equal(hit.kind, 'hit');
    if (hit.kind === 'hit') assert.equal(hit.entry.values.access_token, 'gen2');
  });

  it('corrupt cache is not returned as hit (fail-closed)', async () => {
    const fp = 'x'.repeat(32);
    const first = await beginAcquisition(fp);
    assert.equal(first.kind, 'acquire');
    if (first.kind !== 'acquire') return;
    forceStoreEntryForTests(first.cacheKey, {
      values: { access_token: 'ok' },
      expectedStatus: 200,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
      lifetimeMs: 3_600_000,
      generation: 1,
    });
    releaseLock(first.lockPath);
    corruptCacheFileForTests(first.cacheKey);
    const again = await beginAcquisition(fp);
    assert.equal(again.kind, 'acquire');
    if (again.kind === 'acquire') releaseLock(again.lockPath);
  });

  it('lock timeout fail-closed when another process holds the lock', async () => {
    const fp = 'l'.repeat(32);
    const cacheKey = buildRuntimeCacheKey(fp);
    const lockPath = path.join(authDir, 'locks', cacheKey);
    fs.mkdirSync(lockPath, { recursive: true });
    process.env.COTESTER_JOB_AUTH_LOCK_WAIT_MS = '120';
    await assert.rejects(
      () => beginAcquisition(fp),
      /Timed out waiting for shared token acquisition/,
    );
    // Orphan lock is not auto-deleted
    assert.ok(fs.existsSync(lockPath));
    delete process.env.COTESTER_JOB_AUTH_LOCK_WAIT_MS;
    fs.rmSync(lockPath, { recursive: true, force: true });
  });

  it('mergeStoreValue writes without plaintext token files', async () => {
    const fp = 'e'.repeat(32);
    const first = await beginAcquisition(fp);
    assert.equal(first.kind, 'acquire');
    if (first.kind !== 'acquire') return;
    const secret = 'super-secret-token-value-xyz';
    const exp = resolveExpiration(Date.now(), { expires_in: 120 }, secret);
    mergeStoreValue(first.cacheKey, 'access_token', secret, 200, exp, first.lockPath, 0);
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) out.push(...walk(p));
        else out.push(fs.readFileSync(p, 'utf8'));
      }
      return out;
    };
    const blobs = walk(authDir).join('\n');
    assert.ok(!blobs.includes(secret));
  });
});
