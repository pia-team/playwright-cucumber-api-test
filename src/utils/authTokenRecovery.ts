/**
 * AUTH-SUITE-3: expected-status-aware 401 recovery for managed Bearer-from-variable requests.
 * Not locator self-heal / scenario retry — HTTP-level token refresh + optional safe retry.
 */
import { ApiContext } from '../core/api/apiContext';
import { ApiClient } from '../core/api/apiClient';
import { getByJsonPath } from './assertionChecks';
import {
  mergeHeadersWithoutAuthConflict,
  mergeQueryWithAuth,
  resolveRequestAuth,
  type RuntimeAuthMode,
} from './authResolution';
import { resolveCredentialBodyPlaceholders } from './credentialBodyBinding';
import { recordEndpointHit } from './endpointTelemetry';
import {
  beginRecoveryAcquisition,
  buildRuntimeCacheKey,
  mergeStoreValue,
  peekRawEntry,
  releaseLock,
  resolveExpiration,
  type CachedTokenEntry,
  type TokenAcquisitionRecipe,
} from './jobTokenCache';
import { logger } from './logger';

export type LastHttpSendSnapshot = {
  method: string;
  path: string;
  resolvedPath: string;
  resolvedUrl: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  bodyPayload: unknown;
  resolvedBody: string | null;
  isForm: boolean;
  authMode: RuntimeAuthMode;
  /** Bearer loaded from scenario variable (managed chain). */
  bearerFromScenarioVariable?: string;
  managedFingerprint?: string;
  tokenGenerationUsed?: number;
  /** Explicit Authorization was present outside Bearer-from-variable resolution. */
  hadExplicitAuthorization?: boolean;
  recoveryAttempted?: boolean;
};

export type ManagedTokenVarBinding = {
  fingerprint: string;
  generation: number;
};

export type RecoveryEligibility = {
  eligible: boolean;
  reason: string;
  httpRetryAllowed: boolean;
};

export type RecoveryOutcome = {
  attempted: boolean;
  tokenRefreshed: boolean;
  httpRetried: boolean;
  newGeneration?: number;
  values?: Record<string, string>;
  failClosedMessage?: string;
  note: string;
};

const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD']);

export function isSafeRetryMethod(method: string): boolean {
  return SAFE_RETRY_METHODS.has((method || '').toUpperCase());
}

/**
 * Negative-auth boundary: without dedicated metadata, expected===401 is the safe signal
 * that a 401 is the intended outcome — never recover in that case.
 */
export function evaluateRecoveryEligibility(input: {
  actualStatus: number;
  expectedStatus: number;
  snapshot: LastHttpSendSnapshot | null | undefined;
}): RecoveryEligibility {
  const { actualStatus, expectedStatus, snapshot } = input;
  if (!snapshot) {
    return { eligible: false, reason: 'no_request_snapshot', httpRetryAllowed: false };
  }
  if (snapshot.recoveryAttempted) {
    return { eligible: false, reason: 'recovery_already_attempted', httpRetryAllowed: false };
  }
  if (actualStatus === expectedStatus) {
    return { eligible: false, reason: 'status_already_matches', httpRetryAllowed: false };
  }
  // Auth-oriented expected statuses: treat as negative / intentional auth outcomes — never recover.
  // Safe boundary without a dedicated negative-auth UI flag (AUTH-SUITE-4).
  if (expectedStatus === 401 || expectedStatus === 403) {
    return { eligible: false, reason: 'expected_auth_status_negative_or_intentional', httpRetryAllowed: false };
  }
  // 403 actual is never a default recovery trigger.
  if (actualStatus === 403) {
    return { eligible: false, reason: 'actual_403_no_default_recovery', httpRetryAllowed: false };
  }
  if (actualStatus !== 401) {
    return { eligible: false, reason: 'actual_not_401', httpRetryAllowed: false };
  }
  if (!snapshot.bearerFromScenarioVariable) {
    return { eligible: false, reason: 'not_managed_bearer_from_variable', httpRetryAllowed: false };
  }
  if (!snapshot.managedFingerprint) {
    return { eligible: false, reason: 'no_managed_token_fingerprint', httpRetryAllowed: false };
  }
  if (snapshot.hadExplicitAuthorization) {
    return { eligible: false, reason: 'explicit_authorization_override', httpRetryAllowed: false };
  }
  // Skip Bearer / NONE without bearer token: bearerFromScenarioVariable unset.
  if (snapshot.authMode !== 'BEARER' && !snapshot.bearerFromScenarioVariable) {
    return { eligible: false, reason: 'skip_bearer_or_no_bearer', httpRetryAllowed: false };
  }
  return {
    eligible: true,
    reason: 'unexpected_401_with_managed_bearer',
    httpRetryAllowed: isSafeRetryMethod(snapshot.method),
  };
}

