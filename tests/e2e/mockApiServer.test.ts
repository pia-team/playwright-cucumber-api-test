import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { MOCK_SYNTHETIC_ACCESS_TOKEN, startMockApiServer } from './mockApiServer';

describe('local mock API server + OpenAPI fixtures', () => {
  let baseUrl = '';
  let close: () => Promise<void>;

  before(async () => {
    const server = await startMockApiServer();
    baseUrl = server.baseUrl;
    close = server.close;
  });

  after(async () => {
    await close();
  });

  it('OpenAPI JSON fixture lists core paths', () => {
    const fixture = path.join(__dirname, 'fixtures/mock-api.openapi.json');
    const spec = JSON.parse(fs.readFileSync(fixture, 'utf-8')) as { paths: Record<string, unknown> };
    for (const p of ['/users', '/auth/token', '/protected', '/invalid-response']) {
      assert.ok(spec.paths[p], `missing path ${p}`);
    }
  });

  it('POST /auth/token and GET /protected enforce Bearer', async () => {
    const tokenRes = await fetch(`${baseUrl}/auth/token`, { method: 'POST' });
    assert.equal(tokenRes.status, 200);
    const tokenBody = (await tokenRes.json()) as { access_token: string };
    assert.equal(tokenBody.access_token, MOCK_SYNTHETIC_ACCESS_TOKEN);

    const unauth = await fetch(`${baseUrl}/protected`);
    assert.equal(unauth.status, 401);

    const ok = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Bearer ${MOCK_SYNTHETIC_ACCESS_TOKEN}` },
    });
    assert.equal(ok.status, 200);
  });

  it('CRUD /users endpoints respond with expected status codes', async () => {
    const list = await fetch(`${baseUrl}/users`);
    assert.equal(list.status, 200);

    const create = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', email: 'bob@example.com' }),
    });
    assert.equal(create.status, 201);
    const created = (await create.json()) as { id: string };
    assert.ok(created.id);

    const patch = await fetch(`${baseUrl}/users/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bob II' }),
    });
    assert.equal(patch.status, 200);

    const del = await fetch(`${baseUrl}/users/${created.id}`, { method: 'DELETE' });
    assert.equal(del.status, 204);
  });
});
