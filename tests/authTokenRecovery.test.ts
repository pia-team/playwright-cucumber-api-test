import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRecoveryEligibility,
  isSafeRetryMethod,
  type LastHttpSendSnapshot,
} from '../src/utils/authTokenRecovery';

function snap(partial: Partial<LastHttpSendSnapshot>): LastHttpSendSnapshot {
  return {
    method: 'GET',
    path: '/users',
    resolvedPath: '/users',
    resolvedUrl: 'http://example.test/users',
    headers: { Authorization: 'Bearer old' },
    params: {},
    bodyPayload: undefined,
    resolvedBody: null,
    isForm: false,
    authMode: 'BEARER',
    bearerFromScenarioVariable: 'access_token',
    managedFingerprint: 'a'.repeat(32),
    tokenGenerationUsed: 1,
    hadExplicitAuthorization: false,
    recoveryAttempted: false,
    ...partial,
  };
}

describe('authTokenRecovery eligibility', () => {
  it('Expected 200 / Actual 200 → no recovery', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 200,
      expectedStatus: 200,
      snapshot: snap({}),
    });
    assert.equal(r.eligible, false);
  });

  it('Expected 401 / Actual 401 → PASS path, no recovery', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 401,
      expectedStatus: 401,
      snapshot: snap({}),
    });
    assert.equal(r.eligible, false);
    // Match short-circuits before negative-auth classification — still no recovery.
    assert.equal(r.reason, 'status_already_matches');
  });

  it('Expected 403 / Actual 403 → no recovery', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 403,
      expectedStatus: 403,
      snapshot: snap({}),
    });
    assert.equal(r.eligible, false);
  });

  it('Expected 200 / Actual 401 → recovery candidate with GET retry', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 401,
      expectedStatus: 200,
      snapshot: snap({ method: 'GET' }),
    });
    assert.equal(r.eligible, true);
    assert.equal(r.httpRetryAllowed, true);
  });

  it('Expected 201 / Actual 401 → recovery candidate; POST no HTTP retry', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 401,
      expectedStatus: 201,
      snapshot: snap({ method: 'POST' }),
    });
    assert.equal(r.eligible, true);
    assert.equal(r.httpRetryAllowed, false);
  });

  it('Expected 401 / Actual 200 → not a recovery candidate', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 200,
      expectedStatus: 401,
      snapshot: snap({}),
    });
    assert.equal(r.eligible, false);
    assert.equal(r.reason, 'expected_auth_status_negative_or_intentional');
  });

  it('Expected 403 / Actual 401 → no recovery (negative auth boundary)', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 401,
      expectedStatus: 403,
      snapshot: snap({}),
    });
    assert.equal(r.eligible, false);
    assert.equal(r.reason, 'expected_auth_status_negative_or_intentional');
  });

  it('Skip Bearer / no managed bearer → no recovery', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 401,
      expectedStatus: 200,
      snapshot: snap({ bearerFromScenarioVariable: undefined, managedFingerprint: undefined }),
    });
    assert.equal(r.eligible, false);
  });

  it('Explicit Authorization override → no recovery', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 401,
      expectedStatus: 200,
      snapshot: snap({ hadExplicitAuthorization: true }),
    });
    assert.equal(r.eligible, false);
  });

  it('403 mismatch → no automatic refresh', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 403,
      expectedStatus: 200,
      snapshot: snap({}),
    });
    assert.equal(r.eligible, false);
    assert.equal(r.reason, 'actual_403_no_default_recovery');
  });

  it('second recovery on same request blocked', () => {
    const r = evaluateRecoveryEligibility({
      actualStatus: 401,
      expectedStatus: 200,
      snapshot: snap({ recoveryAttempted: true }),
    });
    assert.equal(r.eligible, false);
  });

  it('safe retry methods', () => {
    assert.equal(isSafeRetryMethod('GET'), true);
    assert.equal(isSafeRetryMethod('HEAD'), true);
    assert.equal(isSafeRetryMethod('POST'), false);
    assert.equal(isSafeRetryMethod('PUT'), false);
    assert.equal(isSafeRetryMethod('PATCH'), false);
    assert.equal(isSafeRetryMethod('DELETE'), false);
  });
});
