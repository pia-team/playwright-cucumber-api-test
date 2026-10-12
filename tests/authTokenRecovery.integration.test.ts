import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { AddressInfo } from 'net';
import { spawn } from 'child_process';
import {
  clearManagedTokenVarRegistry,
  registerManagedTokenVar,
  retrySafeHttpWithBearer,
  runAuthRecovery,
  setLastHttpSendSnapshot,
  type LastHttpSendSnapshot,
} from '../src/utils/authTokenRecovery';
import {
  beginAcquisition,
  clearJobAuthCacheForTests,
  mergeStoreValue,
  resolveExpiration,
  type TokenAcquisitionRecipe,
} from '../src/utils/jobTokenCache';
import { resetRuntimeCredentialsCacheForTests } from '../src/utils/runtimeCredentials';

/**
 * Runner-level AUTH-SUITE-3 integration against a real HTTP mock server.
 */
describe('authTokenRecovery integration', () => {
  let server: http.Server;
  let mockBase = '';
  let authDir = '';
  let tokenHttpCount = 0;
  let usersHttpCount = 0;
  let tokenStatus = 200;
  let usersMode: 'require-latest' | 'always-401' | 'always-200' = 'require-latest';
  let latestToken = '';
  let issueSeq = 0;
  const usersMethods: string[] = [];
  const key = crypto.randomBytes(32).toString('base64');
  const fingerprint = 'r'.repeat(32);
  const jobId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  before(async () => {
    authDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-rec-'));
    server = http.createServer((req, res) => {
      if (req.url === '/oauth/token' && req.method === 'POST') {
        tokenHttpCount += 1;
        let body = '';
        req.on('data', (c) => {
          body += c;
        });
        req.on('end', () => {
          if (tokenStatus !== 200) {
            res.writeHead(tokenStatus, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'token_fail' }));
            return;
          }
          issueSeq += 1;
          latestToken = `rec-token-${issueSeq}`;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            access_token: latestToken,
            expires_in: 3600,
            echo: body,
          }));
        });
        return;
      }
      if (req.url?.startsWith('/users') && (req.method === 'GET' || req.method === 'HEAD')) {
        usersHttpCount += 1;
        usersMethods.push(req.method || '');
        const auth = req.headers.authorization || '';
        if (usersMode === 'always-200') {
          res.writeHead(200, { 'content-type': 'application/json' });
          if (req.method === 'HEAD') res.end();
          else res.end(JSON.stringify({ ok: true }));
          return;
        }
        if (usersMode === 'always-401') {
          res.writeHead(401, { 'content-type': 'application/json' });
          if (req.method === 'HEAD') res.end();
          else res.end(JSON.stringify({ error: 'unauthorized' }));
          return;
        }
        if (auth === `Bearer ${latestToken}`) {
          res.writeHead(200, { 'content-type': 'application/json' });
          if (req.method === 'HEAD') res.end();
          else res.end(JSON.stringify({ ok: true, tokenMatch: true }));
        } else {
          res.writeHead(401, { 'content-type': 'application/json' });
          if (req.method === 'HEAD') res.end();
          else res.end(JSON.stringify({ error: 'unauthorized' }));
        }
        return;
      }
      if (req.url === '/items' && (req.method === 'POST' || req.method === 'PUT')) {
        usersHttpCount += 1;
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    mockBase = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (authDir) fs.rmSync(authDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    process.env.COTESTER_JOB_AUTH_DIR = authDir;
    process.env.COTESTER_JOB_AUTH_KEY = key;
    process.env.COTESTER_RUN_JOB_ID = jobId;
    process.env.API_PROJECT_KEY = 'Demo';
    process.env.COTESTER_API_BASE_URL = mockBase;
    delete process.env.COTESTER_RUNTIME_CREDENTIALS_FILE;
    resetRuntimeCredentialsCacheForTests();
    clearJobAuthCacheForTests();
    clearManagedTokenVarRegistry();
    setLastHttpSendSnapshot(null);
    tokenHttpCount = 0;
    usersHttpCount = 0;
    tokenStatus = 200;
    usersMode = 'require-latest';
    latestToken = '';
    issueSeq = 0;
    usersMethods.length = 0;
  });

  afterEach(() => {
    clearJobAuthCacheForTests();
    clearManagedTokenVarRegistry();
  });

  const recipe = (): TokenAcquisitionRecipe => ({
    method: 'POST',
    path: '/oauth/token',
    body: 'grant_type=client_credentials',
    contentType: 'application/x-www-form-urlencoded',
    authMode: 'NONE',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    query: {},
    resolveCredentialBody: false,
    extracts: [{ name: 'access_token', path: '$.access_token' }],
    expectedStatus: 200,
  });

  async function seedToken(generation = 1): Promise<string> {
    const acq = await beginAcquisition(fingerprint);
    assert.equal(acq.kind, 'acquire');
    if (acq.kind !== 'acquire') throw new Error('expected acquire');
    // Perform token HTTP via recovery helper path by storing manually after fetch
    const token = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        new URL('/oauth/token', mockBase),
        {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'content-length': Buffer.byteLength('grant_type=client_credentials'),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => {
            data += c;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data).access_token);
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on('error', reject);
      req.write('grant_type=client_credentials');
      req.end();
    });
    const at = Date.now();
    const exp = resolveExpiration(at, { expires_in: 3600 }, token);
    mergeStoreValue(
      acq.cacheKey,
      'access_token',
      token,
      200,
      exp,
      acq.lockPath,
      generation - 1,
      recipe(),
    );
    registerManagedTokenVar('access_token', fingerprint, generation);
    return token;
  }

  function protectedSnapshot(method: string, staleToken: string): LastHttpSendSnapshot {
    return {
      method,
      path: method === 'POST' ? '/items' : '/users',
      resolvedPath: method === 'POST' ? '/items' : '/users',
      resolvedUrl: `${mockBase}${method === 'POST' ? '/items' : '/users'}`,
      headers: { Authorization: `Bearer ${staleToken}` },
      params: {},
      bodyPayload: method === 'POST' ? { name: 'x' } : undefined,
      resolvedBody: method === 'POST' ? '{"name":"x"}' : null,
      isForm: false,
      authMode: 'BEARER',
      bearerFromScenarioVariable: 'access_token',
      managedFingerprint: fingerprint,
      tokenGenerationUsed: 1,
      hadExplicitAuthorization: false,
      recoveryAttempted: false,
    };
  }

  it('HEAD unexpected 401 → refresh + HEAD retry (not GET)', async () => {
    const stale = await seedToken(1);
    latestToken = 'stale-rejected';
    usersMode = 'require-latest';
    const snap = protectedSnapshot('HEAD', stale);
    snap.resolvedPath = '/users';
    snap.path = '/users';
    snap.resolvedUrl = `${mockBase}/users`;
    const recovery = await runAuthRecovery({
      expectedStatus: 200,
      actualStatus: 401,
      snapshot: snap,
    });
    assert.equal(recovery.tokenRefreshed, true);
    assert.equal(recovery.httpRetried, true);
    usersMethods.length = 0;
    const retried = await retrySafeHttpWithBearer(snap, recovery.values!.access_token);
    assert.equal(retried.status, 200);
    assert.deepEqual(usersMethods, ['HEAD']);
    assert.equal(retried.bodyText, null);
  });

  it('GET unexpected 401 → refresh + retry PASS', async () => {
    const stale = await seedToken(1);
    // Force API to reject stale while latestToken already points to seeded token —
    // simulate expiry by changing latestToken expectation after seeding.
    latestToken = 'brand-new-required';
    usersMode = 'require-latest';
    const snap = protectedSnapshot('GET', stale);
    setLastHttpSendSnapshot(snap);
    usersHttpCount = 0;
    const beforeToken = tokenHttpCount;
    const recovery = await runAuthRecovery({
      expectedStatus: 200,
      actualStatus: 401,
      snapshot: snap,
    });
    assert.equal(recovery.tokenRefreshed, true);
    assert.equal(recovery.httpRetried, true);
    assert.ok(tokenHttpCount > beforeToken);
    const newToken = recovery.values!.access_token;
    const retried = await retrySafeHttpWithBearer(snap, newToken);
    assert.equal(retried.status, 200);
    assert.equal(usersHttpCount, 1);
  });

  it('GET retry still 401 → no second recovery', async () => {
    const stale = await seedToken(1);
    usersMode = 'always-401';
    const snap = protectedSnapshot('GET', stale);
    const recovery = await runAuthRecovery({
      expectedStatus: 200,
      actualStatus: 401,
      snapshot: snap,
    });
    assert.equal(recovery.tokenRefreshed, true);
    const retried = await retrySafeHttpWithBearer(snap, recovery.values!.access_token);
    assert.equal(retried.status, 401);
    const again = await runAuthRecovery({
      expectedStatus: 200,
      actualStatus: 401,
      snapshot: snap,
    });
    assert.equal(again.attempted, false);
    assert.equal(again.note, 'recovery_already_attempted');
  });

  it('POST 401 → token refresh without HTTP retry', async () => {
    const stale = await seedToken(1);
    const snap = protectedSnapshot('POST', stale);
    const beforeUsers = usersHttpCount;
    const recovery = await runAuthRecovery({
      expectedStatus: 201,
      actualStatus: 401,
      snapshot: snap,
    });
    assert.equal(recovery.tokenRefreshed, true);
    assert.equal(recovery.httpRetried, false);
    assert.match(recovery.note, /no_http_retry/i);
    assert.equal(usersHttpCount, beforeUsers);
  });

  it('token acquisition 500 → fail-closed', async () => {
    await seedToken(1);
    tokenStatus = 500;
    // Invalidate by using recovery against gen 1 — acquisition will 500
    const snap = protectedSnapshot('GET', 'stale');
    const recovery = await runAuthRecovery({
      expectedStatus: 200,
      actualStatus: 401,
      snapshot: snap,
    });
    assert.equal(recovery.tokenRefreshed, false);
    assert.ok(recovery.failClosedMessage);
    assert.ok(!/client_secret|password|rec-token-/i.test(recovery.failClosedMessage || ''));
  });

  it('parallel 401 recovery → single-flight token refresh', async () => {
    await seedToken(1);
    latestToken = 'will-be-replaced';
    const results = await Promise.all(
      Array.from({ length: 6 }, () => {
        const snap = protectedSnapshot('GET', 'stale-parallel');
        snap.recoveryAttempted = false;
        return runAuthRecovery({
          expectedStatus: 200,
          actualStatus: 401,
          snapshot: { ...snap },
        });
      }),
    );
    const refreshed = results.filter((r) => r.tokenRefreshed);
    assert.ok(refreshed.length >= 1);
    // One acquisition wave for the job (seed + one renew) — renew count should be 1 beyond seed
    assert.equal(tokenHttpCount, 2);
  });

  it('stale generation reuses newer generation without re-invalidating', async () => {
    await seedToken(1);
    // Renew once to generation 2
    const snap1 = protectedSnapshot('GET', 'old');
    const r1 = await runAuthRecovery({
      expectedStatus: 200,
      actualStatus: 401,
      snapshot: snap1,
    });
    assert.equal(r1.newGeneration, 2);
    const tokenHttpAfter = tokenHttpCount;
    // Another process still holding generation 1 view
    const snap2 = protectedSnapshot('GET', 'old');
    snap2.tokenGenerationUsed = 1;
    snap2.recoveryAttempted = false;
    const r2 = await runAuthRecovery({
      expectedStatus: 200,
      actualStatus: 401,
      snapshot: snap2,
    });
    assert.equal(r2.tokenRefreshed, true);
    assert.equal(r2.newGeneration, 2);
    assert.equal(tokenHttpCount, tokenHttpAfter); // reused gen2, no new HTTP
  });

  it('child process recovery updates token used by subsequent GET', async () => {
    await seedToken(1);
    const worker = path.resolve(__dirname, 'e2e/authTokenRecoveryWorker.ts');
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(
        process.execPath,
        ['--require', 'ts-node/register/transpile-only', worker],
        {
          cwd: path.resolve(__dirname, '..'),
          env: {
            ...process.env,
            MOCK_BASE_URL: mockBase,
            TOKEN_FINGERPRINT: fingerprint,
            COTESTER_JOB_AUTH_DIR: authDir,
            COTESTER_JOB_AUTH_KEY: key,
            COTESTER_RUN_JOB_ID: jobId,
            API_PROJECT_KEY: 'Demo',
            COTESTER_API_BASE_URL: mockBase,
            STALE_GENERATION: '1',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => {
        stdout += d;
      });
      child.stderr.on('data', (d) => {
        stderr += d;
      });
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
    assert.equal(result.code, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout.trim().split('\n').pop() || '{}');
    assert.equal(parsed.retryStatus, 200);
    assert.equal(parsed.tokenRefreshed, true);
  });
});
