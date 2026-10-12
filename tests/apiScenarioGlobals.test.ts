import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetApiHttpScenarioGlobals } from '../src/utils/apiScenarioGlobals';

describe('resetApiHttpScenarioGlobals', () => {
  beforeEach(() => {
    resetApiHttpScenarioGlobals();
  });

  it('clears HTTP auth/header/response state so a later scenario cannot read prior values', () => {
    const g = global as any;
    g.__cotesterGenericHttp = {
      authMode: 'BEARER',
      bearerToken: 'leak-token',
      headers: { 'X-Customer': '123' },
      query: { ref: '123' },
      body: '{"email":"a@example.com"}',
      contentType: 'application/json',
      embeddedSecretHeaders: [],
    };
    g.__cotesterChainMode = true;
    g.__cotesterStepId = 's1';
    g.__cotesterStepBlocked = 'blocked';
    g.__cotesterPendingExtracts = ['$.id'];
    g.__cotesterRedactValues = ['secret'];
    g.currentResponse = { status: () => 200 };
    g.__cotesterResponseJson = { id: 123 };
    g.__cotesterResponseBodyText = '{"id":123}';
    g.__cotesterElapsedMs = 42;
    g.__cotesterHttpEvidence = { method: 'POST', url: '/customers' };

    resetApiHttpScenarioGlobals();

    assert.equal(g.__cotesterGenericHttp, undefined);
    assert.equal(g.__cotesterChainMode, false);
    assert.equal(g.__cotesterStepId, '');
    assert.equal(g.__cotesterStepBlocked, '');
    assert.deepEqual(g.__cotesterPendingExtracts, []);
    assert.deepEqual(g.__cotesterRedactValues, []);
    assert.equal(g.currentResponse, undefined);
    assert.equal(g.__cotesterResponseJson, undefined);
    assert.equal(g.__cotesterResponseBodyText, null);
    assert.equal(g.__cotesterElapsedMs, undefined);
    assert.equal(g.__cotesterHttpEvidence, undefined);
  });

  it('documents sequential-only safety: two sequential resets do not share leftover state', () => {
    const g = global as any;
    // Scenario A
    g.__cotesterGenericHttp = { authMode: 'BEARER', bearerToken: 'token-a', headers: {}, query: {}, body: null, contentType: null, embeddedSecretHeaders: [] };
    g.__cotesterResponseJson = { email: 'a@example.com' };
    resetApiHttpScenarioGlobals();
    assert.equal(g.__cotesterGenericHttp, undefined);
    assert.equal(g.__cotesterResponseJson, undefined);

    // Scenario B starts clean
    g.__cotesterGenericHttp = { authMode: 'NONE', headers: {}, query: {}, body: null, contentType: null, embeddedSecretHeaders: [] };
    assert.notEqual(g.__cotesterGenericHttp.bearerToken, 'token-a');
    resetApiHttpScenarioGlobals();
    assert.equal(g.__cotesterGenericHttp, undefined);
  });
});
