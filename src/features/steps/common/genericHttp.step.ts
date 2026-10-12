import { After, Given, When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { ApiContext } from '../../../core/api/apiContext';
import { ApiClient } from '../../../core/api/apiClient';
import { ResponseHelper } from '../../../utils/responseHelper';
import { logger } from '../../../utils/logger';
import {
  applySensitiveValueRedaction,
  beginHttpEvidence,
  buildHttpAttachmentBundle,
  buildResolvedUrl,
  evidenceForAttach,
  recordAssertionFailure,
  recordResponseEvidence,
  resetHttpEvidence,
  sanitizeBody,
  summarizeUnauthorizedChallenge,
} from '../../../utils/httpEvidence';
import { recordEndpointHit } from '../../../utils/endpointTelemetry';
import {
  embeddedSecretConfigurationError,
  mergeHeadersWithoutAuthConflict,
  mergeQueryWithAuth,
  resolveRequestAuth,
  RuntimeAuthMode,
} from '../../../utils/authResolution';
import { flowContext } from '../../../utils/flowContext';
import {
  evaluateCriterion,
  formatCriterionFailure,
  scenarioFailureMessage,
  type CriterionOutcome,
} from '../../../utils/assertionChecks';
import {
  SAFE_JSON_PATH,
  SAFE_VARIABLE,
  hasInvalidPlaceholder,
  missingPlaceholders,
  redactStoredValues,
  substituteTemplates,
} from '../../../utils/scenarioTemplate';
import { generateRuntimeValue } from '../../../utils/runtimeGenerate';
import { resolveCredentialBodyPlaceholders } from '../../../utils/credentialBodyBinding';
import {
  beginAcquisition,
  mergeStoreValue,
  releaseLock,
  resolveExpiration,
  type TokenAcquisitionRecipe,
} from '../../../utils/jobTokenCache';
import {
  clearManagedTokenVarRegistry,
  evaluateRecoveryEligibility,
  getLastHttpSendSnapshot,
  lookupManagedTokenVar,
  registerManagedTokenVar,
  retrySafeHttpWithBearer,
  runAuthRecovery,
  setLastHttpSendSnapshot,
  type LastHttpSendSnapshot,
} from '../../../utils/authTokenRecovery';

type GenericHttpState = {
  authMode: RuntimeAuthMode;
  bearerToken?: string;
  apiKeyHeader?: string;
  apiKeyQuery?: string;
  embeddedSecretHeaders: string[];
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string | null;
  contentType: string | null;
  /** Token Request only: resolve {{username}}/{{password}}/… from Credential Profile into body. */
  resolveCredentialBody: boolean;
  /** AUTH-SUITE-1/2: compiler fingerprint for managed Token Request reuse. */
  managedTokenFingerprint?: string;
  managedTokenCacheHit?: boolean;
  managedTokenValues?: Record<string, string>;
  managedTokenExpectedStatus?: number;
  managedTokenLastExpectedStatus?: number;
  managedTokenCacheKey?: string;
  managedTokenLockPath?: string;
  managedTokenLockHeld?: boolean;
  managedTokenPreviousGeneration?: number;
  managedTokenRenewing?: boolean;
  /** Recipe captured on managed token HTTP send for AUTH-SUITE-3 recovery. */
  managedTokenRecipe?: TokenAcquisitionRecipe;
  /** Protected step: Bearer loaded from scenario variable name. */
  bearerFromScenarioVariable?: string;
};

const SENSITIVE_HEADER_NAME =
  /^(authorization|proxy-authorization|x-api-key|api-key|apikey|x-auth-token|x-access-token|access-token|cookie|set-cookie)$/i;
const SENSITIVE_NAME =
  /(password|passwd|secret|token|api[-_]?key|credential|authorization)/i;
const PUBLIC_HEADER_NAME =
  /^(accept|accept-language|accept-encoding|content-type|content-length|user-agent|cache-control|origin|referer|x-request-id|x-correlation-id|traceparent)$/i;
const SENSITIVE_QUERY_NAME =
  /^(api[-_]?key|access[-_]?token|refresh[-_]?token|token|password|passwd|secret|client[-_]?secret)$/i;

function state(): GenericHttpState {
  const g = global as any;
  if (!g.__cotesterGenericHttp) {
    g.__cotesterGenericHttp = {
      authMode: 'NONE' as RuntimeAuthMode,
      bearerToken: undefined,
      apiKeyHeader: undefined,
      apiKeyQuery: undefined,
      embeddedSecretHeaders: [],
      headers: {},
      query: {},
      body: null,
      contentType: null,
      resolveCredentialBody: false,
      managedTokenFingerprint: undefined,
      managedTokenCacheHit: false,
      managedTokenValues: undefined,
      managedTokenExpectedStatus: undefined,
      managedTokenLastExpectedStatus: undefined,
      managedTokenCacheKey: undefined,
      managedTokenLockPath: undefined,
      managedTokenLockHeld: false,
      managedTokenPreviousGeneration: 0,
      managedTokenRenewing: false,
      managedTokenRecipe: undefined,
      bearerFromScenarioVariable: undefined,
    };
  }
  const current = g.__cotesterGenericHttp as GenericHttpState;
  if (!Array.isArray(current.embeddedSecretHeaders)) {
    current.embeddedSecretHeaders = [];
  }
  if (current.resolveCredentialBody == null) {
    current.resolveCredentialBody = false;
  }
  return current;
}

function clearManagedTokenState(s: GenericHttpState = state()): void {
  if (s.managedTokenLockHeld && s.managedTokenLockPath) {
    releaseLock(s.managedTokenLockPath);
  }
  s.managedTokenFingerprint = undefined;
  s.managedTokenCacheHit = false;
  s.managedTokenValues = undefined;
  s.managedTokenExpectedStatus = undefined;
  s.managedTokenLastExpectedStatus = undefined;
  s.managedTokenCacheKey = undefined;
  s.managedTokenLockPath = undefined;
  s.managedTokenLockHeld = false;
  s.managedTokenPreviousGeneration = 0;
  s.managedTokenRenewing = false;
  s.managedTokenRecipe = undefined;
  s.bearerFromScenarioVariable = undefined;
}

async function attachAuthRecoveryNote(
  world: unknown,
  payload: Record<string, unknown>,
  fileName: string,
): Promise<void> {
  const attach = (world as { attach?: Function })?.attach;
  if (typeof attach !== 'function') return;
  await attach(JSON.stringify(payload), { mediaType: 'application/json', fileName });
}

function applyResponseToGlobals(
  response: any,
  bodyText: string | null,
  bodyJson: unknown,
  elapsedMs: number,
): void {
  ResponseHelper.setGlobalResponse(response);
  (global as any).currentResponse = response;
  (global as any).__cotesterResponseBodyText = bodyText;
  (global as any).__cotesterResponseJson = bodyJson;
  (global as any).__cotesterElapsedMs = elapsedMs;
}

async function attachAuthCacheHitNote(world: unknown): Promise<void> {
  const attach = (world as { attach?: Function })?.attach;
  if (typeof attach !== 'function') return;
  await attach(
    JSON.stringify({
      kind: 'auth_token_cache_hit',
      message: 'Job-scoped token cache hit; token HTTP request was not sent.',
    }),
    { mediaType: 'application/json', fileName: 'Auth Token Cache Hit.json' },
  );
}

async function attachAuthTokenRenewalNote(
  world: unknown,
  info: { generation: number; expirationSource: string; renewing: boolean },
): Promise<void> {
  const attach = (world as { attach?: Function })?.attach;
  if (typeof attach !== 'function') return;
  await attach(
    JSON.stringify({
      kind: info.renewing ? 'auth_token_renewal' : 'auth_token_acquisition',
      generation: info.generation,
      expirationSource: info.expirationSource,
      message: info.renewing
        ? 'Job-scoped token renewed via managed Token Request (value not attached).'
        : 'Job-scoped token acquired via managed Token Request (value not attached).',
    }),
    {
      mediaType: 'application/json',
      fileName: info.renewing ? 'Auth Token Renewal.json' : 'Auth Token Acquisition.json',
    },
  );
}

function isSensitiveHeader(name: string): boolean {
  if (PUBLIC_HEADER_NAME.test(name) && !SENSITIVE_HEADER_NAME.test(name)) {
    return false;
  }
  return SENSITIVE_HEADER_NAME.test(name) || SENSITIVE_NAME.test(name);
}

function tableToMap(table: DataTable, kind: 'header' | 'query'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of table.raw()) {
    if (!row || row.length < 2) continue;
    const key = String(row[0] ?? '').trim();
    const value = String(row[1] ?? '').trim();
    if (!key) continue;
    const sensitive = kind === 'header' ? isSensitiveHeader(key) : SENSITIVE_QUERY_NAME.test(key) || SENSITIVE_NAME.test(key);
    if (sensitive) {
      state().embeddedSecretHeaders.push(key);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function resolveRequestPath(
  path: string,
  scenarioVars?: Record<string, string>,
): string {
  let resolved = path;
  if (scenarioVars) {
    for (const [key, value] of Object.entries(scenarioVars)) {
      if (!key || value == null || value === '') continue;
      resolved = resolved.split(`{${key}}`).join(encodeURIComponent(value));
    }
  }
  const flowPath = process.env.COTESTER_FLOW_CONTEXT_PATH?.trim();
  if (flowPath && /\{flow:[^}]+\}/.test(resolved)) {
    resolved = resolved.replace(/\{flow:([^}]+)\}/g, (_m, key: string) => {
      try {
        return encodeURIComponent(flowContext.require(key.trim()));
      } catch {
        return _m;
      }
    });
  }
  if (/\{[^}]+\}/.test(resolved)) {
    throw new Error(
      `Request path "${path}" has unresolved placeholders. Set matching scenario variables or flow context keys first.`,
    );
  }
  return resolved;
}