export function registerManagedTokenVar(
  varName: string,
  fingerprint: string,
  generation: number,
): void {
  const g = global as any;
  const map = (g.__cotesterManagedTokenVars || {}) as Record<string, ManagedTokenVarBinding>;
  map[varName] = { fingerprint, generation };
  g.__cotesterManagedTokenVars = map;
}

export function lookupManagedTokenVar(varName: string): ManagedTokenVarBinding | undefined {
  const map = ((global as any).__cotesterManagedTokenVars || {}) as Record<string, ManagedTokenVarBinding>;
  return map[varName];
}

export function clearManagedTokenVarRegistry(): void {
  (global as any).__cotesterManagedTokenVars = {};
}

export function setLastHttpSendSnapshot(snapshot: LastHttpSendSnapshot | null): void {
  (global as any).__cotesterLastHttpSend = snapshot || undefined;
}

export function getLastHttpSendSnapshot(): LastHttpSendSnapshot | undefined {
  return (global as any).__cotesterLastHttpSend as LastHttpSendSnapshot | undefined;
}

function safeFailMessage(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/access_token["']?\s*[:=]\s*["']?[^"'&\s]+/gi, 'access_token=[REDACTED]')
    .replace(/client_secret["']?\s*[:=]\s*["']?[^"'&\s]+/gi, 'client_secret=[REDACTED]')
    .replace(/password["']?\s*[:=]\s*["']?[^"'&\s]+/gi, 'password=[REDACTED]');
}

async function sendRawHttp(options: {
  method: string;
  path: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  bodyPayload: unknown;
  isForm: boolean;
}): Promise<{ response: any; bodyText: string | null; bodyJson: unknown; status: number; elapsedMs: number }> {
  const clientContext = await ApiContext.create(options.headers);
  const client = new ApiClient(clientContext);
  const startedAt = Date.now();
  const m = options.method.toUpperCase();
  let response: any;
  switch (m) {
    case 'GET':
      response = await client.get(options.path, { headers: options.headers, params: options.params });
      break;
    case 'HEAD':
      response = await client.head(options.path, { headers: options.headers, params: options.params });
      break;
    case 'POST':
      response = await client.post(options.path, options.bodyPayload, {
        headers: options.headers,
        form: options.isForm,
      });
      break;
    case 'PUT':
      response = await client.put(options.path, options.bodyPayload, { headers: options.headers });
      break;
    case 'PATCH':
      response = await client.patch(options.path, options.bodyPayload, { headers: options.headers });
      break;
    case 'DELETE':
      response = await client.delete(options.path, { headers: options.headers });
      break;
    default:
      throw new Error(`Unsupported HTTP method for recovery: ${m}`);
  }
  const elapsedMs = Date.now() - startedAt;
  let bodyText: string | null = null;
  // HEAD responses have no body by definition; do not fall back to GET to read one.
  if (m !== 'HEAD') {
    try {
      bodyText = await response.text();
    } catch {
      bodyText = null;
    }
  }
  let bodyJson: unknown;
  try {
    bodyJson =
      bodyText && (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('['))
        ? JSON.parse(bodyText)
        : undefined;
  } catch {
    bodyJson = undefined;
  }
  recordEndpointHit({
    method: m,
    path: options.path,
    status: response.status(),
    transportError: false,
  });
  return { response, bodyText, bodyJson, status: response.status(), elapsedMs };
}

