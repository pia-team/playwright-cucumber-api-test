import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAFE_JSON_PATH,
  hasInvalidPlaceholder,
  missingPlaceholders,
  redactStoredValues,
  resolveJsonPath,
  substituteTemplates,
} from '../src/utils/scenarioTemplate';

describe('scenario templates', () => {
  const vars = { customerId: '123' };

  it('fills a path, query, header and JSON body', () => {
    assert.equal(substituteTemplates('/customers/{{customerId}}', vars, true), '/customers/123');
    assert.equal(substituteTemplates('{{customerId}}', vars, false), '123');
    assert.equal(
      substituteTemplates('{"echo":"{{customerId}}"}', vars, false),
      '{"echo":"123"}',
    );
  });

  it('reports a missing variable and rejects an unsafe placeholder', () => {
    assert.deepEqual(missingPlaceholders('/customers/{{customerId}}', {}), ['customerId']);
    assert.equal(hasInvalidPlaceholder('/customers/{{a-b}}'), true);
    assert.equal(hasInvalidPlaceholder('/customers/{{customerId}}'), false);
  });

  it('redacts a stored value without evaluating it', () => {
    assert.equal(redactStoredValues('/customers/super-secret-token-value', ['super-secret-token-value']), '/customers/[REDACTED]');
    assert.equal(substituteTemplates('{{customerId}}', { customerId: 'a"b' }, false), 'a\\"b');
  });

  it('accepts relative order.id paths', () => {
    assert.equal(SAFE_JSON_PATH.test('order.id'), true);
    assert.equal(SAFE_JSON_PATH.test('$.order.id'), true);
    assert.equal(SAFE_JSON_PATH.test('$[0].order.id'), true);
    assert.equal(SAFE_JSON_PATH.test('order..id'), false);
  });

  it('resolves order.id on a single object and on batch arrays (SUCCESS first)', () => {
    const one = { order: { id: 'solo' }, status: 'SUCCESS' };
    assert.equal(resolveJsonPath(one, 'order.id'), 'solo');

    const batch = [
      { index: 0, status: 'FAILED', order: { id: 'fail-id' } },
      { index: 1, status: 'SUCCESS', order: { id: 'ok-id' } },
      { index: 2, status: 'SUCCESS', order: { id: 'second-ok' } },
    ];
    assert.equal(resolveJsonPath(batch, 'order.id'), 'ok-id');
    assert.equal(resolveJsonPath(batch, '$[0].order.id'), 'fail-id');
  });
});
