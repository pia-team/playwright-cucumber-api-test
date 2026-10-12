import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertCriterion,
  evaluateCriterion,
  formatCriterionFailure,
  locate,
  scenarioFailureMessage,
  tokenizeJsonPath,
} from '../src/utils/assertionChecks';
import { startMockApiServer } from './e2e/mockApiServer';

const ctx = (json: unknown, extra: Record<string, unknown> = {}) => ({
  responseAvailable: true,
  json,
  headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'abc' },
  elapsedMs: 120,
  requestJson: { taxNumber: '100' },
  requestQuery: {},
  ...extra,
});

describe('approved API assertions', () => {
  it('field_exists passes when present and fails when missing or null', () => {
    const present = evaluateCriterion(
      { description: 'Response içinde taxNumber bulunmalı', type: 'field_exists', path: '$.taxNumber' },
      ctx({ taxNumber: '100' }),
    );
    assert.equal(present.status, 'PASS');

    const missing = evaluateCriterion(
      { description: 'Response içinde taxNumber bulunmalı', type: 'field_exists', path: '$.taxNumber' },
      ctx({ id: 'user-42' }),
    );
    assert.equal(missing.status, 'FAIL');
    assert.equal(missing.actual, 'Alan bulunamadı');
    assert.match(formatCriterionFailure(missing), /taxNumber bulunmalı/);
    assert.match(formatCriterionFailure(missing), /Path: \$\.taxNumber/);

    const nulled = evaluateCriterion(
      { description: 'taxNumber', type: 'field_exists', path: '$.taxNumber' },
      ctx({ taxNumber: null }),
    );
    assert.equal(nulled.status, 'FAIL');
    assert.equal(nulled.actual, 'null');
  });

  it('field_equals is type safe', () => {
    assert.equal(
      evaluateCriterion({ description: 'n', type: 'field_equals', path: '$.n', expected: 1 }, ctx({ n: 1 })).status,
      'PASS',
    );
    assert.equal(
      evaluateCriterion({ description: 'n', type: 'field_equals', path: '$.n', expected: '1' }, ctx({ n: 1 })).status,
      'FAIL',
    );
    assert.equal(
      evaluateCriterion({ description: 'ok', type: 'field_equals', path: '$.ok', expected: true }, ctx({ ok: true })).status,
      'PASS',
    );
    assert.equal(
      evaluateCriterion({ description: 'ok', type: 'field_equals', path: '$.ok', expected: 'true' }, ctx({ ok: true })).status,
      'FAIL',
    );
    assert.equal(
      evaluateCriterion({ description: 'v', type: 'field_equals', path: '$.v', expected: null }, ctx({ v: null })).status,
      'PASS',
    );
  });

  it('type_check separates string number boolean object array and null', () => {
    assert.equal(evaluateCriterion({ description: 't', type: 'type_check', path: '$.a', operator: 'array' }, ctx({ a: [] })).status, 'PASS');
    assert.equal(evaluateCriterion({ description: 't', type: 'type_check', path: '$.a', operator: 'object' }, ctx({ a: [] })).status, 'FAIL');
    assert.equal(evaluateCriterion({ description: 't', type: 'type_check', path: '$.n', operator: 'null' }, ctx({ n: null })).status, 'PASS');
    assert.equal(evaluateCriterion({ description: 't', type: 'type_check', path: '$.s', operator: 'string' }, ctx({ s: 'x' })).status, 'PASS');
    assert.equal(evaluateCriterion({ description: 't', type: 'type_check', path: '$.b', operator: 'boolean' }, ctx({ b: false })).status, 'PASS');
    assert.equal(evaluateCriterion({ description: 't', type: 'type_check', path: '$.n', operator: 'number' }, ctx({ n: 2 })).status, 'PASS');
  });

  it('non_empty checks arrays strings and objects', () => {
    assert.equal(evaluateCriterion({ description: 'items', type: 'non_empty', path: '$.items' }, ctx({ items: ['a'] })).status, 'PASS');
    assert.equal(evaluateCriterion({ description: 'items', type: 'non_empty', path: '$.items' }, ctx({ items: [] })).status, 'FAIL');
    assert.equal(evaluateCriterion({ description: 'name', type: 'non_empty', path: '$.name' }, ctx({ name: '' })).status, 'FAIL');
    assert.equal(evaluateCriterion({ description: 'obj', type: 'non_empty', path: '$.obj' }, ctx({ obj: {} })).status, 'FAIL');
    assert.equal(evaluateCriterion({ description: 'obj', type: 'non_empty', path: '$.obj' }, ctx({ obj: { a: 1 } })).status, 'PASS');
  });

  it('array contains some and every', () => {
    const body = { items: ['a', 'b'], rows: [{ name: 'IMSI' }, { name: 'ICCID' }] };
    assert.equal(evaluateCriterion({ description: 'c', type: 'array_contains', path: '$.items', expected: 'b' }, ctx(body)).status, 'PASS');
    assert.equal(evaluateCriterion({ description: 'c', type: 'array_contains', path: '$.items', expected: 'z' }, ctx(body)).status, 'FAIL');
    assert.equal(
      evaluateCriterion({ description: 's', type: 'array_some', path: '$.rows', expected: 'name=IMSI' }, ctx(body)).status,
      'PASS',
    );
    assert.equal(
      evaluateCriterion({ description: 'e', type: 'array_every', path: '$.rows', expected: 'name=IMSI' }, ctx(body)).status,
      'FAIL',
    );
    const empty = evaluateCriterion({ description: 'e', type: 'array_every', path: '$.rows', expected: 'name=IMSI' }, ctx({ rows: [] }));
    assert.equal(empty.status, 'FAIL');
    assert.match(empty.reason || '', /Boş dizi/);
  });

  it('request_response_eq compares the sent request value', () => {
    const ok = evaluateCriterion(
      { description: 'tax', type: 'request_response_eq', path: '$.taxNumber', expected: 'request.taxNumber' },
      ctx({ taxNumber: '100' }),
    );
    assert.equal(ok.status, 'PASS');
    const bad = evaluateCriterion(
      { description: 'tax', type: 'request_response_eq', path: '$.taxNumber', expected: 'request.taxNumber' },
      ctx({ taxNumber: '999' }),
    );
    assert.equal(bad.status, 'FAIL');
  });

  it('response_header is case insensitive for the name', () => {
    const ok = evaluateCriterion(
      { description: 'h', type: 'response_header', path: 'x-request-id', operator: 'eq', expected: 'abc' },
      ctx({}),
    );
    assert.equal(ok.status, 'PASS');
    const missing = evaluateCriterion(
      { description: 'h', type: 'response_header', path: 'X-Missing', operator: 'eq', expected: 'abc' },
      ctx({}),
    );
    assert.equal(missing.status, 'FAIL');
  });

  it('response_time compares measured milliseconds', () => {
    assert.equal(
      evaluateCriterion({ description: 't', type: 'response_time', operator: 'lt', expected: 2000 }, ctx({}, { elapsedMs: 120 })).status,
      'PASS',
    );
    assert.equal(
      evaluateCriterion({ description: 't', type: 'response_time', operator: 'lt', expected: 50 }, ctx({}, { elapsedMs: 120 })).status,
      'FAIL',
    );
  });

  it('schema validation is partial and rejects unsupported keywords', () => {
    const ok = evaluateCriterion(
      {
        description: 'schema',
        type: 'schema',
        path: '$',
        expected: { type: 'object', required: ['taxNumber'], properties: { taxNumber: { type: 'string' } } },
      },
      ctx({ taxNumber: '100' }),
    );
    assert.equal(ok.status, 'PASS');
    assert.match(ok.expected, /Kısmi şema/);
    const bad = evaluateCriterion(
      { description: 'schema', type: 'schema', expected: { type: 'object', $ref: '#/X' } },
      ctx({ taxNumber: '100' }),
    );
    assert.equal(bad.status, 'FAIL');
    assert.match(bad.reason || '', /tam JSON Schema değildir/);
  });

  it('a failed criterion throws and a missing response is not PASS', () => {
    assert.throws(
      () => assertCriterion({ description: 'Response içinde taxNumber bulunmalı', type: 'field_exists', path: '$.taxNumber' }, ctx({})),
      /Sonuç: FAIL/,
    );
    const offline = evaluateCriterion(
      { description: 'tax', type: 'field_exists', path: '$.taxNumber' },
      { responseAvailable: false },
    );
    assert.equal(offline.status, 'NOT_EVALUATED');
    assert.match(offline.reason || '', /PASS sayılmadı/);
    assert.throws(() => assertCriterion({ description: 'tax', type: 'field_exists', path: '$.taxNumber' }, { responseAvailable: false }));
  });

  it('keeps evaluating later criteria after a failure', () => {
    const first = evaluateCriterion(
      { id: 'a1', description: 'Response içinde taxNumber bulunmalı', type: 'field_exists', path: '$.taxNumber' },
      ctx({ items: ['a'] }),
    );
    const second = evaluateCriterion(
      { id: 'a2', description: 'items dolu olmalı', type: 'non_empty', path: '$.items' },
      ctx({ items: ['a'] }),
    );
    assert.equal(first.status, 'FAIL');
    assert.equal(second.status, 'PASS');
    const message = scenarioFailureMessage([first, second]);
    assert.ok(message);
    assert.match(message, /taxNumber bulunmalı/);
    assert.match(message, /Sonuç: FAIL/);
    assert.equal(message.includes('items dolu olmalı'), false);
    assert.equal(scenarioFailureMessage([second]), null);
  });

  it('locate resolves nested, indexed and quoted JSON paths', () => {
    const body = {
      customer: { name: 'Ada' },
      items: [{ category: 'SIM' }],
      'customer-name': 'dash',
    };
    assert.deepEqual(tokenizeJsonPath('$.items[0].category'), ['items', '0', 'category']);
    assert.deepEqual(tokenizeJsonPath("$['customer-name']"), ['customer-name']);
    assert.equal(locate(body, '$.customer.name').value, 'Ada');
    assert.equal(locate(body, '$.items[0].category').value, 'SIM');
    assert.equal(locate(body, "$['customer-name']").value, 'dash');
    assert.equal(locate(body, '$.items[9]').keyPresent, false);
    assert.equal(locate([{ category: 'SIM' }], '$[0].category').value, 'SIM');
    assert.equal(
      evaluateCriterion(
        { description: 'cat', type: 'array_every', path: '$', expected: 'category=SIM' },
        ctx([{ category: 'SIM' }, { category: 'SIM' }]),
      ).status,
      'PASS',
    );
    assert.equal(
      evaluateCriterion(
        { description: 'schema', type: 'schema', path: '$', expected: { type: 'object', required: ['customer'] } },
        ctx(body),
      ).status,
      'PASS',
    );
  });

  it('aggregates multiple FAIL criteria and ignores NOT_EVALUATED for scenario failure', () => {
    const a = evaluateCriterion(
      { id: 'a1', description: 'tax', type: 'field_exists', path: '$.taxNumber' },
      ctx({}),
    );
    const b = evaluateCriterion(
      { id: 'a2', description: 'items', type: 'non_empty', path: '$.items' },
      ctx({ items: [] }),
    );
    const skipped = {
      id: 'a3',
      description: 'skipped after 401',
      type: 'array_every',
      status: 'NOT_EVALUATED' as const,
      expected: '',
      actual: '',
      reason: 'HTTP status expectation failed; body assertion was not evaluated.',
    };
    assert.equal(a.status, 'FAIL');
    assert.equal(b.status, 'FAIL');
    const message = scenarioFailureMessage([a, b, skipped]);
    assert.ok(message);
    assert.match(message!, /tax/);
    assert.match(message!, /items/);
    assert.equal(message!.includes('skipped after 401'), false);
    assert.equal(scenarioFailureMessage([skipped]), null);
    const blockedStatus = {
      id: 'status:s1',
      description: 'blocked',
      type: 'status',
      status: 'NOT_EVALUATED' as const,
      expected: '200',
      actual: '',
      reason: 'Değişken çözümlenemedi. İstek gönderilmedi.',
    };
    assert.ok(scenarioFailureMessage([blockedStatus]));
  });

  it('does not print secret values', () => {
    const outcome = evaluateCriterion(
      { description: 'body', type: 'field_equals', path: '$', expected: { password: 'other' } },
      ctx({ password: 'hunter2-secret', taxNumber: '1' }),
    );
    const text = formatCriterionFailure(outcome);
    assert.equal(text.includes('hunter2-secret'), false);
    assert.match(text, /\[REDACTED\]/);
  });

  it('field_exists and response time use a real HTTP response', async () => {
    const server = await startMockApiServer();
    try {
      const started = Date.now();
      const response = await fetch(`${server.baseUrl}/users`);
      const elapsed = Date.now() - started;
      const json = await response.json();
      assert.equal(response.status, 200);
      const present = evaluateCriterion(
        { description: 'users alanı bulunmalı', type: 'field_exists', path: '$.users' },
        { responseAvailable: true, json, elapsedMs: elapsed, headers: {} },
      );
      assert.equal(present.status, 'PASS');
      const missing = evaluateCriterion(
        { description: 'Response içinde taxNumber bulunmalı', type: 'field_exists', path: '$.taxNumber' },
        { responseAvailable: true, json, elapsedMs: elapsed, headers: {} },
      );
      assert.equal(missing.status, 'FAIL');
      assert.equal(missing.actual, 'Alan bulunamadı');
      const time = evaluateCriterion(
        { description: 'süre', type: 'response_time', operator: 'lt', expected: 5000 },
        { responseAvailable: true, json, elapsedMs: elapsed, headers: {} },
      );
      assert.equal(time.status, 'PASS');
      assert.match(formatCriterionFailure(missing), /Sonuç: FAIL/);
    } finally {
      await server.close();
    }
  });

  it('runner and template engines match and do not call AI', () => {
    const runner = readFileSync(path.join(process.cwd(), 'src/utils/assertionChecks.ts'), 'utf8');
    const template = readFileSync(
      path.join(process.cwd(), '../runner-templates/api/src/utils/assertionChecks.ts'),
      'utf8',
    );
    assert.equal(runner, template);
    const step = readFileSync(
      path.join(process.cwd(), 'src/features/steps/common/genericHttp.step.ts'),
      'utf8',
    );
    const templateStep = readFileSync(
      path.join(process.cwd(), '../runner-templates/api/src/features/steps/common/genericHttp.step.ts'),
      'utf8',
    );
    assert.equal(step.includes('getAnswer'), false);
    assert.equal(templateStep.includes('getAnswer'), false);
    assert.match(step, /criterion \{string\} holds:/);
    assert.match(templateStep, /criterion \{string\} holds:/);
    assert.match(step, /scenarioFailureMessage/);
    assert.match(templateStep, /scenarioFailureMessage/);
    assert.match(step, /the API response status should be \{int\}/);
    assert.match(templateStep, /the API response status should be \{int\}/);
  });
});
