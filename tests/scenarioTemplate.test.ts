import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasInvalidPlaceholder,
  missingPlaceholders,
  redactStoredValues,
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
});
