import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { ApiContext } from '../../../core/api/apiContext';
import { ApiClient } from '../../../core/api/apiClient';
import { ResponseHelper } from '../../../utils/responseHelper';
import { logger } from '../../../utils/logger';
import {
  beginHttpEvidence,
  evidenceForAttach,
  recordAssertionFailure,
  recordResponseEvidence,
  resetHttpEvidence,
} from '../../../utils/httpEvidence';
import {
  mergeHeadersWithoutAuthConflict,
  mergeQueryWithAuth,
  resolveRequestAuth,
  RuntimeAuthMode,
} from '../../../utils/authResolution';
import { flowContext } from '../../../utils/flowContext';

type GenericHttpState = {
  authMode: RuntimeAuthMode;
  bearerToken?: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string | null;
  contentType: string | null;
};

function state(): GenericHttpState {
  const g = global as any;
  if (!g.__cotesterGenericHttp) {
    g.__cotesterGenericHttp = {
      authMode: 'NONE' as RuntimeAuthMode,
      bearerToken: undefined,
      headers: {},
      query: {},
      body: null,
      contentType: null,
    };
  }
  return g.__cotesterGenericHttp as GenericHttpState;
}

function tableToMap(table: DataTable): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of table.raw()) {
    if (!row || row.length < 2) continue;
    const key = String(row[0] ?? '').trim();
    const value = String(row[1] ?? '').trim();
    if (key && key.toLowerCase() !== 'authorization') {
      out[key] = value;
    }
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

Given('the API request uses auth mode {string}', async function (mode: string) {
  resetHttpEvidence();
  const normalized = (mode || 'NONE').toUpperCase() as RuntimeAuthMode;
  if (!['NONE', 'BEARER', 'KEYCLOAK', 'BASIC', 'API_KEY'].includes(normalized)) {
    throw new Error(`Unsupported auth mode "${mode}". Use NONE, BEARER, KEYCLOAK, BASIC, or API_KEY.`);
  }
  state().authMode = normalized;
  state().bearerToken = undefined;
  state().headers = {};
  state().query = {};
  state().body = null;
  state().contentType = null;
  beginHttpEvidence({ authMode: normalized, method: 'GET', url: '' });
  logger.info(`Generic HTTP auth mode set to ${normalized}`);
});

Given('the API request headers are', async function (table: DataTable) {
  Object.assign(state().headers, tableToMap(table));
});

Given('the API request query parameters are', async function (table: DataTable) {
  Object.assign(state().query, tableToMap(table));
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

When(
  'the user sends a {word} request to {string}',
  async function (this: { scenarioVars?: Record<string, string> }, method: string, path: string) {
    const m = (method || 'GET').toUpperCase();
    const s = state();
    const auth = await resolveRequestAuth(s.authMode, { bearerToken: s.bearerToken });
    const headers = mergeHeadersWithoutAuthConflict(s.headers, auth.headers);
    if (s.contentType && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = s.contentType;
    }

    const clientContext = await ApiContext.create(headers);
    const client = new ApiClient(clientContext);

    const urlPath = resolveRequestPath(path, this.scenarioVars);
    const params = mergeQueryWithAuth(s.query, auth.query);
    beginHttpEvidence({
      method: m,
      url: urlPath,
      path: urlPath,
      requestHeaders: headers,
      requestBody: s.body,
      authMode: s.authMode,
    });

    let response: any;
    const bodyPayload = s.body
      ? (() => {
          try {
            return JSON.parse(s.body);
          } catch {
            return s.body;
          }
        })()
      : undefined;

    const isForm =
      (headers['Content-Type'] || headers['content-type'] || '')
        .toLowerCase()
        .includes('application/x-www-form-urlencoded');

    switch (m) {
      case 'GET':
        response = await client.get(urlPath, { headers, params });
        break;
      case 'POST':
        response = await client.post(urlPath, bodyPayload, { headers, form: isForm });
        break;
      case 'PUT':
        response = await client.put(urlPath, bodyPayload, { headers });
        break;
      case 'PATCH':
        response = await client.patch(urlPath, bodyPayload, { headers });
        break;
      case 'DELETE':
        response = await client.delete(urlPath, { headers });
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${m}`);
    }

    await ResponseHelper.logAndSetResponse(response, m, urlPath, params);
    (global as any).currentResponse = response;

    let bodyText: string | null = null;
    try {
      bodyText = await response.text();
    } catch {
      bodyText = null;
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
    recordResponseEvidence(response.status(), response.headers(), bodyText);

    const attach = evidenceForAttach(false);
    if (attach && typeof (this as any).attach === 'function') {
      await (this as any).attach(attach, 'application/json');
    }
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

Then('the API response status should be {int}', async function (expected: number) {
  const response = ResponseHelper.getGlobalResponse();
  if (!response) {
    throw new Error('No API response available');
  }
  beginHttpEvidence({ expectedStatus: expected });
  const actual = response.status();
  try {
    expect(actual).toBe(expected);
  } catch (e: any) {
    const msg = `Expected status ${expected} but got ${actual}`;
    recordAssertionFailure(msg);
    const attach = evidenceForAttach(true);
    if (attach && typeof (this as any).attach === 'function') {
      await (this as any).attach(attach, 'application/json');
    }
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
      const attach = evidenceForAttach(true);
      if (attach && typeof (this as any).attach === 'function') {
        await (this as any).attach(attach, 'application/json');
      }
      throw new Error(msg);
    }
  },
);

Then(
  'the API response JSON path {string} should {word} {string}',
  async function (jsonPath: string, operator: string, expected: string) {
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
    try {
      if (op === 'eq' || op === 'equal' || op === 'equals') {
        expect(String(actual)).toBe(expected);
      } else if (op === 'contains') {
        expect(String(actual)).toContain(expected);
      } else if (op === 'exists') {
        expect(actual).toBeDefined();
      } else {
        expect(String(actual)).toBe(expected);
      }
    } catch {
      const msg = `JSON path "${jsonPath}" ${op} "${expected}" failed (actual: ${JSON.stringify(actual)})`;
      recordAssertionFailure(msg);
      const attach = evidenceForAttach(true);
      if (attach && typeof (this as any).attach === 'function') {
        await (this as any).attach(attach, 'application/json');
      }
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
    const attach = evidenceForAttach(true);
    if (attach && typeof (this as any).attach === 'function') {
      await (this as any).attach(attach, 'application/json');
    }
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
    const response = ResponseHelper.getGlobalResponse();
    if (!response) throw new Error('No API response available');
    const body = await cachedJsonBody();
    const value = getByJsonPath(body, jsonPath);
    if (value === undefined || value === null) {
      throw new Error(`JSON path "${jsonPath}" produced no value to store`);
    }
    this.scenarioVars = this.scenarioVars || {};
    this.scenarioVars[varName] = typeof value === 'object' ? JSON.stringify(value) : String(value);
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
