import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { acquireTokenFromCurlCredential, isTokenCurlCredential } from '../src/utils/tokenCurlAuth';
import { resetRuntimeCredentialsCacheForTests } from '../src/utils/runtimeCredentials';

describe('tokenCurlAuth', () => {
  let server: http.Server;
  let baseUrl = '';
  let credFile = '';
  const prev: Record<string, string | undefined> = {};

  before(async () => {
    for (const k of ['COTESTER_RUNTIME_CREDENTIALS_FILE', 'COTESTER_TOKEN_CURL', 'API_TOKEN', 'COTESTER_API_BASE_URL']) {
      prev[k] = process.env[k];
    }
    server = http.createServer((req, res) => {
      if (req.url === '/token' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          if (body.includes('password=good-secret') && body.includes('username=alice')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ access_token: 'mock-access-token-value' }));
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_grant' }));
          }
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    if (credFile) {
      try {
        fs.unlinkSync(credFile);
      } catch {
        /* ignore */
      }
    }
    resetRuntimeCredentialsCacheForTests();
  });

  function writeCred(secrets: Record<string, string>) {
    resetRuntimeCredentialsCacheForTests();
    credFile = path.join(os.tmpdir(), `cotester-token-curl-${Date.now()}.json`);
    fs.writeFileSync(
      credFile,
      JSON.stringify({ type: 'TOKEN_CURL', secrets }),
      'utf8',
    );
    process.env.COTESTER_RUNTIME_CREDENTIALS_FILE = credFile;
    process.env.COTESTER_TOKEN_CURL = '1';
    process.env.COTESTER_API_BASE_URL = baseUrl;
    delete process.env.API_TOKEN;
  }

  it('acquires token from mock endpoint with placeholder resolution', async () => {
    writeCred({
      tokenMethod: 'POST',
      tokenUrl: `${baseUrl}/token`,
      tokenBody: 'grant_type=password&username={{username}}&password={{password}}',
      tokenJsonPath: '$.access_token',
      username: 'alice',
      password: 'good-secret',
    });
    assert.equal(isTokenCurlCredential(), true);
    const token = await acquireTokenFromCurlCredential();
    assert.equal(token, 'mock-access-token-value');
    assert.equal(process.env.API_TOKEN, 'mock-access-token-value');
  });

  it('rejects missing password placeholder binding without leaking values', async () => {
    writeCred({
      tokenMethod: 'POST',
      tokenUrl: `${baseUrl}/token`,
      tokenBody: 'password={{password}}',
      tokenJsonPath: '$.access_token',
      username: 'alice',
    });
    await assert.rejects(
      () => acquireTokenFromCurlCredential(),
      (err: Error) => {
        assert.match(err.message, /password/);
        assert.doesNotMatch(err.message, /good-secret/);
        return true;
      },
    );
  });

  it('rejects masked password', async () => {
    writeCred({
      tokenMethod: 'POST',
      tokenUrl: `${baseUrl}/token`,
      tokenBody: 'password={{password}}',
      tokenJsonPath: '$.access_token',
      password: '[REDACTED]',
    });
    await assert.rejects(() => acquireTokenFromCurlCredential(), /required|masked|password/i);
  });
});
