import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateRuntimeValue } from '../src/utils/runtimeGenerate';

describe('generateRuntimeValue', () => {
  it('produces faker email and fullName', () => {
    const email = generateRuntimeValue('email');
    assert.match(email, /@example\.com$/);
    const name = generateRuntimeValue('fullName');
    assert.ok(name.includes(' '));
  });

  it('produces username and phoneNumber', () => {
    assert.match(generateRuntimeValue('username'), /^[a-z0-9]+$/i);
    assert.match(generateRuntimeValue('phoneNumber'), /^555\d{7}$/);
  });

  it('produces uuid', () => {
    assert.match(generateRuntimeValue('uuid'), /^[0-9a-f-]{36}$/i);
  });

  it('produces numeric and alphanumeric of requested length', () => {
    assert.match(generateRuntimeValue('numeric:6'), /^\d{6}$/);
    assert.match(generateRuntimeValue('alphanumeric:10'), /^[A-Za-z0-9]{10}$/);
    assert.match(generateRuntimeValue('alphanumeric:8:alpha'), /^[A-Za-z]{8}$/);
  });

  it('produces clock-biased pattern values', () => {
    assert.match(generateRuntimeValue('pattern:TEST######'), /^TEST\d{6}$/);
  });

  it('produces timestamp defaults and formats', () => {
    assert.match(generateRuntimeValue('timestamp'), /^\d+$/);
    assert.match(generateRuntimeValue('timestamp:iso'), /T/);
    assert.match(generateRuntimeValue('timestamp:isoDate'), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('keeps independent variables distinct and reuses a stored value conceptually', () => {
    const a = generateRuntimeValue('email');
    const b = generateRuntimeValue('email');
    // Two generator calls produce independent values (store/reuse is scenarioVars' job).
    assert.notEqual(a, b);
    const code1 = generateRuntimeValue('pattern:TEST######');
    const code2 = generateRuntimeValue('uuid');
    assert.notEqual(code1, code2);
  });

  it('rejects unsupported specs and invalid parameters without silent coercion', () => {
    assert.throws(() => generateRuntimeValue('city'), /Unsupported/);
    assert.throws(() => generateRuntimeValue('userName'), /Unsupported/);
    assert.throws(() => generateRuntimeValue('phone'), /Unsupported/);
    assert.throws(() => generateRuntimeValue('pattern:'), /non-empty pattern/);
    assert.throws(() => generateRuntimeValue('pattern:HELLO'), /# or \?/);
    assert.throws(() => generateRuntimeValue('numeric:0'), /positive integer/);
    assert.throws(() => generateRuntimeValue('numeric:-1'), /positive integer/);
    assert.throws(() => generateRuntimeValue('alphanumeric:0'), /positive integer/);
    assert.throws(() => generateRuntimeValue('alphanumeric:10:hex'), /charset/);
    assert.throws(() => generateRuntimeValue('timestamp:rfc822'), /timestamp format/);
    assert.throws(() => generateRuntimeValue(''), /must not be empty/);
  });
});
