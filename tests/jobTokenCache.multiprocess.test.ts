import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { AddressInfo } from 'net';
import { spawn } from 'child_process';

/**
 * Cross-process proof for AUTH-SUITE-1/2: reuse, expiry renewal, single-flight.
 */
describe('jobTokenCache multiprocess reuse + renewal', () => {
  let server: http.Server;
  let mockBase = '';
  let authDir = '';
  let tokenHttpCount = 0;
  let nextExpiresIn = 300;
  let nextStatus = 200;
  let issueSeq = 0;
  const sharedKey = crypto.randomBytes(32).toString('base64');
  const jobId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const fingerprint = 'f'.repeat(32);

  before(async () => {
    authDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-auth-mp-'));
    server = http.createServer((req, res) => {
      if (req.url === '/oauth/token' && req.method === 'POST') {
        tokenHttpCount += 1;
        let body = '';
        req.on('data', (c) => {
          body += c;
        });
        req.on('end', () => {
          if (nextStatus !== 200) {
            res.writeHead(nextStatus, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'token_endpoint_error' }));
            return;
          }
          issueSeq += 1;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            access_token: `shared-token-${issueSeq}`,
            token_type: 'Bearer',
            expires_in: nextExpiresIn,
            echo: body,
          }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as AddressInfo;
    mockBase = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (authDir) fs.rmSync(authDir, { recursive: true, force: true });
  });

  function resetDir(): void {
    fs.rmSync(authDir, { recursive: true, force: true });
    fs.mkdirSync(authDir, { recursive: true });
    tokenHttpCount = 0;
    issueSeq = 0;
    nextExpiresIn = 300;
    nextStatus = 200;
  }

  function runWorker(envExtra: Record<string, string> = {}): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        ['--require', 'ts-node/register/transpile-only', path.resolve(__dirname, 'e2e/jobTokenCacheWorker.ts')],
        {
          cwd: path.resolve(__dirname, '..'),
          env: {
            ...process.env,
            MOCK_BASE_URL: mockBase,
            TOKEN_FINGERPRINT: fingerprint,
            COTESTER_JOB_AUTH_DIR: authDir,
            COTESTER_JOB_AUTH_KEY: sharedKey,
            COTESTER_RUN_JOB_ID: jobId,
            API_PROJECT_KEY: 'Demo',
            COTESTER_API_BASE_URL: mockBase,
            ...envExtra,
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
  }

  function lastJson(stdout: string): Record<string, unknown> {
    const line = stdout.trim().split('\n').pop() || '{}';
    return JSON.parse(line) as Record<string, unknown>;
  }

  it('same job, 10 processes, long-lived token → 1 token HTTP', async () => {
    resetDir();
    nextExpiresIn = 3600;
    const results = await Promise.all(Array.from({ length: 10 }, () => runWorker()));
    for (const r of results) {
      assert.equal(r.code, 0, r.stderr || r.stdout);
      const parsed = lastJson(r.stdout);
      assert.ok(parsed.kind === 'hit' || parsed.kind === 'acquire');
      assert.equal(parsed.tokenPresent, true);
    }
    assert.equal(tokenHttpCount, 1);
    const hits = results.filter((r) => lastJson(r.stdout).kind === 'hit');
    assert.ok(hits.length >= 9);
  });

  it('token expires → new acquisition (generation bump)', async () => {
    resetDir();
    nextExpiresIn = 1;
    const a = await runWorker();
    assert.equal(a.code, 0, a.stderr);
    assert.equal(lastJson(a.stdout).kind, 'acquire');
    await new Promise((r) => setTimeout(r, 1200));
    nextExpiresIn = 300;
    const b = await runWorker();
    assert.equal(b.code, 0, b.stderr);
    const jb = lastJson(b.stdout);
    assert.ok(jb.kind === 'renew' || jb.kind === 'acquire');
    assert.equal(jb.generation, 2);
    assert.equal(tokenHttpCount, 2);
  });

  it('token expires soon → proactive renewal single-flight across processes', async () => {
    resetDir();
    // Seed a near-expiry long-lifetime entry via first acquire with short remaining window:
    // Store manually using worker acquire then overwrite timing through second wave.
    nextExpiresIn = 3600;
    const seed = await runWorker();
    assert.equal(seed.code, 0, seed.stderr);

    const rewrite = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(
        process.execPath,
        ['--require', 'ts-node/register/transpile-only', path.resolve(__dirname, 'e2e/jobTokenCacheRewriteWorker.ts')],
        {
          cwd: path.resolve(__dirname, '..'),
          env: {
            ...process.env,
            TOKEN_FINGERPRINT: fingerprint,
            COTESTER_JOB_AUTH_DIR: authDir,
            COTESTER_JOB_AUTH_KEY: sharedKey,
            COTESTER_RUN_JOB_ID: jobId,
            API_PROJECT_KEY: 'Demo',
            COTESTER_API_BASE_URL: mockBase,
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
    assert.equal(rewrite.code, 0, rewrite.stderr);

    const before = tokenHttpCount;
    nextExpiresIn = 3600;
    const results = await Promise.all(Array.from({ length: 8 }, () => runWorker()));
    for (const r of results) {
      assert.equal(r.code, 0, r.stderr || r.stdout);
    }
    assert.equal(tokenHttpCount - before, 1);
    const renews = results.filter((r) => {
      const k = lastJson(r.stdout).kind;
      return k === 'renew' || k === 'acquire';
    });
    const hits = results.filter((r) => lastJson(r.stdout).kind === 'hit');
    assert.equal(renews.length, 1);
    assert.equal(hits.length, 7);
    assert.equal(lastJson(renews[0].stdout).generation, 2);
  });

  it('short-lived token does not refresh-loop on immediate reuse', async () => {
    resetDir();
    nextExpiresIn = 30;
    const a = await runWorker();
    assert.equal(a.code, 0, a.stderr);
    const b = await runWorker();
    assert.equal(b.code, 0, b.stderr);
    assert.equal(lastJson(b.stdout).kind, 'hit');
    assert.equal(tokenHttpCount, 1);
  });

  it('different job id → separate token HTTP', async () => {
    resetDir();
    const a = await runWorker({ COTESTER_RUN_JOB_ID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' });
    const b = await runWorker({ COTESTER_RUN_JOB_ID: 'cccccccc-cccc-cccc-cccc-cccccccccccc' });
    assert.equal(a.code, 0, a.stderr);
    assert.equal(b.code, 0, b.stderr);
    assert.equal(tokenHttpCount, 2);
  });

  it('different fingerprint → separate token HTTP', async () => {
    resetDir();
    const a = await runWorker({ TOKEN_FINGERPRINT: '1'.repeat(32) });
    const b = await runWorker({ TOKEN_FINGERPRINT: '2'.repeat(32) });
    assert.equal(a.code, 0, a.stderr);
    assert.equal(b.code, 0, b.stderr);
    assert.equal(tokenHttpCount, 2);
  });

  it('renewal endpoint 401 → fail-closed (no cached token for waiters)', async () => {
    resetDir();
    nextExpiresIn = 1;
    const seed = await runWorker();
    assert.equal(seed.code, 0, seed.stderr);
    await new Promise((r) => setTimeout(r, 1200));
    nextStatus = 401;
    const failed = await runWorker();
    assert.equal(failed.code, 4);
    assert.equal(lastJson(failed.stdout).kind, 'acquire_failed');
    // Waiter must not get a hit on expired/failed renewal
    const waiter = await runWorker();
    assert.notEqual(lastJson(waiter.stdout).kind, 'hit');
  });

  it('renewal endpoint 500 → fail-closed', async () => {
    resetDir();
    nextExpiresIn = 1;
    await runWorker();
    await new Promise((r) => setTimeout(r, 1200));
    nextStatus = 500;
    const failed = await runWorker();
    assert.equal(failed.code, 4);
    assert.equal(lastJson(failed.stdout).kind, 'acquire_failed');
  });

  it('cache files never contain plaintext token', async () => {
    resetDir();
    await runWorker();
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
    assert.ok(!all.includes('shared-token-'));
    assert.ok(!all.includes(sharedKey));
  });
});
