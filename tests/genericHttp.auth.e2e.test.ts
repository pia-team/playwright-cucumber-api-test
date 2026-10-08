import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'http';
import { AddressInfo } from 'net';
import { resolveRequestAuth } from '../src/utils/authResolution';
import { redactHeaders, redactBody } from '../src/utils/httpEvidence';

/**
 * Local mock HTTP server + auth resolution — verifies Bearer/Basic/API_KEY
 * actually reach the wire without logging secrets.
 */
describe('generic HTTP auth against local mock server', () => {
  let server: http.Server;
  let baseUrl = '';
  const seen: Array<{ auth?: string; apiKey?: string; url: string }> = [];
  const prev: Record<string, string | undefined> = {};

  before(async () => {
    for (const k of ['API_TOKEN', 'API_BASIC_USERNAME', 'API_BASIC_PASSWORD', 'API_KEY_VALUE', 'API_KEY_HEADER', 'API_KEY_PLACEMENT', 'API_KEY_QUERY']) {
      prev[k] = process.env[k];
    }
    server = http.createServer((req, res) => {
      const auth = req.headers.authorization;
      const apiKey = (req.headers['x-api-key'] as string) || undefined;
      seen.push({ auth, apiKey, url: req.url || '' });
      if (req.url?.startsWith('/login')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ access_token: 'synthetic-runtime-token-xyz' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sends Bearer from API_TOKEN and redacts evidence', async () => {
    seen.length = 0;
    process.env.API_TOKEN = 'synthetic-bearer-abc';
    const auth = await resolveRequestAuth('BEARER');
    const res = await fetch(`${baseUrl}/secure`, { headers: auth.headers });
    assert.equal(res.status, 200);
    assert.equal(seen[0]?.auth, 'Bearer synthetic-bearer-abc');
    const redacted = redactHeaders({ Authorization: seen[0]!.auth! });
    assert.equal(redacted.Authorization, '[REDACTED]');
    assert.ok(!JSON.stringify(redacted).includes('synthetic-bearer-abc'));
  });

  it('sends Basic auth without leaking password in redacted body patterns', async () => {
    seen.length = 0;
    process.env.API_BASIC_USERNAME = 'demo';
    process.env.API_BASIC_PASSWORD = 'synthetic-basic-pass';
    const auth = await resolveRequestAuth('BASIC');
    const res = await fetch(`${baseUrl}/secure`, { headers: auth.headers });
    assert.equal(res.status, 200);
    assert.ok(seen[0]?.auth?.startsWith('Basic '));
    const redacted = redactHeaders({ Authorization: seen[0]!.auth! });
    assert.equal(redacted.Authorization, '[REDACTED]');
  });

  it('sends API_KEY header', async () => {
    seen.length = 0;
    process.env.API_KEY_VALUE = 'synthetic-api-key';
    process.env.API_KEY_HEADER = 'X-API-Key';
    process.env.API_KEY_PLACEMENT = 'header';
    const auth = await resolveRequestAuth('API_KEY');
    const res = await fetch(`${baseUrl}/secure`, { headers: auth.headers });
    assert.equal(res.status, 200);
    assert.equal(seen[0]?.apiKey, 'synthetic-api-key');
  });

  it('runtime token reuse: login response token used as Bearer on next call', async () => {
    seen.length = 0;
    const login = await fetch(`${baseUrl}/login`);
    const body = (await login.json()) as { access_token: string };
    assert.equal(body.access_token, 'synthetic-runtime-token-xyz');
    const evidenceBody = redactBody(JSON.stringify(body));
    assert.ok(evidenceBody);
    assert.ok(!evidenceBody!.includes('synthetic-runtime-token-xyz') || evidenceBody!.includes('[REDACTED]'));

    process.env.API_TOKEN = body.access_token;
    const auth = await resolveRequestAuth('BEARER');
    await fetch(`${baseUrl}/secure`, { headers: auth.headers });
    assert.equal(seen.at(-1)?.auth, `Bearer ${body.access_token}`);
  });
});