async function acquireTokenViaRecipe(
  fingerprint: string,
  recipe: TokenAcquisitionRecipe,
  previousGeneration: number,
  lockPath: string,
): Promise<{ values: Record<string, string>; generation: number; entry: CachedTokenEntry }> {
  const auth = await resolveRequestAuth((recipe.authMode || 'NONE').toUpperCase() as RuntimeAuthMode, {});
  let headers = mergeHeadersWithoutAuthConflict({ ...(recipe.headers || {}) }, auth.headers);
  if (recipe.contentType && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = recipe.contentType;
  }
  const query = mergeQueryWithAuth({ ...(recipe.query || {}) }, auth.query);
  let bodyForSend = recipe.body;
  if (recipe.resolveCredentialBody && bodyForSend) {
    const bound = resolveCredentialBodyPlaceholders(
      bodyForSend,
      recipe.contentType || headers['Content-Type'] || headers['content-type'] || null,
      {},
    );
    bodyForSend = bound.body;
  }
  const bodyPayload = bodyForSend
    ? (() => {
        try {
          return JSON.parse(bodyForSend!);
        } catch {
          return bodyForSend;
        }
      })()
    : undefined;
  const isForm =
    (headers['Content-Type'] || headers['content-type'] || '')
      .toLowerCase()
      .includes('application/x-www-form-urlencoded');

  const sent = await sendRawHttp({
    method: recipe.method,
    path: recipe.path,
    headers,
    params: query,
    bodyPayload,
    isForm,
  });

  if (sent.status !== recipe.expectedStatus) {
    releaseLock(lockPath);
    throw new Error(
      `Token acquisition during recovery returned HTTP ${sent.status}; expected ${recipe.expectedStatus}.`,
    );
  }

  const values: Record<string, string> = {};
  for (const extract of recipe.extracts || []) {
    const value = getByJsonPath(sent.bodyJson, extract.path);
    if (value === undefined || value === null || typeof value === 'object') {
      releaseLock(lockPath);
      throw new Error('Token acquisition during recovery did not yield a usable token value.');
    }
    const stored = String(value);
    if (!stored.trim()) {
      releaseLock(lockPath);
      throw new Error('Token acquisition during recovery produced an empty token value.');
    }
    values[extract.name] = stored;
  }
  if (Object.keys(values).length === 0) {
    releaseLock(lockPath);
    throw new Error('Token acquisition during recovery missing extract configuration.');
  }

  const primary = values[recipe.extracts[0]?.name] || Object.values(values)[0];
  const acquiredAt = Date.now();
  const expiration = resolveExpiration(acquiredAt, sent.bodyJson, primary);
  const entryKey = buildRuntimeCacheKey(fingerprint);
  let first = true;
  for (const [name, value] of Object.entries(values)) {
    const result = mergeStoreValue(
      entryKey,
      name,
      value,
      recipe.expectedStatus,
      expiration,
      first ? lockPath : null,
      previousGeneration,
      recipe,
    );
    first = false;
    if (!result.stored && result.reason === 'stale_generation') {
      const newer = peekRawEntry(fingerprint);
      if (newer && newer.generation > previousGeneration) {
        return { values: { ...newer.values }, generation: newer.generation, entry: newer };
      }
      throw new Error('Token cache store lost a generation race during recovery (fail-closed).');
    }
  }
  const stored = peekRawEntry(fingerprint);
  if (!stored) {
    throw new Error('Token cache missing after recovery acquisition (fail-closed).');
  }
  return { values: { ...stored.values }, generation: stored.generation, entry: stored };
}

/**
 * Refresh managed token for unexpected 401. Optionally caller retries safe HTTP methods.
 */
