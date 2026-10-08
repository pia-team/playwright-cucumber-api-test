import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactBody, redactHeaders } from '../src/utils/httpEvidence';

describe('httpEvidence redaction', () => {
  const savedApiKeyHeader = process.env.API_KEY_HEADER;

  beforeEach(() => {
    delete process.env.API_KEY_HEADER;
  });

  afterEach(() => {
    if (savedApiKeyHeader === undefined) {
      delete process.env.API_KEY_HEADER;
    } else {
      process.env.API_KEY_HEADER = savedApiKeyHeader;
    }
  });

  it('redactHeaders masks Authorization Bearer tokens', () => {
    const redacted = redactHeaders({
      Authorization: 'Bearer super-secret-jwt',
      'Content-Type': 'application/json',
    });
    assert.equal(redacted.Authorization, '[REDACTED]');
    assert.equal(redacted['Content-Type'], 'application/json');
    const serialized = JSON.stringify(redacted);
    assert.ok(!serialized.includes('super-secret-jwt'));
    assert.ok(!serialized.includes('Bearer super-secret'));
  });

  it('redactHeaders masks default and custom API key headers', () => {
    const defaultKey = redactHeaders({ 'X-API-Key': 'key-12345' });
    assert.equal(defaultKey['X-API-Key'], '[REDACTED]');
    assert.ok(!JSON.stringify(defaultKey).includes('key-12345'));

    process.env.API_KEY_HEADER = 'X-Partner-Key';
    const customKey = redactHeaders({ 'X-Partner-Key': 'partner-secret' });
    assert.equal(customKey['X-Partner-Key'], '[REDACTED]');
    assert.ok(!JSON.stringify(customKey).includes('partner-secret'));
  });

  it('redactBody masks bearer tokens and sensitive JSON keys', () => {
    const textBody = redactBody('Token: Bearer abc.def.ghi');
    assert.ok(textBody);
    assert.ok(!textBody!.includes('abc.def.ghi'));
    assert.match(textBody!, /Bearer \[REDACTED\]/);

    const jsonBody = redactBody(JSON.stringify({ api_key: 'leak-me', name: 'visible' }));
    assert.ok(jsonBody);
    assert.ok(!jsonBody!.includes('leak-me'));
    assert.ok(jsonBody!.includes('visible'));
  });
});
