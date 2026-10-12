import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  embeddedSecretConfigurationError,
  normalizeBearerToken,
  resolveRequestAuth,
} from '../src/utils/authResolution';

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

  it('BEARER strips a leading Bearer prefix so the header has exactly one', async () => {
    process.env.API_TOKEN = 'Bearer already-prefixed-token';
    const result = await resolveRequestAuth('BEARER');
    assert.equal(result.headers.Authorization, 'Bearer already-prefixed-token');
    assert.equal(result.headers.Authorization.startsWith('Bearer Bearer'), false);
  });

  it('BEARER strips repeated Bearer prefixes', async () => {
    process.env.API_TOKEN = 'Bearer Bearer double-prefixed';
    const result = await resolveRequestAuth('BEARER');
    assert.equal(result.headers.Authorization, 'Bearer double-prefixed');
  });

  it('BEARER rejects empty token after normalization without sending a request', async () => {
    process.env.API_TOKEN = 'Bearer   ';
    await assert.rejects(() => resolveRequestAuth('BEARER'), /no token is available/);
  });

  it('normalizeBearerToken never returns a Bearer prefix', () => {
    assert.equal(normalizeBearerToken('raw-token'), 'raw-token');
    assert.equal(normalizeBearerToken('Bearer raw-token'), 'raw-token');
    assert.equal(normalizeBearerToken('  bearer   x  '), 'x');
    assert.equal(normalizeBearerToken('Bearer'), '');
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

  it('API_KEY header name from the feature uses the credential value', async () => {
    process.env.API_KEY_VALUE = 'dummy-api-key';
    process.env.API_KEY_HEADER = 'X-Other';
    const result = await resolveRequestAuth('API_KEY', { apiKeyHeader: 'X-API-Key' });
    assert.equal(result.headers['X-API-Key'], 'dummy-api-key');
    assert.equal(result.headers['X-Other'], undefined);
  });

  it('missing BEARER credential fails closed without sending a request', async () => {
    await assert.rejects(() => resolveRequestAuth('BEARER'), /Credential Profile/);
  });

  it('missing API_KEY credential fails closed', async () => {
    await assert.rejects(() => resolveRequestAuth('API_KEY'), /API_KEY_VALUE/);
    await assert.rejects(() => resolveRequestAuth('API_KEY'), /request was not sent/i);
  });

  it('embedded secret with auth mode NONE is a configuration error', () => {
    const error = embeddedSecretConfigurationError(['X-API-Key']);
    assert.match(error.message, /X-API-Key/);
    assert.match(error.message, /request was not sent/i);
    assert.equal(error.message.includes('synthetic-partner-key-value'), false);
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
