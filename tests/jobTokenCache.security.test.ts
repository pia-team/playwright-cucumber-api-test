import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  beginAcquisition,
  clearJobAuthCacheForTests,
  mergeStoreValue,
  resolveExpiration,
  sanitizeAcquisitionRecipe,
  storeEntry,
} from '../src/utils/jobTokenCache';
import { resetRuntimeCredentialsCacheForTests } from '../src/utils/runtimeCredentials';

describe('jobTokenCache security (AUTH-SUITE-4)', () => {
  let authDir = '';
  const key = crypto.randomBytes(32).toString('base64');

  beforeEach(() => {
    authDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-auth-sec-'));
    process.env.COTESTER_JOB_AUTH_DIR = authDir;
    process.env.COTESTER_JOB_AUTH_KEY = key;
    process.env.COTESTER_RUN_JOB_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    process.env.API_PROJECT_KEY = 'Demo';
    process.env.COTESTER_API_BASE_URL = 'https://api.example.test';
    delete process.env.COTESTER_RUNTIME_CREDENTIALS_FILE;
    resetRuntimeCredentialsCacheForTests();
    clearJobAuthCacheForTests();
  });

  afterEach(() => {
    clearJobAuthCacheForTests();
    if (authDir) fs.rmSync(authDir, { recursive: true, force: true });
  });

  it('sanitizeAcquisitionRecipe drops Authorization and secret-looking values', () => {
    const cleaned = sanitizeAcquisitionRecipe({
      method: 'POST',
      path: '/oauth/token',
      body: 'grant_type=password&username={{username}}&password={{password}}',
      contentType: 'application/x-www-form-urlencoded',
      authMode: 'NONE',
      headers: {
        Authorization: 'Bearer leaked',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      query: { access_token: 'nope' },
      resolveCredentialBody: true,
      extracts: [{ name: 'access_token', path: '$.access_token' }],
      expectedStatus: 200,
    });
    assert.equal(cleaned.headers.Authorization, undefined);
    assert.equal(cleaned.query.access_token, undefined);
    assert.ok(cleaned.body?.includes('{{password}}'));
  });

  it('rejects invalid cache keys (path traversal)', () => {
    assert.throws(
      () =>
        storeEntry('../evil', {
          values: { access_token: 'x' },
          expectedStatus: 200,
          acquiredAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          generation: 1,
        }),
      /Invalid token cache key/,
    );
  });

  it('recipe-less recovery path: store without recipe still works for reuse', async () => {
    const fp = 's'.repeat(32);
    const first = await beginAcquisition(fp);
    assert.equal(first.kind, 'acquire');
    if (first.kind !== 'acquire') return;
    const at = Date.now();
    mergeStoreValue(
      first.cacheKey,
      'access_token',
      'tok-no-recipe',
      200,
      resolveExpiration(at, { expires_in: 120 }, 'tok-no-recipe'),
      first.lockPath,
      0,
      null,
    );
    const second = await beginAcquisition(fp);
    assert.equal(second.kind, 'hit');
  });

  it('encryption key is not written beside ciphertext files', async () => {
    const fp = 'k'.repeat(32);
    const first = await beginAcquisition(fp);
    assert.equal(first.kind, 'acquire');
    if (first.kind !== 'acquire') return;
    const at = Date.now();
    mergeStoreValue(
      first.cacheKey,
      'access_token',
      'tok-secret-value',
      200,
      resolveExpiration(at, { expires_in: 120 }, 'tok-secret-value'),
      first.lockPath,
      0,
      {
        method: 'POST',
        path: '/oauth/token',
        body: 'grant_type=client_credentials',
        contentType: 'application/x-www-form-urlencoded',
        authMode: 'NONE',
        headers: {},
        query: {},
        resolveCredentialBody: false,
        extracts: [{ name: 'access_token', path: '$.access_token' }],
        expectedStatus: 200,
      },
    );
    const walk = (dir: string): string => {
      let out = '';
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) out += walk(p);
        else out += fs.readFileSync(p).toString('utf8');
      }
      return out;
    };
    const all = walk(authDir);
    assert.ok(!all.includes(key));
    assert.ok(!all.includes('tok-secret-value'));
  });
});