function getByJsonPath(obj: unknown, pathExpr: string): unknown {
  if (!pathExpr || pathExpr === '$') return obj;
  let expr = pathExpr.startsWith('$.') ? pathExpr.slice(2) : pathExpr.startsWith('$') ? pathExpr.slice(1) : pathExpr;
  if (expr.startsWith('.')) expr = expr.slice(1);
  const parts = expr.split(/\.|\[|\]/).filter(Boolean);
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Generate a runtime value into scenarioVars before a request.
 * Spec examples: email, uuid, numeric:6, alphanumeric:10, pattern:TEST######, timestamp:iso
 */
Given(
  'the scenario variable {string} is generated as {string}',
  async function (this: { scenarioVars?: Record<string, string> }, varName: string, spec: string) {
    if (!SAFE_VARIABLE.test(varName)) {
      throw new Error(`Invalid scenario variable name "${varName}"`);
    }
    const value = generateRuntimeValue(spec);
    this.scenarioVars = this.scenarioVars || {};
    this.scenarioVars[varName] = value;
    // Non-secret runtime values stay visible in HTTP evidence (UUID/email/etc.).
    logger.info(`Scenario variable "${varName}" generated as ${spec}`);
  },
);

Given('the API request uses auth mode {string}', async function (mode: string) {
  resetHttpEvidence();
  const normalized = (mode || 'NONE').toUpperCase() as RuntimeAuthMode;
  if (!['NONE', 'BEARER', 'KEYCLOAK', 'BASIC', 'API_KEY'].includes(normalized)) {
    throw new Error(`Unsupported auth mode "${mode}". Use NONE, BEARER, KEYCLOAK, BASIC, or API_KEY.`);
  }
  state().authMode = normalized;
  state().bearerToken = undefined;
  state().apiKeyHeader = undefined;
  state().apiKeyQuery = undefined;
  state().embeddedSecretHeaders = [];
  state().headers = {};
  state().query = {};
  state().body = null;
  state().contentType = null;
  state().resolveCredentialBody = false;
  clearManagedTokenState();
  beginHttpEvidence({ authMode: normalized, method: 'GET', url: '' });
  (global as any).__cotesterElapsedMs = undefined;
  (global as any).__cotesterSentJson = undefined;
  (global as any).__cotesterSentQuery = undefined;
  logger.info(`Generic HTTP auth mode set to ${normalized}`);
});

Given('the API chain step {string} {string}', async function (stepId: string, label: string) {
  (global as any).__cotesterChainMode = true;
  (global as any).__cotesterStepId = stepId;
  (global as any).__cotesterStepLabel = label;
  (global as any).__cotesterStepBlocked = '';
  (global as any).__cotesterExtractAllowed = false;
  (global as any).__cotesterPendingExtracts = [];
  state().resolveCredentialBody = false;
  clearManagedTokenState();
  ResponseHelper.setGlobalResponse(undefined);
  (global as any).currentResponse = undefined;
  (global as any).__cotesterResponseJson = undefined;
  (global as any).__cotesterResponseBodyText = null;
  (global as any).__cotesterElapsedMs = undefined;
  (global as any).__cotesterSentJson = undefined;
  (global as any).__cotesterSentQuery = undefined;
});

Given('the API request resolves credential body placeholders', async function () {
  state().resolveCredentialBody = true;
  logger.info('Generic HTTP will resolve credential body placeholders at send time (values not logged)');
});

Given('the API request is a managed token acquisition {string}', async function (fingerprint: string) {
  const fp = (fingerprint || '').trim();
  if (!/^[a-f0-9]{16,64}$/i.test(fp)) {
    throw new Error('Invalid managed token acquisition fingerprint.');
  }
  state().managedTokenFingerprint = fp.toLowerCase();
  state().managedTokenCacheHit = false;
  state().managedTokenValues = undefined;
  logger.info('Managed token acquisition enabled for this request (fingerprint not a secret)');
});

Given('the API chain will store response path {string}', async function (jsonPath: string) {
  const paths = ((global as any).__cotesterPendingExtracts || []) as string[];
  paths.push(jsonPath);
  (global as any).__cotesterPendingExtracts = paths;
});

Given('the API request headers are', async function (table: DataTable) {
  Object.assign(state().headers, tableToMap(table, 'header'));
});

Given('the API request query parameters are', async function (table: DataTable) {
  Object.assign(state().query, tableToMap(table, 'query'));
});

Given('the API request uses API key header {string}', async function (headerName: string) {
  const name = (headerName || '').trim();
  if (!name || /[\r\n"]/.test(name) || name.length > 128) {
    throw new Error('API key header name is invalid. The request was not sent.');
  }
  state().authMode = 'API_KEY';
  state().apiKeyHeader = name;
  state().apiKeyQuery = undefined;
  logger.info(`Generic HTTP API key header name set to "${name}" (value comes from the credential profile)`);
});

Given('the API request uses API key query parameter {string}', async function (queryName: string) {
  const name = (queryName || '').trim();
  if (!name || /[\r\n"&=]/.test(name) || name.length > 128) {
    throw new Error('API key query name is invalid. The request was not sent.');
  }
  state().authMode = 'API_KEY';
  state().apiKeyQuery = name;
  state().apiKeyHeader = undefined;
  logger.info(`Generic HTTP API key query name set to "${name}" (value comes from the credential profile)`);
});

Given('the API request body is', async function (docString: string) {
  state().body = docString ?? '';
});

Given('the API request content type is {string}', async function (contentType: string) {
  state().contentType = contentType;
  if (contentType) {
    state().headers['Content-Type'] = contentType;
  }
});

function chainMode(): boolean {
  return Boolean((global as any).__cotesterChainMode);
}

/** Values that must never appear in logs/attachments (explicit secrets + pending extracts). */
function rememberRedaction(vars?: Record<string, string>): void {
  const current = ((global as any).__cotesterRedactValues || []) as string[];
  const next = new Set(current);
  for (const value of Object.values(vars || {})) {
    if (value && value.length >= 3) next.add(value);
  }
  (global as any).__cotesterRedactValues = [...next];
}

function rememberSensitiveValue(value: string): void {
  if (!value || value.length < 3) return;
  rememberRedaction({ secret: value });
}

function redactText(text: string | null | undefined): string {
  if (text == null) return '';
  return redactStoredValues(text, ((global as any).__cotesterRedactValues || []) as string[]);
}

async function attachHttpEvidence(
  world: unknown,
  options?: { includeDiagnosticBundle?: boolean },
): Promise<void> {
  const attach = (world as { attach?: Function })?.attach;
  if (typeof attach !== 'function') return;
  const bundle = buildHttpAttachmentBundle();
  if (!bundle) return;
  const secrets = ((global as any).__cotesterRedactValues || []) as string[];
  const summary = applySensitiveValueRedaction(bundle.summary, secrets);
  const request = applySensitiveValueRedaction(bundle.request, secrets);
  const response = applySensitiveValueRedaction(bundle.response, secrets);
  await attach(summary, { mediaType: 'application/json', fileName: 'HTTP Summary.json' });
  await attach(request, { mediaType: 'application/json', fileName: 'HTTP Request.json' });
  await attach(response, { mediaType: 'application/json', fileName: 'HTTP Response.json' });
  if (options?.includeDiagnosticBundle) {
    // Backward-compatible single blob for older harness assertions.
    const legacy = evidenceForAttach(true);
    if (legacy) {
      await attach(applySensitiveValueRedaction(legacy, secrets), {
        mediaType: 'application/json',
        fileName: 'HTTP Evidence.json',
      });
    }
  }
}

function redactPendingExtracts(body: unknown): void {
  const paths = ((global as any).__cotesterPendingExtracts || []) as string[];
  const values: Record<string, string> = {};
  paths.forEach((jsonPath, index) => {
    if (!SAFE_JSON_PATH.test(jsonPath)) return;
    const value = getByJsonPath(body, jsonPath);
    if (value == null || typeof value === 'object') return;
    values[`pending${index}`] = String(value);
  });
  rememberRedaction(values);
  (global as any).__cotesterPendingExtracts = [];
}

function clearCurrentResponse(): void {
  ResponseHelper.setGlobalResponse(undefined);
  (global as any).currentResponse = undefined;
  (global as any).__cotesterResponseJson = undefined;
  (global as any).__cotesterResponseBodyText = null;
  (global as any).__cotesterElapsedMs = undefined;
}

function blockUnresolved(message: string): void {
  const s = state();
  if (s.managedTokenLockHeld) {
    releaseLock(s.managedTokenLockPath);
    s.managedTokenLockHeld = false;
    s.managedTokenLockPath = undefined;
    s.managedTokenCacheKey = undefined;
  }
  (global as any).__cotesterStepBlocked = message;
  (global as any).__cotesterExtractAllowed = false;
  clearCurrentResponse();
  if (!chainMode()) {
    throw new Error(message);
  }
}

When(
  'the user sends a {word} request to {string}',
  async function (this: { scenarioVars?: Record<string, string> }, method: string, path: string) {
    const m = (method || 'GET').toUpperCase();
    const s = state();
    (global as any).__cotesterStepBlocked = '';
    if (s.authMode === 'NONE' && !s.bearerToken && s.embeddedSecretHeaders.length > 0) {
      throw embeddedSecretConfigurationError(s.embeddedSecretHeaders);
    }

    // AUTH-SUITE-1: job-scoped token reuse (managed Token Request only).
    if (s.managedTokenFingerprint) {
      try {
        const outcome = await beginAcquisition(s.managedTokenFingerprint);
        if (outcome.kind === 'hit') {
          s.managedTokenCacheHit = true;
          s.managedTokenValues = { ...outcome.entry.values };
          s.managedTokenExpectedStatus = outcome.entry.expectedStatus;
          if (outcome.entry.recipe) {
            s.managedTokenRecipe = outcome.entry.recipe;
          }
          for (const [name, value] of Object.entries(s.managedTokenValues)) {
            rememberSensitiveValue(value);
            registerManagedTokenVar(name, s.managedTokenFingerprint!, outcome.entry.generation);
          }
          (global as any).__cotesterStatusChecked = false;
          (global as any).__cotesterExtractAllowed = false;
          (global as any).__cotesterElapsedMs = 0;
          clearCurrentResponse();
          setLastHttpSendSnapshot(null);
          logger.info('Managed token cache hit; skipping token HTTP request');
          await attachAuthCacheHitNote(this);
          return;
        }
        if (outcome.kind === 'acquire') {
          s.managedTokenLockHeld = true;
          s.managedTokenCacheKey = outcome.cacheKey;
          s.managedTokenLockPath = outcome.lockPath;
          s.managedTokenCacheHit = false;
          s.managedTokenPreviousGeneration = outcome.previousGeneration;
          s.managedTokenRenewing = outcome.renewing;
          if (outcome.renewing) {
            logger.info(
              `Managed token proactive renewal or expiry refresh starting (previous generation ${outcome.previousGeneration}; value not logged)`,
            );
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Token cache coordination failed.';
        clearManagedTokenState(s);
        blockUnresolved(message);
        return;
      }
    }

    const auth = await resolveRequestAuth(s.authMode, {
      bearerToken: s.bearerToken,
      apiKeyHeader: s.apiKeyHeader,
      apiKeyQuery: s.apiKeyQuery,
    });
    const headers = mergeHeadersWithoutAuthConflict(s.headers, auth.headers);
    if (s.contentType && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = s.contentType;
    }
    const query = mergeQueryWithAuth(s.query, auth.query);

    let bodyForSend = s.body;
    if (s.resolveCredentialBody && bodyForSend != null && bodyForSend !== '') {
      try {
        const bound = resolveCredentialBodyPlaceholders(
          bodyForSend,
          s.contentType || headers['Content-Type'] || headers['content-type'] || null,
          this.scenarioVars,
        );
        bodyForSend = bound.body;
        for (const secret of bound.sensitiveValues) {
          rememberSensitiveValue(secret);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Credential body binding failed.';
        blockUnresolved(message);
        return;
      }
    }

    const sources = [path, bodyForSend || '', ...Object.values(headers), ...Object.values(query)];
    const missing = [...new Set(sources.flatMap((text) => missingPlaceholders(text, this.scenarioVars)))];
    if (missing.length > 0 || sources.some((text) => hasInvalidPlaceholder(text))) {
      const names = missing.length > 0 ? missing.join(', ') : 'geçersiz ad';
      blockUnresolved(`Değişken çözümlenemedi: ${names}. İstek gönderilmedi.`);
      return;
    }

    const urlPath = substituteTemplates(path, this.scenarioVars, true);
    let resolvedPath = urlPath;
    try {
      resolvedPath = resolveRequestPath(urlPath, this.scenarioVars);
    } catch (error) {
      blockUnresolved(error instanceof Error ? error.message : 'Değişken çözümlenemedi. İstek gönderilmedi.');
      return;
    }
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      params[key] = substituteTemplates(value, this.scenarioVars, false);
    }
    const resolvedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      resolvedHeaders[key] = substituteTemplates(value, this.scenarioVars, false);
    }
    // Credential secrets already substituted; remaining {{vars}} are scenario variables only.
    const resolvedBody =
      bodyForSend == null ? null : substituteTemplates(bodyForSend, this.scenarioVars, false);
    const resolvedUrl = buildResolvedUrl(resolvedPath, params);
    const requestTs = new Date().toISOString();
    const reqBodySanitized = sanitizeBody(resolvedBody);

    if (s.managedTokenFingerprint) {
      const pendingPaths = ((global as any).__cotesterPendingExtracts || []) as string[];
      s.managedTokenRecipe = {
        method: m,
        path: resolvedPath,
        body: s.body,
        contentType: s.contentType,
        authMode: s.authMode,
        headers: { ...s.headers },
        query: { ...s.query },
        resolveCredentialBody: Boolean(s.resolveCredentialBody),
        // Names filled when sensitive store runs; paths known from chain "will store".
        extracts: pendingPaths.map((p) => ({ name: '', path: p })),
        expectedStatus: 200,
      };
    }

    const bearerBinding = s.bearerFromScenarioVariable
      ? lookupManagedTokenVar(s.bearerFromScenarioVariable)
      : undefined;
    const hadExplicitAuthorization = Object.keys(s.headers).some((k) => k.toLowerCase() === 'authorization');

    beginHttpEvidence({
      method: m,
      url: resolvedUrl,
      path: resolvedPath,
      query: params,
      requestHeaders: resolvedHeaders,
      requestBody: reqBodySanitized.text,
      requestBodyKind: reqBodySanitized.kind,
      authMode: s.authMode,
      requestTimestamp: requestTs,
      truncated: reqBodySanitized.truncated || undefined,
    });

    const clientContext = await ApiContext.create(resolvedHeaders);
    const client = new ApiClient(clientContext);

    let response: any;
    const bodyPayload = resolvedBody
      ? (() => {
          try {
            return JSON.parse(resolvedBody);
          } catch {
            return resolvedBody;
          }
        })()
      : undefined;

    const isForm =
      (resolvedHeaders['Content-Type'] || resolvedHeaders['content-type'] || '')
        .toLowerCase()
        .includes('application/x-www-form-urlencoded');

    const snapshot: LastHttpSendSnapshot = {
      method: m,
      path,
      resolvedPath,
      resolvedUrl,
      headers: { ...resolvedHeaders },
      params: { ...params },
      bodyPayload,
      resolvedBody,
      isForm,
      authMode: s.authMode,
      bearerFromScenarioVariable: s.bearerFromScenarioVariable,
      managedFingerprint: bearerBinding?.fingerprint || s.managedTokenFingerprint,
      tokenGenerationUsed: bearerBinding?.generation,
      hadExplicitAuthorization,
      recoveryAttempted: false,
    };
    setLastHttpSendSnapshot(snapshot);

    const startedAt = Date.now();
    let transportError: string | null = null;
    try {
      switch (m) {
        case 'GET':
          response = await client.get(resolvedPath, { headers: resolvedHeaders, params });
          break;
        case 'HEAD':
          response = await client.head(resolvedPath, { headers: resolvedHeaders, params });
          break;
        case 'POST':
          response = await client.post(resolvedPath, bodyPayload, { headers: resolvedHeaders, form: isForm });
          break;
        case 'PUT':
          response = await client.put(resolvedPath, bodyPayload, { headers: resolvedHeaders });
          break;
        case 'PATCH':
          response = await client.patch(resolvedPath, bodyPayload, { headers: resolvedHeaders });
          break;
        case 'DELETE':
          response = await client.delete(resolvedPath, { headers: resolvedHeaders });
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${m}`);
      }
    } catch (error) {
      transportError = error instanceof Error ? error.message : 'İstek gönderilemedi.';
      if (s.managedTokenLockHeld) {
        releaseLock(s.managedTokenLockPath);
        s.managedTokenLockHeld = false;
        s.managedTokenLockPath = undefined;
        s.managedTokenCacheKey = undefined;
      }
      beginHttpEvidence({
        transportError,
        durationMs: Date.now() - startedAt,
      });
      recordEndpointHit({
        method: m,
        path: resolvedPath,
        status: null,
        transportError: true,
      });
      await attachHttpEvidence(this);
      if (!chainMode()) throw error;
      blockUnresolved(transportError);
      return;
    }
    const elapsedMs = Date.now() - startedAt;
    (global as any).__cotesterElapsedMs = elapsedMs;
    const sendsBody = m === 'POST' || m === 'PUT' || m === 'PATCH';
    (global as any).__cotesterSentJson =
      sendsBody && bodyPayload && typeof bodyPayload === 'object' ? bodyPayload : undefined;
    (global as any).__cotesterSentQuery = params;

    await ResponseHelper.logAndSetResponse(response, m, resolvedPath, params);
    (global as any).currentResponse = response;

    let bodyText: string | null = null;
    if (m !== 'HEAD') {
      try {
        bodyText = await response.text();
      } catch {
        bodyText = null;
      }
    }
    (global as any).__cotesterResponseBodyText = bodyText;
    try {
      (global as any).__cotesterResponseJson =
        bodyText && (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('['))
          ? JSON.parse(bodyText)
          : undefined;
    } catch {
      (global as any).__cotesterResponseJson = undefined;
    }
    redactPendingExtracts((global as any).__cotesterResponseJson);
    const responseHeaders = response.headers() as Record<string, string>;
    recordResponseEvidence(response.status(), responseHeaders, bodyText, {
      durationMs: elapsedMs,
      transportError: null,
    });
    recordEndpointHit({
      method: m,
      path: resolvedPath,
      status: response.status(),
      transportError: false,
    });
    if (response.status() === 401) {
      logger.info(summarizeUnauthorizedChallenge(401, responseHeaders));
    }
    (global as any).__cotesterStatusChecked = false;
    (global as any).__cotesterExtractAllowed = false;

    await attachHttpEvidence(this);
  },
);

async function cachedJsonBody(): Promise<unknown> {
  if ((global as any).__cotesterResponseJson !== undefined) {
    return (global as any).__cotesterResponseJson;
  }
  const text = (global as any).__cotesterResponseBodyText as string | null | undefined;
  if (text == null) {
    throw new Error('Response body is not available');
  }
  return JSON.parse(text);
}

function cachedBodyText(): string {
  const text = (global as any).__cotesterResponseBodyText as string | null | undefined;
  if (text == null) {
    throw new Error('Response body is not available');
  }
  return text;
}

Then('the API response status should be {int}', async function (
  this: { scenarioVars?: Record<string, string> },
  expected: number,
) {
  let response = ResponseHelper.getGlobalResponse();
  if (!response) {
    throw new Error('No API response available');
  }
  beginHttpEvidence({ expectedStatus: expected });
  let actual = response.status();
  (global as any).__cotesterStatusChecked = true;

  if (actual !== expected) {
    const snapshot = getLastHttpSendSnapshot();
    const eligibility = evaluateRecoveryEligibility({
      actualStatus: actual,
      expectedStatus: expected,
      snapshot,
    });
    if (eligibility.eligible && snapshot) {
      const recovery = await runAuthRecovery({
        expectedStatus: expected,
        actualStatus: actual,
        snapshot,
      });
      if (recovery.tokenRefreshed && recovery.values) {
        this.scenarioVars = this.scenarioVars || {};
        for (const [name, value] of Object.entries(recovery.values)) {
          this.scenarioVars[name] = value;
          rememberSensitiveValue(value);
        }
      }
      if (recovery.tokenRefreshed && recovery.httpRetried && recovery.values) {
        const bearerVar = snapshot.bearerFromScenarioVariable!;
        const newToken = recovery.values[bearerVar] || Object.values(recovery.values)[0];
        const retried = await retrySafeHttpWithBearer(snapshot, newToken);
        applyResponseToGlobals(retried.response, retried.bodyText, retried.bodyJson, retried.elapsedMs);
        recordResponseEvidence(retried.status, retried.response.headers() as Record<string, string>, retried.bodyText, {
          durationMs: retried.elapsedMs,
        });
        response = retried.response;
        actual = retried.status;
      }
    }
  }

  try {
    expect(actual).toBe(expected);
    (global as any).__cotesterExtractAllowed = true;
  } catch (e: any) {
    (global as any).__cotesterExtractAllowed = false;
    const msg = `Expected status ${expected} but got ${actual}`;
    if (actual === 401) {
      logger.info(summarizeUnauthorizedChallenge(401, response.headers() as Record<string, string>));
    }
    recordAssertionFailure(msg);
    await attachHttpEvidence(this, { includeDiagnosticBundle: true });
    // Hard fail: Cucumber skips remaining steps (body criteria) for new feature order.
    throw new Error(msg);
  }
});

Then(
  'the API response header {string} should contain {string}',
  async function (headerName: string, expected: string) {
    const response = ResponseHelper.getGlobalResponse();
    if (!response) throw new Error('No API response available');
    const headers = response.headers();
    const key = Object.keys(headers).find((k) => k.toLowerCase() === headerName.toLowerCase());
    const actual = key ? String(headers[key]) : '';
    try {
      expect(actual.toLowerCase()).toContain(expected.toLowerCase());
    } catch {
      const msg = `Response header "${headerName}" expected to contain "${expected}", got "${actual}"`;
      recordAssertionFailure(msg);
      await attachHttpEvidence(this, { includeDiagnosticBundle: true });
      throw new Error(msg);
    }
  },
);

Then(
  'the API response JSON path {string} should {word} {string}',
  async function (
    this: { scenarioVars?: Record<string, string> },
    jsonPath: string,
    operator: string,
    expected: string,
  ) {
    const response = ResponseHelper.getGlobalResponse();
    if (!response) throw new Error('No API response available');
    let body: unknown;
    try {
      body = await cachedJsonBody();
    } catch {
      throw new Error('Response body is not JSON');
    }
    const actual = getByJsonPath(body, jsonPath);
    const op = (operator || 'eq').toLowerCase();
    const resolvedExpected = substituteTemplates(expected, this.scenarioVars, false);
    try {
      if (op === 'eq' || op === 'equal' || op === 'equals') {
        expect(String(actual)).toBe(resolvedExpected);
      } else if (op === 'contains') {
        expect(String(actual)).toContain(resolvedExpected);
      } else if (op === 'exists') {
        expect(actual).toBeDefined();
      } else {
        expect(String(actual)).toBe(resolvedExpected);
      }
    } catch {
      const msg = `JSON path "${jsonPath}" ${op} "${resolvedExpected}" failed (actual: ${JSON.stringify(actual)})`;
      recordAssertionFailure(msg);
      await attachHttpEvidence(this, { includeDiagnosticBundle: true });
      throw new Error(msg);
    }
  },
);

Then('the API response body should contain {string}', async function (expected: string) {
  const response = ResponseHelper.getGlobalResponse();
  if (!response) throw new Error('No API response available');
  const text = cachedBodyText();
  try {
    expect(text).toContain(expected);
  } catch {
    const msg = `Response body should contain "${expected}"`;
    recordAssertionFailure(msg);
    await attachHttpEvidence(this, { includeDiagnosticBundle: true });
    throw new Error(msg);
  }
});

Then('the API response should match JSON schema', async function (docString: string) {
  const response = ResponseHelper.getGlobalResponse();
  if (!response) throw new Error('No API response available');
  let body: any;
  try {
    body = await cachedJsonBody();
  } catch {
    throw new Error('Response body is not JSON');
  }
  let schema: any;
  try {
    schema = JSON.parse(docString);
  } catch {
    throw new Error('Schema DocString is not valid JSON');
  }
  // Lightweight required-property check (no ajv dependency in this phase)
  const required: string[] = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (body == null || typeof body !== 'object' || !(key in body)) {
      const msg = `JSON Schema: missing required property "${key}"`;
      recordAssertionFailure(msg);
      throw new Error(msg);
    }
  }
  if (schema.type === 'object' && (body === null || typeof body !== 'object' || Array.isArray(body))) {
    throw new Error('JSON Schema: expected object response');
  }
  if (schema.type === 'array' && !Array.isArray(body)) {
    throw new Error('JSON Schema: expected array response');
  }
});

function criterionOutcomes(): CriterionOutcome[] {
  const current = (global as any).__cotesterCriterionOutcomes;
  if (Array.isArray(current)) return current;
  const created: CriterionOutcome[] = [];
  (global as any).__cotesterCriterionOutcomes = created;
  return created;
}

Then(
  'criterion {string} holds: {string}',
  async function (id: string, description: string, docString?: string) {
    let spec: { type?: string; path?: string; operator?: string; expected?: unknown } = {};
    let outcome: CriterionOutcome;
    if (docString && docString.trim()) {
      try {
        spec = JSON.parse(docString);
      } catch {
        outcome = {
          id,
          description,
          type: '',
          status: 'FAIL',
          expected: 'Geçerli kriter tanımı',
          actual: 'JSON okunamadı',
          reason: 'Criterion spec is not valid JSON',
        };
        await recordCriterionOutcome(this, outcome);
        return;
      }
    }
    // After a failed status check (chain soft status, or legacy order with prior soft status),
    // do not report body criteria as PASS/FAIL — mark NOT_EVALUATED.
    if ((global as any).__cotesterStatusChecked && !(global as any).__cotesterExtractAllowed) {
      outcome = {
        id,
        description,
        type: String(spec.type || ''),
        path: spec.path,
        status: 'NOT_EVALUATED',
        expected: '',
        actual: '',
        reason: 'HTTP status expectation failed; body assertion was not evaluated.',
      };
      const metaSkip = spec as { stepId?: string; stepLabel?: string };
      if (metaSkip.stepId) outcome.stepId = String(metaSkip.stepId);
      if (metaSkip.stepLabel) outcome.stepLabel = String(metaSkip.stepLabel);
      await recordCriterionOutcome(this, outcome);
      return;
    }
    const response = ResponseHelper.getGlobalResponse();
    try {
      outcome = evaluateCriterion(
        {
          id,
          description,
          type: String(spec.type || ''),
          path: spec.path,
          operator: spec.operator,
          expected: spec.expected,
        },
        {
          responseAvailable: Boolean(response),
          json: (global as any).__cotesterResponseJson,
          headers: response ? response.headers() : {},
          elapsedMs: (global as any).__cotesterElapsedMs ?? null,
          requestJson: (global as any).__cotesterSentJson,
          requestQuery: (global as any).__cotesterSentQuery || {},
        },
      );
    } catch (error) {
      outcome = {
        id,
        description,
        type: String(spec.type || ''),
        path: spec.path,
        status: 'FAIL',
        expected: '',
        actual: 'Kontrol tamamlanamadı',
        reason: error instanceof Error ? error.message : 'Assertion çalıştırılamadı',
      };
    }
    const meta = spec as { stepId?: string; stepLabel?: string };
    if (meta.stepId) outcome.stepId = String(meta.stepId);
    if (meta.stepLabel) outcome.stepLabel = String(meta.stepLabel);
    await recordCriterionOutcome(this, outcome);
  },
);

Then('API step {string} {string} expects status {int}', async function (
  this: { scenarioVars?: Record<string, string> },
  stepId: string,
  label: string,
  expected: number,
) {
  const blocked = String((global as any).__cotesterStepBlocked || '');
  let response = ResponseHelper.getGlobalResponse();
  let elapsed = (global as any).__cotesterElapsedMs as number | undefined;
  const s = state();
  let status: CriterionOutcome['status'] = 'NOT_EVALUATED';
  let actual = '';
  let reason = blocked || 'API yanıtı yok. Durum değerlendirilmedi.';
  (global as any).__cotesterStatusChecked = true;

  if (!blocked && s.managedTokenCacheHit) {
    if (s.managedTokenExpectedStatus != null && s.managedTokenExpectedStatus !== expected) {
      status = 'FAIL';
      actual = String(s.managedTokenExpectedStatus);
      reason = `Cached token expected status ${s.managedTokenExpectedStatus} but step expects ${expected}`;
      (global as any).__cotesterExtractAllowed = false;
    } else {
      status = 'PASS';
      actual = String(expected);
      reason = 'auth_token_cache_hit';
      s.managedTokenLastExpectedStatus = expected;
      (global as any).__cotesterExtractAllowed = true;
    }
  } else if (!blocked && response) {
    actual = String(response.status());
    if (response.status() === expected) {
      status = 'PASS';
      reason = '';
      s.managedTokenLastExpectedStatus = expected;
      (global as any).__cotesterExtractAllowed = true;
    } else {
      // AUTH-SUITE-3: unexpected 401 may trigger managed-token recovery (+ safe HTTP retry).
      const snapshot = getLastHttpSendSnapshot();
      const eligibility = evaluateRecoveryEligibility({
        actualStatus: response.status(),
        expectedStatus: expected,
        snapshot,
      });
      if (eligibility.eligible && snapshot) {
        await attachAuthRecoveryNote(
          this,
          {
            kind: 'auth_401_recovery_attempt',
            expectedStatus: expected,
            initialStatus: response.status(),
            method: snapshot.method,
            httpRetryAllowed: eligibility.httpRetryAllowed,
            message: 'Unexpected 401 with managed Bearer — attempting token recovery (token value not attached).',
          },
          'Auth 401 Recovery Attempt.json',
        );
        const recovery = await runAuthRecovery({
          expectedStatus: expected,
          actualStatus: response.status(),
          snapshot,
        });
        if (recovery.tokenRefreshed && recovery.values) {
          this.scenarioVars = this.scenarioVars || {};
          for (const [name, value] of Object.entries(recovery.values)) {
            this.scenarioVars[name] = value;
            rememberSensitiveValue(value);
          }
          const bearerVar = snapshot.bearerFromScenarioVariable;
          if (bearerVar && this.scenarioVars[bearerVar]) {
            s.bearerToken = this.scenarioVars[bearerVar];
          }
        }
        if (recovery.tokenRefreshed && recovery.httpRetried && recovery.values) {
          const bearerVar = snapshot.bearerFromScenarioVariable!;
          const newToken =
            recovery.values[bearerVar] || Object.values(recovery.values)[0];
          try {
            const retried = await retrySafeHttpWithBearer(snapshot, newToken);
            beginHttpEvidence({
              method: snapshot.method,
              url: snapshot.resolvedUrl,
              path: snapshot.resolvedPath,
              query: snapshot.params,
              requestHeaders: { Authorization: 'Bearer [REDACTED]' },
              authMode: snapshot.authMode,
              requestTimestamp: new Date().toISOString(),
            });
            recordResponseEvidence(retried.status, retried.response.headers() as Record<string, string>, retried.bodyText, {
              durationMs: retried.elapsedMs,
              transportError: null,
            });
            applyResponseToGlobals(retried.response, retried.bodyText, retried.bodyJson, retried.elapsedMs);
            await attachHttpEvidence(this);
            await attachAuthRecoveryNote(
              this,
              {
                kind: 'auth_401_recovery_retry',
                initialStatus: Number(actual),
                retryStatus: retried.status,
                generation: recovery.newGeneration ?? null,
                message: 'Safe HTTP retry after managed token recovery (token value not attached).',
              },
              'Auth 401 Recovery Retry.json',
            );
            response = retried.response;
            elapsed = retried.elapsedMs;
            actual = String(retried.status);
            if (retried.status === expected) {
              status = 'PASS';
              reason = 'auth_401_recovery_retry_pass';
              s.managedTokenLastExpectedStatus = expected;
              (global as any).__cotesterExtractAllowed = true;
            } else {
              status = 'FAIL';
              reason = `Expected status ${expected} but got ${actual} after auth recovery retry`;
              (global as any).__cotesterExtractAllowed = false;
            }
          } catch (error) {
            status = 'FAIL';
            reason = error instanceof Error
              ? `Auth recovery HTTP retry failed: ${error.message}`
              : 'Auth recovery HTTP retry failed';
            (global as any).__cotesterExtractAllowed = false;
          }
        } else if (recovery.tokenRefreshed && !recovery.httpRetried) {
          status = 'FAIL';
          reason =
            `Expected status ${expected} but got ${actual}; `
            + `managed token refreshed for later steps but HTTP retry skipped for ${snapshot.method}`;
          (global as any).__cotesterExtractAllowed = false;
          await attachAuthRecoveryNote(
            this,
            {
              kind: 'auth_401_recovery_no_retry',
              method: snapshot.method,
              generation: recovery.newGeneration ?? null,
              message: recovery.note,
            },
            'Auth 401 Recovery No Retry.json',
          );
        } else if (recovery.attempted && recovery.failClosedMessage) {
          status = 'FAIL';
          reason = `Expected status ${expected} but got ${actual}; ${recovery.failClosedMessage}`;
          (global as any).__cotesterExtractAllowed = false;
        } else {
          status = 'FAIL';
          reason = `Expected status ${expected} but got ${actual}`;
          (global as any).__cotesterExtractAllowed = false;
        }
      } else {
        status = 'FAIL';
        reason = `Expected status ${expected} but got ${actual}`;
        (global as any).__cotesterExtractAllowed = false;
        if (response.status() === 401) {
          logger.info(summarizeUnauthorizedChallenge(401, response.headers() as Record<string, string>));
        }
      }
      if (s.managedTokenLockHeld) {
        releaseLock(s.managedTokenLockPath);
        s.managedTokenLockHeld = false;
        s.managedTokenLockPath = undefined;
        s.managedTokenCacheKey = undefined;
      }
    }
  } else {
    (global as any).__cotesterExtractAllowed = false;
    if (s.managedTokenLockHeld) {
      releaseLock(s.managedTokenLockPath);
      s.managedTokenLockHeld = false;
      s.managedTokenLockPath = undefined;
      s.managedTokenCacheKey = undefined;
    }
  }
  await recordCriterionOutcome(this, {
    id: `status:${stepId}`,
    description: label,
    type: 'status',
    status,
    expected: String(expected),
    actual,
    stepId,
    stepLabel: label,
    elapsedMs: elapsed,
    reason: reason || undefined,
  });
});

Then(
  'the API response JSON path {string} is stored as scenario variable {string}',
  async function (this: { scenarioVars?: Record<string, string> }, jsonPath: string, varName: string) {
    const stepId = String((global as any).__cotesterStepId || '');
    const stepLabel = String((global as any).__cotesterStepLabel || '');
    const fail = async (reason: string, status: CriterionOutcome['status'] = 'FAIL') => {
      await recordCriterionOutcome(this, {
        id: `store:${stepId}:${varName}`,
        description: `${varName} ← ${jsonPath}`,
        type: 'extract',
        status,
        expected: jsonPath,
        actual: '',
        path: jsonPath,
        stepId,
        stepLabel,
        reason,
      });
    };
    if (!SAFE_VARIABLE.test(varName) || !SAFE_JSON_PATH.test(jsonPath)) {
      await fail('Geçersiz değişken adı veya JSONPath. Değer saklanmadı.');
      return;
    }
    if ((global as any).__cotesterStepBlocked || !(global as any).__cotesterExtractAllowed) {
      await fail('Önceki yanıt durumu uygun olmadığı için değer saklanmadı.', 'NOT_EVALUATED');
      return;
    }
    const response = ResponseHelper.getGlobalResponse();
    if (!response) {
      await fail('API yanıtı yok. Değer saklanmadı.', 'NOT_EVALUATED');
      return;
    }
    let body: unknown;
    try {
      body = await cachedJsonBody();
    } catch {
      await fail('Yanıt JSON değil. Değer saklanmadı.');
      return;
    }
    const value = getByJsonPath(body, jsonPath);
    if (value === undefined || value === null) {
      await fail(`JSON path "${jsonPath}" produced no value to store`);
      return;
    }
    if (typeof value === 'object') {
      await fail('Yalnızca metin, sayı veya boolean saklanır.');
      return;
    }
    this.scenarioVars = this.scenarioVars || {};
    this.scenarioVars[varName] = String(value);
    await recordCriterionOutcome(this, {
      id: `store:${stepId}:${varName}`,
      description: `${varName} ← ${jsonPath}`,
      type: 'extract',
      status: 'PASS',
      expected: jsonPath,
      actual: String(value),
      path: jsonPath,
      stepId,
      stepLabel,
    });
  },
);

async function recordCriterionOutcome(world: unknown, outcome: CriterionOutcome): Promise<void> {
  outcome.actual = redactText(outcome.actual);
  outcome.expected = redactText(outcome.expected);
  if (outcome.reason) outcome.reason = redactText(outcome.reason);
  criterionOutcomes().push(outcome);
  console.log(`Criterion ${outcome.status} ${outcome.id || ''}`);
  // Soft-assertion marker for AfterStep logging (Cucumber step status stays PASSED until After throws).
  if (outcome.status === 'FAIL') {
    (global as any).__cotesterSoftAssertionFail = true;
  } else if (outcome.status === 'NOT_EVALUATED') {
    (global as any).__cotesterSoftAssertionSkipped = true;
  }
  const payload = JSON.stringify({ kind: 'criterion', ...outcome });
  if (typeof (world as any).attach === 'function') {
    await (world as any).attach(payload, 'application/vnd.cotester.criterion+json');
    // Human-readable Allure attachment; Cucumber step status stays PASSED until After aggregates.
    if (outcome.status === 'FAIL' || outcome.status === 'NOT_EVALUATED') {
      const lines = [
        `Criterion ${outcome.status}${outcome.id ? ` [${outcome.id}]` : ''}`,
        outcome.description ? `description: ${outcome.description}` : '',
        outcome.path ? `path: ${outcome.path}` : '',
        outcome.expected != null ? `expected: ${outcome.expected}` : '',
        outcome.actual != null ? `actual: ${outcome.actual}` : '',
        outcome.reason ? `reason: ${outcome.reason}` : '',
      ].filter(Boolean);
      await (world as any).attach(lines.join('\n'), 'text/plain');
    }
  }
  if (outcome.status === 'FAIL') {
    recordAssertionFailure(formatCriterionFailure(outcome));
  }
}

After(async function () {
  clearManagedTokenState();
  const outcomes = criterionOutcomes().slice();
  (global as any).__cotesterCriterionOutcomes = [];
  (global as any).__cotesterRedactValues = [];
  (global as any).__cotesterChainMode = false;
  (global as any).__cotesterStepBlocked = '';
  (global as any).__cotesterExtractAllowed = false;
  (global as any).__cotesterStatusChecked = false;
  (global as any).__cotesterSoftAssertionFail = false;
  (global as any).__cotesterSoftAssertionSkipped = false;
  const message = scenarioFailureMessage(outcomes);
  if (message) {
    throw new Error(message);
  }
});

Given('the API request uses Bearer token from flow context {string}', async function (contextKey: string) {
  const token = flowContext.require(contextKey);
  state().authMode = 'BEARER';
  state().bearerToken = token;
  logger.info(`Generic HTTP Bearer token loaded from flow context key "${contextKey}" (value not logged)`);
});

Given(
  'the API request uses Bearer token from scenario variable {string}',
  async function (this: { scenarioVars?: Record<string, string> }, varName: string) {
    const token = this.scenarioVars?.[varName];
    if (!token) {
      throw new Error(`Scenario variable "${varName}" is not set or empty`);
    }
    state().authMode = 'BEARER';
    state().bearerToken = token;
    state().bearerFromScenarioVariable = varName;
    logger.info(`Generic HTTP Bearer token loaded from scenario variable "${varName}" (value not logged)`);
  },
);

Then(
  'the user stores the API response JSON path {string} as sensitive flow context {string}',
  async function (jsonPath: string, key: string) {
    const response = ResponseHelper.getGlobalResponse();
    if (!response) throw new Error('No API response available');
    const body = await cachedJsonBody();
    const value = getByJsonPath(body, jsonPath);
    if (value === undefined || value === null) {
      throw new Error(`JSON path "${jsonPath}" produced no value to store`);
    }
    if (typeof value === 'object') {
      flowContext.set(key, JSON.stringify(value), { sensitive: true });
    } else {
      flowContext.set(key, value as string | number | boolean, { sensitive: true });
    }
  },
);

Then(
  'the user stores the API response JSON path {string} as sensitive scenario variable {string}',
  async function (this: { scenarioVars?: Record<string, string> }, jsonPath: string, varName: string) {
    // Do not persist tokens when a status check already failed (chain soft-fail or hard status).
    if ((global as any).__cotesterStepBlocked) {
      throw new Error(
        'Token was not stored because the request was blocked. Authenticated requests will not run.',
      );
    }
    if ((global as any).__cotesterStatusChecked && !(global as any).__cotesterExtractAllowed) {
      throw new Error(
        'Token was not stored because the previous response status was not acceptable. Authenticated requests will not run.',
      );
    }
    const s = state();
    if (s.managedTokenCacheHit) {
      const cached = s.managedTokenValues?.[varName];
      if (!cached || !String(cached).trim()) {
        throw new Error(
          `Cached token for scenario variable "${varName}" is missing (fail-closed).`,
        );
      }
      this.scenarioVars = this.scenarioVars || {};
      this.scenarioVars[varName] = cached;
      rememberSensitiveValue(cached);
      if (s.managedTokenFingerprint) {
        const bindingGen =
          lookupManagedTokenVar(varName)?.generation
          ?? s.managedTokenPreviousGeneration
          ?? 1;
        registerManagedTokenVar(varName, s.managedTokenFingerprint, bindingGen);
      }
      logger.info(`Sensitive scenario variable "${varName}" loaded from job token cache (value not logged)`);
      return;
    }
    const response = ResponseHelper.getGlobalResponse();
    if (!response) throw new Error('No API response available');
    const body = await cachedJsonBody();
    const value = getByJsonPath(body, jsonPath);
    if (value === undefined || value === null) {
      throw new Error(`JSON path "${jsonPath}" produced no value to store`);
    }
    const stored = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (!stored.trim()) {
      throw new Error(`JSON path "${jsonPath}" produced an empty token value`);
    }
    this.scenarioVars = this.scenarioVars || {};
    this.scenarioVars[varName] = stored;
    rememberSensitiveValue(stored);

    // Miss/renew path: persist into job cache (lock released after first write; generation-safe).
    if (s.managedTokenCacheKey && s.managedTokenFingerprint && !s.managedTokenCacheHit) {
      try {
        const acquiredAt = Date.now();
        const expiration = resolveExpiration(acquiredAt, body, stored);
        const expectedStatus = s.managedTokenLastExpectedStatus ?? response.status();
        const lockToRelease = s.managedTokenLockHeld ? s.managedTokenLockPath : null;
        const previousGeneration = s.managedTokenPreviousGeneration ?? 0;
        const recipe: TokenAcquisitionRecipe | undefined = s.managedTokenRecipe
          ? {
              ...s.managedTokenRecipe,
              expectedStatus,
              extracts: (() => {
                const list = [...(s.managedTokenRecipe.extracts || [])];
                const idx = list.findIndex((e) => e.path === jsonPath);
                if (idx >= 0) list[idx] = { name: varName, path: jsonPath };
                else list.push({ name: varName, path: jsonPath });
                return list.filter((e) => e.name);
              })(),
            }
          : undefined;
        const result = mergeStoreValue(
          s.managedTokenCacheKey,
          varName,
          stored,
          expectedStatus,
          expiration,
          lockToRelease,
          previousGeneration,
          recipe,
        );
        s.managedTokenLockHeld = false;
        s.managedTokenLockPath = undefined;
        if (!result.stored && result.reason === 'stale_generation') {
          logger.info('Managed token store skipped: newer generation already cached (value not logged)');
        } else {
          registerManagedTokenVar(varName, s.managedTokenFingerprint!, previousGeneration + 1);
          logger.info(
            `Managed token ${s.managedTokenRenewing ? 'renewed' : 'stored'} in job-scoped cache `
              + `(source=${expiration.source}; value not logged)`,
          );
          await attachAuthTokenRenewalNote(this, {
            generation: previousGeneration + 1,
            expirationSource: expiration.source,
            renewing: Boolean(s.managedTokenRenewing),
          });
        }
      } catch (error) {
        releaseLock(s.managedTokenLockPath);
        s.managedTokenLockHeld = false;
        s.managedTokenLockPath = undefined;
        s.managedTokenCacheKey = undefined;
        throw new Error(
          error instanceof Error
            ? `Token cache store failed (fail-closed): ${error.message}`
            : 'Token cache store failed (fail-closed).',
        );
      }
    }
  },
);

Then(
  'the user stores the API response JSON path {string} as flow context {string}',
  async function (jsonPath: string, key: string) {
    const response = ResponseHelper.getGlobalResponse();
    if (!response) throw new Error('No API response available');
    const body = await cachedJsonBody();
    const value = getByJsonPath(body, jsonPath);
    if (value === undefined || value === null) {
      throw new Error(`JSON path "${jsonPath}" produced no value to store`);
    }
    if (typeof value === 'object') {
      flowContext.set(key, JSON.stringify(value));
    } else {
      flowContext.set(key, value as string | number | boolean);
    }
  },
);

Given('the API request uses flow context {string} as query parameter {string}', async function (
  contextKey: string,
  queryKey: string,
) {
  const value = flowContext.require(contextKey);
  state().query[queryKey] = String(value);
});
