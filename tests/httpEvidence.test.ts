import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasUnredactedSensitivePairs,
  redactBody,
  redactFormUrlEncoded,
  redactHeaders,
  redactUrl,
  sanitizeBody,
} from '../src/utils/httpEvidence';
import { LogLevel, Logger } from '../src/utils/logger';

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

  it('redacts cookie and proxy authorization without dropping content type', () => {
    const redacted = redactHeaders({
      Cookie: 'session=synthetic-cookie-value',
      'Proxy-Authorization': 'Basic c3ludGhldGlj',
      'Content-Type': 'application/json',
    });
    const serialized = JSON.stringify(redacted);
    assert.equal(redacted.Cookie, '[REDACTED]');
    assert.equal(redacted['Proxy-Authorization'], '[REDACTED]');
    assert.equal(redacted['Content-Type'], 'application/json');
    assert.equal(serialized.includes('synthetic-cookie-value'), false);
    assert.equal(serialized.includes('c3ludGhldGlj'), false);
  });

  it('redactUrl hides api_key query values', () => {
    const redacted = redactUrl('https://api.example.com/items?api_key=synthetic-partner-key-value&page=1');
    assert.equal(redacted.includes('synthetic-partner-key-value'), false);
    assert.match(redacted, /page=1/);
  });

  it('logger does not print API key or bearer values', () => {
    const lines: string[] = [];
    const originalDebug = console.debug;
    const originalLog = console.log;
    console.debug = (message?: unknown) => {
      lines.push(String(message));
    };
    console.log = (message?: unknown) => {
      lines.push(String(message));
    };
    Logger.setLogLevel(LogLevel.DEBUG);
    try {
      Logger.logRequest('GET', 'https://api.example.com/items?api_key=synthetic-partner-key-value', {
        'X-API-Key': 'synthetic-partner-key-value',
        Authorization: 'Bearer super-secret-jwt',
        Accept: 'application/json',
      });
    } finally {
      Logger.setLogLevel(LogLevel.INFO);
      console.debug = originalDebug;
      console.log = originalLog;
    }
    const text = lines.join('\n');
    assert.equal(text.includes('synthetic-partner-key-value'), false);
    assert.equal(text.includes('super-secret-jwt'), false);
    assert.match(text, /application\/json/);
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

  it('redacts form-urlencoded password and client_secret while keeping grant_type', () => {
    const form =
      'password=secret123&client_secret=abc123&grant_type=password&username=ada';
    const redacted = redactFormUrlEncoded(form);
    assert.ok(redacted);
    assert.equal(redacted!.includes('secret123'), false);
    assert.equal(redacted!.includes('abc123'), false);
    assert.match(redacted!, /grant_type=password/);
    assert.match(redacted!, /username=ada/);
    assert.match(redacted!, /password=\[REDACTED\]/);
    assert.match(redacted!, /client_secret=\[REDACTED\]/);

    const sanitized = sanitizeBody(form);
    assert.equal(sanitized.text?.includes('secret123'), false);
    assert.equal(sanitized.text?.includes('abc123'), false);
    assert.match(sanitized.text || '', /grant_type=password/);
  });

  it('redacts form keys case-insensitively and with URL-encoded values', () => {
    const form =
      'Password=p%40ss%26word&CLIENT_SECRET=x%3Dy&grant_type=password&Password=second';
    const redacted = sanitizeBody(form).text || '';
    assert.equal(redacted.includes('p%40ss'), false);
    assert.equal(redacted.includes('x%3Dy'), false);
    assert.equal(redacted.includes('second'), false);
    assert.match(redacted, /grant_type=password/);
    assert.equal((redacted.match(/Password=\[REDACTED\]/gi) || []).length, 2);
  });

  it('redacts nested JSON token fields', () => {
    const body = JSON.stringify({
      ok: true,
      nested: { access_token: 'tok-aaa', meta: { client_secret: 'cs' } },
    });
    const text = sanitizeBody(body).text || '';
    assert.equal(text.includes('tok-aaa'), false);
    assert.equal(text.includes('"cs"'), false);
    assert.match(text, /"ok": true/);
  });

  it('fail-closes when sensitive pairs remain unredacted', () => {
    assert.equal(hasUnredactedSensitivePairs('password=still-here'), true);
    assert.equal(hasUnredactedSensitivePairs('password=[REDACTED]'), false);
  });
});