export async function refreshManagedTokenForRecovery(
  fingerprint: string,
  staleGeneration: number,
): Promise<{
  ok: boolean;
  values?: Record<string, string>;
  generation?: number;
  message: string;
}> {
  try {
    const outcome = await beginRecoveryAcquisition(fingerprint, staleGeneration);
    if (outcome.kind === 'disabled') {
      return { ok: false, message: 'Job token cache disabled; recovery cannot refresh token.' };
    }
    if (outcome.kind === 'hit') {
      return {
        ok: true,
        values: { ...outcome.entry.values },
        generation: outcome.entry.generation,
        message: `Reused newer token generation ${outcome.entry.generation}`,
      };
    }

    const effectiveRecipe = peekRawEntry(fingerprint)?.recipe;
    if (!effectiveRecipe) {
      releaseLock(outcome.lockPath);
      return {
        ok: false,
        message:
          'Token recovery failed: acquisition recipe unavailable for managed token (fail-closed).',
      };
    }

    const acquired = await acquireTokenViaRecipe(
      fingerprint,
      effectiveRecipe,
      outcome.previousGeneration,
      outcome.lockPath,
    );
    logger.info(
      `AUTH-SUITE-3 recovery acquired token generation ${acquired.generation} (value not logged)`,
    );
    return {
      ok: true,
      values: acquired.values,
      generation: acquired.generation,
      message: `Acquired token generation ${acquired.generation}`,
    };
  } catch (error) {
    const message = safeFailMessage(
      error instanceof Error ? error.message : 'Token recovery failed (fail-closed).',
    );
    logger.info(`AUTH-SUITE-3 recovery fail-closed: ${message}`);
    return { ok: false, message };
  }
}

export async function retrySafeHttpWithBearer(
  snapshot: LastHttpSendSnapshot,
  bearerToken: string,
): Promise<{
  response: any;
  bodyText: string | null;
  bodyJson: unknown;
  status: number;
  elapsedMs: number;
}> {
  if (!isSafeRetryMethod(snapshot.method)) {
    throw new Error('HTTP retry is not allowed for this method.');
  }
  const headers = { ...snapshot.headers };
  // Replace Authorization with new bearer; do not log token.
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'authorization') {
      delete headers[key];
    }
  }
  headers.Authorization = `Bearer ${bearerToken}`;
  return sendRawHttp({
    method: snapshot.method,
    path: snapshot.resolvedPath,
    headers,
    params: snapshot.params,
    bodyPayload: snapshot.bodyPayload,
    isForm: snapshot.isForm,
  });
}

/** Convenience orchestration used by expects-status step. */
export async function runAuthRecovery(input: {
  expectedStatus: number;
  actualStatus: number;
  snapshot: LastHttpSendSnapshot;
}): Promise<RecoveryOutcome> {
  const eligibility = evaluateRecoveryEligibility({
    actualStatus: input.actualStatus,
    expectedStatus: input.expectedStatus,
    snapshot: input.snapshot,
  });
  if (!eligibility.eligible) {
    return {
      attempted: false,
      tokenRefreshed: false,
      httpRetried: false,
      note: eligibility.reason,
    };
  }

  input.snapshot.recoveryAttempted = true;
  setLastHttpSendSnapshot(input.snapshot);

  const staleGeneration = input.snapshot.tokenGenerationUsed ?? 0;
  const fingerprint = input.snapshot.managedFingerprint!;
  const refreshed = await refreshManagedTokenForRecovery(fingerprint, staleGeneration);
  if (!refreshed.ok || !refreshed.values) {
    return {
      attempted: true,
      tokenRefreshed: false,
      httpRetried: false,
      failClosedMessage: refreshed.message,
      note: 'token_refresh_failed',
    };
  }

  const bearerVar = input.snapshot.bearerFromScenarioVariable!;
  const newToken = refreshed.values[bearerVar] || Object.values(refreshed.values)[0];
  if (!newToken?.trim()) {
    return {
      attempted: true,
      tokenRefreshed: false,
      httpRetried: false,
      failClosedMessage: 'Recovery token missing expected variable (fail-closed).',
      note: 'token_var_missing',
    };
  }

  for (const [name, value] of Object.entries(refreshed.values)) {
    registerManagedTokenVar(name, fingerprint, refreshed.generation || staleGeneration + 1);
  }

  if (!eligibility.httpRetryAllowed) {
    return {
      attempted: true,
      tokenRefreshed: true,
      httpRetried: false,
      newGeneration: refreshed.generation,
      values: refreshed.values,
      note:
        `token_refreshed_no_http_retry_for_${(input.snapshot.method || 'METHOD').toUpperCase()}`,
    };
  }

  return {
    attempted: true,
    tokenRefreshed: true,
    httpRetried: true,
    newGeneration: refreshed.generation,
    values: refreshed.values,
    note: 'token_refreshed_http_retry_pending',
  };
}
