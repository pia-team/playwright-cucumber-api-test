/**
 * Child process: AUTH-SUITE-3 recovery + GET retry against mock API.
 */
import {
  retrySafeHttpWithBearer,
  runAuthRecovery,
  type LastHttpSendSnapshot,
} from '../../src/utils/authTokenRecovery';

async function main(): Promise<void> {
  const mockBase = process.env.MOCK_BASE_URL?.trim();
  const fingerprint = process.env.TOKEN_FINGERPRINT?.trim();
  const staleGeneration = Number(process.env.STALE_GENERATION || '1');
  if (!mockBase || !fingerprint) {
    console.error('MISSING_ENV');
    process.exit(2);
  }

  const snapshot: LastHttpSendSnapshot = {
    method: 'GET',
    path: '/users',
    resolvedPath: '/users',
    resolvedUrl: `${mockBase}/users`,
    headers: { Authorization: 'Bearer stale-from-worker' },
    params: {},
    bodyPayload: undefined,
    resolvedBody: null,
    isForm: false,
    authMode: 'BEARER',
    bearerFromScenarioVariable: 'access_token',
    managedFingerprint: fingerprint,
    tokenGenerationUsed: staleGeneration,
    hadExplicitAuthorization: false,
    recoveryAttempted: false,
  };

  const recovery = await runAuthRecovery({
    expectedStatus: 200,
    actualStatus: 401,
    snapshot,
  });
  if (!recovery.tokenRefreshed || !recovery.values?.access_token) {
    console.log(JSON.stringify({
      tokenRefreshed: false,
      message: recovery.failClosedMessage || recovery.note,
    }));
    process.exit(4);
  }

  const retried = await retrySafeHttpWithBearer(snapshot, recovery.values.access_token);
  console.log(JSON.stringify({
    tokenRefreshed: true,
    generation: recovery.newGeneration,
    retryStatus: retried.status,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
