import { AuthHelper } from './authHelper';
import { envConfig } from '../config/env.config';
import { logger } from './logger';
import { hydrateRuntimeCredentialEnv } from './runtimeCredentials';

export type RuntimeAuthMode = 'NONE' | 'BEARER' | 'KEYCLOAK' | 'BASIC' | 'API_KEY';

export type ResolvedRequestAuth = {
  headers: Record<string, string>;
  query: Record<string, string>;
};

export type ResolveAuthOptions = {
  /** Step-level Bearer token (wins over API_TOKEN / env profile). */
  bearerToken?: string;
};

/**
 * Resolves auth for generic HTTP steps.
 * Precedence: step options (e.g. bearerToken) → runtime Credential Profile env / credentials file → legacy config.
 * Step auth mode NONE explicitly skips Authorization and profile auth headers.
 */
export async function resolveRequestAuth(
  mode: RuntimeAuthMode,
  options?: ResolveAuthOptions,
): Promise<ResolvedRequestAuth> {
  hydrateRuntimeCredentialEnv();
  const normalized = (mode || 'NONE').toUpperCase() as RuntimeAuthMode;

  if (normalized === 'NONE') {
    logger.debug('API auth mode NONE — no auth headers or query from profile');
    return { headers: {}, query: {} };
  }

  if (normalized === 'BEARER') {
    const token =
      options?.bearerToken?.trim() ||
      process.env.API_TOKEN?.trim() ||
      envConfig.token?.trim();
    if (!token) {
      throw new Error(
        'BEARER auth selected but no token is available. Set API_TOKEN via CoTester Credential Profile or pass a step-level Bearer token.',
      );
    }
    logger.info('API auth mode BEARER — token applied (value not logged)');
    return { headers: { Authorization: `Bearer ${token}` }, query: {} };
  }

  if (normalized === 'BASIC') {
    const username = process.env.API_BASIC_USERNAME?.trim();
    const password = process.env.API_BASIC_PASSWORD;
    if (!username || password == null || password === '') {
      throw new Error(
        'BASIC auth selected but API_BASIC_USERNAME/API_BASIC_PASSWORD are not set. Configure a BASIC Credential Profile.',
      );
    }
    const encoded = Buffer.from(`${username}:${password}`, 'utf-8').toString('base64');
    logger.info('API auth mode BASIC — credentials applied (values not logged)');
    return { headers: { Authorization: `Basic ${encoded}` }, query: {} };
  }

  if (normalized === 'API_KEY') {
    const value = process.env.API_KEY_VALUE?.trim();
    if (!value) {
      throw new Error(
        'API_KEY auth selected but API_KEY_VALUE is not set. Configure an API Key Credential Profile.',
      );
    }
    const placement = (process.env.API_KEY_PLACEMENT || 'header').trim().toLowerCase();
    if (placement === 'query') {
      const queryName = process.env.API_KEY_QUERY?.trim() || 'api_key';
      logger.info(`API auth mode API_KEY — query param "${queryName}" applied (value not logged)`);
      return { headers: {}, query: { [queryName]: value } };
    }
    const headerName = process.env.API_KEY_HEADER?.trim() || 'X-API-Key';
    logger.info(`API auth mode API_KEY — header "${headerName}" applied (value not logged)`);
    return { headers: { [headerName]: value }, query: {} };
  }

  if (normalized === 'KEYCLOAK') {
    const existing = AuthHelper.getAccessToken();
    if (existing) {
      logger.info('API auth mode KEYCLOAK — using scenario-scoped cached access token');
      return { headers: { Authorization: `Bearer ${existing}` }, query: {} };
    }
    const credentials = AuthHelper.getConfiguredCredentials();
    await AuthHelper.getToken(credentials);
    const token = AuthHelper.getAccessToken();
    if (!token) {
      throw new Error('KEYCLOAK auth failed — could not obtain access token');
    }
    logger.info('API auth mode KEYCLOAK — token obtained (value not logged)');
    return { headers: { Authorization: `Bearer ${token}` }, query: {} };
  }

  throw new Error(`Unsupported auth mode: ${mode}`);
}

/** @deprecated Use resolveRequestAuth — returns Authorization / API key headers only. */
export async function resolveAuthorizationHeader(
  mode: RuntimeAuthMode,
  options?: ResolveAuthOptions,
): Promise<Record<string, string>> {
  const resolved = await resolveRequestAuth(mode, options);
  return resolved.headers;
}

/** Merge request headers/query with auth; profile auth wins over duplicate keys in step tables. */
export function mergeHeadersWithoutAuthConflict(
  base: Record<string, string>,
  authHeaders: Record<string, string>,
): Record<string, string> {
  const merged: Record<string, string> = {};
  const authKeysLower = new Set(Object.keys(authHeaders || {}).map((k) => k.toLowerCase()));
  for (const [k, v] of Object.entries(base || {})) {
    if (!k) {
      continue;
    }
    const lower = k.toLowerCase();
    if (lower === 'authorization' || authKeysLower.has(lower)) {
      continue;
    }
    merged[k] = v;
  }
  for (const [k, v] of Object.entries(authHeaders || {})) {
    merged[k] = v;
  }
  return merged;
}

export function mergeQueryWithAuth(
  base: Record<string, string>,
  authQuery: Record<string, string>,
): Record<string, string> {
  if (!authQuery || Object.keys(authQuery).length === 0) {
    return { ...base };
  }
  const merged = { ...base };
  for (const [k, v] of Object.entries(authQuery)) {
    merged[k] = v;
  }
  return merged;
}
