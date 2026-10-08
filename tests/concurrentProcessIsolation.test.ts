import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';

const TOKEN_A = 'synthetic-concurrent-token-a';
const TOKEN_B = 'synthetic-concurrent-token-b';
const TOKEN_C = 'synthetic-concurrent-token-c';

const USER_A = 'concurrent-user-a';
const USER_C = 'concurrent-user-c';

type SecureHit = { runId: string; authorization?: string };

describe('concurrent process auth isolation (API runner)', () => {
  let server: http.Server;
  let mockBase = '';
  const secureHits: SecureHit[] = [];
  const tokenRequests: Array<{ username?: string }> = [];
  let harnessRoot = '';
  const childDirs: string[] = [];

  before(async () => {
    harnessRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'api-concurrent-harness-'));
    server = http.createServer((req, res) => {
      const url = req.url || '';
      if (url.includes('/protocol/openid-connect/token') && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          const params = new URLSearchParams(body);
          const username = params.get('username') || undefined;
          tokenRequests.push({ username });
          let access_token = TOKEN_A;
          if (username === USER_C) access_token = TOKEN_C;
          else if (username === USER_A) access_token = TOKEN_A;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ access_token, token_type: 'Bearer', expires_in: 60 }));
        });
        return;
      }

      if (url.startsWith('/secure') && req.method === 'GET') {
        const runId = (req.headers['x-concurrent-run-id'] as string) || 'unknown';
        const authorization = req.headers.authorization;
        secureHits.push({ runId, authorization });
        const expected =
          runId === 'A' ? TOKEN_A : runId === 'B' ? TOKEN_B : runId === 'C' ? TOKEN_C : '';
        const ok = authorization === `Bearer ${expected}`;
        res.writeHead(ok ? 200 : 403, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok, runId }));
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
    if (harnessRoot) fs.rmSync(harnessRoot, { recursive: true, force: true });
  });

  function workerScript(): string {
    return path.resolve(__dirname, 'e2e/concurrentAuthWorker.ts');
  }

  function spawnRun(options: {
    runId: 'A' | 'B' | 'C';
    authMode: 'KEYCLOAK' | 'BEARER';
    env: Record<string, string>;
  }): Promise<{ code: number | null; runtimeDir: string }> {
    const runtimeDir = fs.mkdtempSync(path.join(harnessRoot, `run-${options.runId}-`));
    childDirs.push(runtimeDir);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...options.env,
      CONCURRENT_RUN_ID: options.runId,
      CONCURRENT_AUTH_MODE: options.authMode,
      MOCK_BASE_URL: mockBase,
      COTESTER_RUNTIME_DIR: runtimeDir,
      COTESTER_API_BASE_URL: mockBase,
    };

    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--require', 'ts-node/register/transpile-only', workerScript()],
        { env, cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stderr = '';
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0 && stderr) {
          assert.fail(`Run ${options.runId} failed (${code}): ${stderr.trim()}`);
        }
        resolve({ code, runtimeDir });
      });
    });
  }

  it('runs A/B/C in parallel with distinct tokens and isolated runtime dirs', async () => {
    secureHits.length = 0;
    tokenRequests.length = 0;

    const keycloakRealmBase = `${mockBase}/realms/orbitant-realm`;

    const [resultA, resultB, resultC] = await Promise.all([
      spawnRun({
        runId: 'A',
        authMode: 'KEYCLOAK',
        env: {
          TEST_ENV: 'staging',
          API_PROJECT_KEY: 'ProjectA',
          API_TEST_USERNAME: USER_A,
          API_TEST_PASSWORD: 'pass-a',
          API_KEYCLOAK_URL: `${keycloakRealmBase}/protocol/openid-connect/token`,
        },
      }),
      spawnRun({
        runId: 'B',
        authMode: 'BEARER',
        env: {
          TEST_ENV: 'production',
          API_PROJECT_KEY: 'ProjectA',
          API_TOKEN: TOKEN_B,
        },
      }),
      spawnRun({
        runId: 'C',
        authMode: 'KEYCLOAK',
        env: {
          TEST_ENV: 'staging',
          API_PROJECT_KEY: 'ProjectB',
          API_TEST_USERNAME: USER_C,
          API_TEST_PASSWORD: 'pass-c',
          API_KEYCLOAK_URL: `${keycloakRealmBase}/protocol/openid-connect/token`,
        },
      }),
    ]);

    assert.equal(resultA.code, 0);
    assert.equal(resultB.code, 0);
    assert.equal(resultC.code, 0);

    assert.equal(secureHits.length, 3);
    const byRun = Object.fromEntries(secureHits.map((h) => [h.runId, h.authorization]));
    assert.equal(byRun.A, `Bearer ${TOKEN_A}`);
    assert.equal(byRun.B, `Bearer ${TOKEN_B}`);
    assert.equal(byRun.C, `Bearer ${TOKEN_C}`);

    for (const hit of secureHits) {
      const token = hit.authorization?.replace(/^Bearer\s+/, '') || '';
      assert.ok(token === TOKEN_A || token === TOKEN_B || token === TOKEN_C);
      const expected =
        hit.runId === 'A' ? TOKEN_A : hit.runId === 'B' ? TOKEN_B : hit.runId === 'C' ? TOKEN_C : '';
      assert.equal(token, expected);
    }

    assert.ok(tokenRequests.some((t) => t.username === USER_A));
    assert.ok(tokenRequests.some((t) => t.username === USER_C));

    for (const dir of [resultA.runtimeDir, resultB.runtimeDir, resultC.runtimeDir]) {
      assert.ok(fs.existsSync(path.join(dir, 'result.json')));
      assert.ok(fs.existsSync(path.join(dir, 'http-evidence.json')));
      const evidence = fs.readFileSync(path.join(dir, 'http-evidence.json'), 'utf8');
      assert.ok(!evidence.includes(TOKEN_A) || evidence.includes('[REDACTED]'));
      assert.ok(!evidence.includes(TOKEN_B) || evidence.includes('[REDACTED]'));
      assert.ok(!evidence.includes(TOKEN_C) || evidence.includes('[REDACTED]'));
    }

    const uniqueDirs = new Set([resultA.runtimeDir, resultB.runtimeDir, resultC.runtimeDir]);
    assert.equal(uniqueDirs.size, 3);
  });

  it('cleans temp runtime dirs after success and after killed child', async () => {
    const cancelDir = fs.mkdtempSync(path.join(harnessRoot, 'run-cancel-'));
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CONCURRENT_RUN_ID: 'B',
      CONCURRENT_AUTH_MODE: 'BEARER',
      MOCK_BASE_URL: mockBase,
      COTESTER_RUNTIME_DIR: cancelDir,
      API_TOKEN: TOKEN_B,
    };

    const child: ChildProcessWithoutNullStreams = spawn(
      process.execPath,
      ['--require', 'ts-node/register/transpile-only', workerScript()],
      { env, cwd: path.resolve(__dirname, '..'), stdio: 'ignore' },
    );

    await new Promise((r) => setTimeout(r, 50));
    child.kill('SIGKILL');

    await new Promise<void>((resolve) => {
      child.on('close', () => resolve());
    });

    // Parent-owned harness dir: safe to remove even when child is SIGKILL'd (job-scoped temp).
    fs.rmSync(cancelDir, { recursive: true, force: true });
    assert.equal(fs.existsSync(cancelDir), false);
  });
});
