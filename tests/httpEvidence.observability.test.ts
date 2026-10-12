import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  beginHttpEvidence,
  bodyLimit,
  buildHttpAttachmentBundle,
  buildResolvedUrl,
  evidenceForAttach,
  looksBinary,
  MAX_BODY,
  redactBody,
  redactHeaders,
  redactQueryMap,
  redactUrl,
  resetHttpEvidence,
  sanitizeBody,
} from '../src/utils/httpEvidence';

describe('httpEvidence observability', () => {
  const savedFull = process.env.COTESTER_HTTP_EVIDENCE_FULL_BODY;

  beforeEach(() => {
    resetHttpEvidence();
    delete process.env.COTESTER_HTTP_EVIDENCE_FULL_BODY;
  });

  afterEach(() => {
    if (savedFull === undefined) delete process.env.COTESTER_HTTP_EVIDENCE_FULL_BODY;
    else process.env.COTESTER_HTTP_EVIDENCE_FULL_BODY = savedFull;
    resetHttpEvidence();
  });

  it('buildResolvedUrl appends query parameters without dropping repeats', () => {
    assert.equal(buildResolvedUrl('/items', { id: 'abc', limit: '10' }), '/items?id=abc&limit=10');
    assert.equal(buildResolvedUrl('/items?x=1', { y: '2' }), '/items?x=1&y=2');
  });

  it('success bundle includes resolved URL, duration, and redacted secrets', () => {
    beginHttpEvidence({
      method: 'GET',
      url: buildResolvedUrl('/lookup', {
        id: '11111111-2222-4333-8444-555555555555',
        api_key: 'leak-me',
      }),
      path: '/lookup',
      query: { id: '11111111-2222-4333-8444-555555555555', api_key: 'leak-me' },
      requestHeaders: {
        Authorization: 'Bearer super-secret-jwt',
        Accept: 'application/json',
      },
      requestBody: null,
      requestBodyKind: 'empty',
      responseStatus: 200,
      responseHeaders: { 'content-type': 'application/json' },
      responseBody: JSON.stringify({ ok: true, token: 'resp-secret' }),
      authMode: 'BEARER',
      durationMs: 42,
      requestTimestamp: '2026-01-01T00:00:00.000Z',
    });

    const bundle = buildHttpAttachmentBundle();
    assert.ok(bundle);
    const summary = JSON.parse(bundle!.summary);
    const request = JSON.parse(bundle!.request);
    const response = JSON.parse(bundle!.response);

    assert.equal(summary.method, 'GET');
    assert.equal(summary.durationMs, 42);
    assert.match(summary.url, /id=11111111-2222-4333-8444-555555555555/);
    assert.equal(summary.url.includes('leak-me'), false);
    assert.equal(request.headers.Authorization, '[REDACTED]');
    assert.equal(request.query.api_key, '[REDACTED]');
    assert.match(request.query.id, /^11111111-/);
    assert.equal(response.status, 200);
    assert.equal(JSON.stringify(response).includes('resp-secret'), false);
    assert.match(response.body, /"ok": true/);
  });

  it('POST JSON body is pretty-printed and password keys are redacted', () => {
    beginHttpEvidence({
      method: 'POST',
      url: '/customers',
      path: '/customers',
      requestHeaders: { 'Content-Type': 'application/json' },
      requestBody: JSON.stringify({ name: 'Ada', password: 'p@ss' }),
      responseStatus: 201,
      responseBody: '{"id":"1"}',
      authMode: 'NONE',
      durationMs: 12,
    });
    const request = JSON.parse(buildHttpAttachmentBundle()!.request);
    assert.match(request.body, /"name": "Ada"/);
    assert.equal(request.body.includes('p@ss'), false);
    assert.equal(request.bodyKind, 'json');
  });

  it('truncates large bodies and omits binary payloads', () => {
    const large = 'x'.repeat(MAX_BODY + 100);
    const truncated = sanitizeBody(large);
    assert.equal(truncated.truncated, true);
    assert.match(truncated.text || '', /truncated/);

    const binary = `hello\u0000world${Buffer.alloc(40, 1).toString('binary')}`;
    assert.equal(looksBinary(binary), true);
    const omitted = sanitizeBody(binary);
    assert.equal(omitted.kind, 'binary');
    assert.match(omitted.text || '', /binary omitted/);
  });

  it('bodyLimit expands only when COTESTER_HTTP_EVIDENCE_FULL_BODY=1', () => {
    assert.equal(bodyLimit(), MAX_BODY);
    process.env.COTESTER_HTTP_EVIDENCE_FULL_BODY = '1';
    assert.equal(bodyLimit(), 64 * 1024);
  });

  it('legacy evidenceForAttach remains secret-safe', () => {
    beginHttpEvidence({
      method: 'GET',
      url: '/x?api_key=secret-key',
      requestHeaders: { Cookie: 'a=b' },
      responseStatus: 200,
      authMode: 'NONE',
    });
    const compact = evidenceForAttach(false)!;
    assert.equal(compact.includes('secret-key'), false);
    assert.match(compact, /"method": "GET"/);
  });

  it('redact helpers keep non-secret fields', () => {
    assert.equal(redactHeaders({ Accept: 'application/json' }).Accept, 'application/json');
    assert.equal(redactQueryMap({ page: '1', token: 'x' }).page, '1');
    assert.equal(redactQueryMap({ page: '1', token: 'x' }).token, '[REDACTED]');
    assert.match(redactUrl('/a?page=1&token=x'), /page=1/);
    assert.equal(redactBody('{"password":"x","n":1}')!.includes('x'), false);
  });
});
