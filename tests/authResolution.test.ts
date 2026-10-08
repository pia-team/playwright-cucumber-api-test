import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRequestAuth } from '../src/utils/authResolution';

const ENV_KEYS = [
  'API_TOKEN',
  'API_BASIC_USERNAME',
  'API_BASIC_PASSWORD',
  'API_KEY_VALUE',
  'API_KEY_HEADER',
  'API_KEY_QUERY',
  'API_KEY_PLACEMENT',
  'COTESTER_RUNTIME_CREDENTIALS_FILE',
] as const;

const savedEnv: Record<string, string | undefined> = {};

function snapshotEnv(): void {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
}

describe('resolveRequestAuth', () => {
  beforeEach(() => snapshotEnv());
  afterEach(() => restoreEnv());

  it('NONE returns empty headers and query', async () => {
    const result = await resolveRequestAuth('NONE');
    assert.deepEqual(result, { headers: {}, query: {} });
  });

  it('BEARER uses API_TOKEN from env', async () => {
    process.env.API_TOKEN = 'dummy-bearer-token';
    const result = await resolveRequestAuth('BEARER');
    assert.equal(result.headers.Authorization, 'Bearer dummy-bearer-token');
    assert.deepEqual(result.query, {});
  });

  it('BEARER prefers step-level bearerToken over env', async () => {
    process.env.API_TOKEN = 'env-token';
    const result = await resolveRequestAuth('BEARER', { bearerToken: 'step-token' });
    assert.equal(result.headers.Authorization, 'Bearer step-token');
  });

  it('BASIC encodes username and password', async () => {
    process.env.API_BASIC_USERNAME = 'user';
    process.env.API_BASIC_PASSWORD = 'pass';
    const result = await resolveRequestAuth('BASIC');
    const expected = Buffer.from('user:pass', 'utf-8').toString('base64');
    assert.equal(result.headers.Authorization, `Basic ${expected}`);
    assert.deepEqual(result.query, {});
  });

  it('API_KEY applies custom header', async () => {
    process.env.API_KEY_VALUE = 'dummy-api-key';
    process.env.API_KEY_HEADER = 'X-Custom-Key';
    process.env.API_KEY_PLACEMENT = 'header';
    const result = await resolveRequestAuth('API_KEY');
    assert.equal(result.headers['X-Custom-Key'], 'dummy-api-key');
    assert.deepEqual(result.query, {});
  });

  it('API_KEY applies query param when placement is query', async () => {
    process.env.API_KEY_VALUE = 'dummy-query-key';
    process.env.API_KEY_PLACEMENT = 'query';
    process.env.API_KEY_QUERY = 'access_key';
    const result = await resolveRequestAuth('API_KEY');
    assert.deepEqual(result.headers, {});
    assert.deepEqual(result.query, { access_key: 'dummy-query-key' });
  });
});
