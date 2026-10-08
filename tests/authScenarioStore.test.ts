import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAuthScenarioToken,
  getAuthScenarioState,
} from '../src/utils/authScenarioStore';
import type { TokenResponse } from '../src/services/authService';

const JOB_A = '/tmp/cotester-test-job-a';
const JOB_B = '/tmp/cotester-test-job-b';

const savedRuntimeDir = process.env.COTESTER_RUNTIME_DIR;

function minimalToken(accessToken: string): TokenResponse {
  return {
    access_token: accessToken,
    expires_in: 60,
    refresh_expires_in: 120,
    refresh_token: 'refresh-dummy',
    token_type: 'Bearer',
    'not-before-policy': 0,
    session_state: 'session-dummy',
    scope: 'openid',
  };
}

describe('authScenarioStore job isolation', () => {
  afterEach(() => {
    process.env.COTESTER_RUNTIME_DIR = JOB_A;
    clearAuthScenarioToken();
    process.env.COTESTER_RUNTIME_DIR = JOB_B;
    clearAuthScenarioToken();
    if (savedRuntimeDir === undefined) {
      delete process.env.COTESTER_RUNTIME_DIR;
    } else {
      process.env.COTESTER_RUNTIME_DIR = savedRuntimeDir;
    }
  });

  it('does not share tokens between CoTester runtime job keys', () => {
    process.env.COTESTER_RUNTIME_DIR = JOB_A;
    getAuthScenarioState().tokenResponse = minimalToken('token-for-job-a');

    process.env.COTESTER_RUNTIME_DIR = JOB_B;
    const jobB = getAuthScenarioState();
    assert.equal(jobB.tokenResponse, null);

    jobB.tokenResponse = minimalToken('token-for-job-b');

    process.env.COTESTER_RUNTIME_DIR = JOB_A;
    assert.equal(getAuthScenarioState().tokenResponse?.access_token, 'token-for-job-a');

    process.env.COTESTER_RUNTIME_DIR = JOB_B;
    assert.equal(getAuthScenarioState().tokenResponse?.access_token, 'token-for-job-b');
  });
});
