import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { keycloakTokenUri } from '../src/config/projectEnv';
import {
  buildPasswordGrantForm,
  resolveKeycloakTokenEndpointUrl,
} from '../src/services/authService';
import {
  AuthHelper,
  resolveKeycloakClientSecret,
} from '../src/utils/authHelper';
import { resolveRequestAuth } from '../src/utils/authResolution';
import {
  resetRuntimeCredentialsCacheForTests,
} from '../src/utils/runtimeCredentials';
import { isTokenCurlCredential } from '../src/utils/tokenCurlAuth';
import { redactFormUrlEncoded } from '../src/utils/httpEvidence';

const ENV_KEYS = [
  'API_TEST_USERNAME',
  'API_TEST_PASSWORD',
  'API_TEST_CLIENT_ID',
  'API_TEST_CLIENT_SECRET',
  'API_KEYCLOAK_URL',
  'API_KEYCLOAK_TOKEN_URL',
  'API_KEYCLOAK_BASE_URL',
  'API_TOKEN',
  'COTESTER_RUNTIME_CREDENTIALS_FILE',
  'COTESTER_TOKEN_CURL',
  'COTESTER_RUNTIME_DIR',
] as const;

const savedEnv: Record<string, string | undefined> = {};

function snapshotEnv(): void {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
}

describe('keycloakTokenUri', () => {
  it('defaults orbitant-realm for origin-only URL', () => {
    assert.equal(
      keycloakTokenUri('https://auth.example.com'),
      'https://auth.example.com/realms/orbitant-realm/protocol/openid-connect/token',
    );
  });

  it('preserves custom realm', () => {
    assert.equal(
      keycloakTokenUri('https://auth.example.com/realms/customer-realm'),
      'https://auth.example.com/realms/customer-realm/protocol/openid-connect/token',
    );
  });

  it('keeps full token endpoint without duplicating path', () => {
    const full =
      'https://auth.example.com/realms/customer-realm/protocol/openid-connect/token';
    assert.equal(keycloakTokenUri(full), full);
    assert.equal(keycloakTokenUri(`${full}/`), full);
  });

  it('preserves port on origin default realm', () => {
    assert.equal(
      keycloakTokenUri('http://127.0.0.1:8443'),
      'http://127.0.0.1:8443/realms/orbitant-realm/protocol/openid-connect/token',
    );
  });

  it('rejects empty and invalid URLs', () => {
    assert.throws(() => keycloakTokenUri(''), /empty/i);
    assert.throws(() => keycloakTokenUri('not a url'), /invalid/i);
    assert.throws(() => keycloakTokenUri('ftp://auth.example.com'), /http/i);
  });
});

describe('buildPasswordGrantForm / client secret', () => {
  it('omits client_secret for public clients', () => {
    const form = buildPasswordGrantForm({
      grant_type: 'password',
      client_id: 'public-client',
      username: 'u',
      password: 'p',
    });
    assert.equal(form.client_secret, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(form, 'client_secret'), false);
    assert.equal(form.grant_type, 'password');
    assert.equal(form.client_id, 'public-client');
  });

  it('includes client_secret for confidential clients', () => {
    const form = buildPasswordGrantForm({
      grant_type: 'password',
      client_id: 'conf-client',
      username: 'u',
      password: 'p',
      client_secret: 'top-secret-value',
    });
    assert.equal(form.client_secret, 'top-secret-value');
  });

  it('treats blank client_secret as absent', () => {
    const form = buildPasswordGrantForm({
      grant_type: 'password',
      client_id: 'c',
      username: 'u',
      password: 'p',
      client_secret: '   ',
    });
    assert.equal(Object.prototype.hasOwnProperty.call(form, 'client_secret'), false);
  });
});

describe('resolveKeycloakClientSecret', () => {
  beforeEach(() => {
    snapshotEnv();
    resetRuntimeCredentialsCacheForTests();
  });
  afterEach(() => {
    restoreEnv();
    resetRuntimeCredentialsCacheForTests();
  });

  it('reads API_TEST_CLIENT_SECRET from env', () => {
    process.env.API_TEST_CLIENT_SECRET = 'env-secret';
    assert.equal(resolveKeycloakClientSecret(), 'env-secret');
  });

  it('ignores masked secret values', () => {
    process.env.API_TEST_CLIENT_SECRET = '[REDACTED]';
    assert.equal(resolveKeycloakClientSecret(), undefined);
  });

  it('falls back to credentials file clientSecret', () => {
    const file = path.join(os.tmpdir(), `kc-cred-${Date.now()}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify({
        type: 'KEYCLOAK',
        secrets: { clientSecret: 'file-secret', username: 'u', password: 'p' },
      }),
      'utf8',
    );
    process.env.COTESTER_RUNTIME_CREDENTIALS_FILE = file;
    assert.equal(resolveKeycloakClientSecret(), 'file-secret');
    fs.unlinkSync(file);
  });
});

describe('Keycloak AuthHelper mock HTTP smoke', () => {
  let server: http.Server;
  let baseUrl = '';
  const captured: { url: string; body: string }[] = [];

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url?.includes('/protocol/openid-connect/token')) {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          captured.push({ url: req.url || '', body });
          const params = new URLSearchParams(body);
          if (params.get('username') === 'bad-user') {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_grant' }));
            return;
          }
          if (params.get('client_id') === 'needs-secret' && !params.get('client_secret')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'unauthorized_client' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              access_token: 'mock-kc-access',
              expires_in: 300,
              token_type: 'Bearer',
            }),
          );
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  });

  beforeEach(() => {
    snapshotEnv();
    resetRuntimeCredentialsCacheForTests();
    captured.length = 0;
    AuthHelper.clearToken();
    process.env.COTESTER_RUNTIME_DIR = path.join(os.tmpdir(), `kc-job-${Date.now()}`);
  });

  afterEach(() => {
    AuthHelper.clearToken();
    restoreEnv();
    resetRuntimeCredentialsCacheForTests();
  });

  it('public client: no client_secret on wire; default realm path', async () => {
    process.env.API_TEST_USERNAME = 'alice';
    process.env.API_TEST_PASSWORD = 'pw';
    process.env.API_TEST_CLIENT_ID = 'public-client';
    process.env.API_KEYCLOAK_URL = baseUrl;

    const creds = AuthHelper.getConfiguredCredentials();
    assert.equal(creds.client_secret, undefined);
    assert.equal(
      resolveKeycloakTokenEndpointUrl(),
      `${baseUrl}/realms/orbitant-realm/protocol/openid-connect/token`,
    );

    const response = await AuthHelper.getToken(creds);
    assert.equal(response.status(), 200);
    assert.equal(AuthHelper.getAccessToken(), 'mock-kc-access');
    assert.equal(captured.length, 1);
    assert.match(captured[0].url, /\/realms\/orbitant-realm\/protocol\/openid-connect\/token$/);
    assert.match(captured[0].body, /grant_type=password/);
    assert.match(captured[0].body, /client_id=public-client/);
    assert.equal(captured[0].body.includes('client_secret'), false);
  });

  it('confidential client: sends client_secret', async () => {
    process.env.API_TEST_USERNAME = 'alice';
    process.env.API_TEST_PASSWORD = 'pw';
    process.env.API_TEST_CLIENT_ID = 'needs-secret';
    process.env.API_TEST_CLIENT_SECRET = 'wire-secret-value';
    process.env.API_KEYCLOAK_URL = `${baseUrl}/realms/customer-realm`;

    const creds = AuthHelper.getConfiguredCredentials();
    assert.equal(creds.client_secret, 'wire-secret-value');
    const response = await AuthHelper.getToken(creds);
    assert.equal(response.status(), 200);
    assert.equal(captured.length, 1);
    assert.match(captured[0].url, /\/realms\/customer-realm\/protocol\/openid-connect\/token$/);
    assert.match(captured[0].body, /client_secret=wire-secret-value/);
  });

  it('full token endpoint URL is used as-is', async () => {
    const tokenUrl = `${baseUrl}/realms/custom/protocol/openid-connect/token`;
    process.env.API_TEST_USERNAME = 'alice';
    process.env.API_TEST_PASSWORD = 'pw';
    process.env.API_KEYCLOAK_URL = tokenUrl;

    await AuthHelper.getToken(AuthHelper.getConfiguredCredentials());
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, '/realms/custom/protocol/openid-connect/token');
  });

  it('invalid credentials: no access token; resolveRequestAuth fails closed', async () => {
    process.env.API_TEST_USERNAME = 'bad-user';
    process.env.API_TEST_PASSWORD = 'pw';
    process.env.API_KEYCLOAK_URL = `${baseUrl}/realms/orbitant-realm`;

    await assert.rejects(
      () => resolveRequestAuth('KEYCLOAK'),
      /KEYCLOAK auth failed|could not obtain/i,
    );
    assert.equal(AuthHelper.getAccessToken(), null);
  });

  it('resolveRequestAuth KEYCLOAK applies Bearer header', async () => {
    process.env.API_TEST_USERNAME = 'alice';
    process.env.API_TEST_PASSWORD = 'pw';
    process.env.API_KEYCLOAK_URL = `${baseUrl}/realms/orbitant-realm`;

    const auth = await resolveRequestAuth('KEYCLOAK');
    assert.equal(auth.headers.Authorization, 'Bearer mock-kc-access');
  });
});

describe('KEYCLOAK fix — regressions and redaction', () => {
  beforeEach(() => {
    snapshotEnv();
    resetRuntimeCredentialsCacheForTests();
  });
  afterEach(() => {
    restoreEnv();
    resetRuntimeCredentialsCacheForTests();
  });

  it('BEARER_TOKEN still uses API_TOKEN without Keycloak', async () => {
    process.env.API_TOKEN = 'bearer-regression-token';
    const auth = await resolveRequestAuth('BEARER');
    assert.equal(auth.headers.Authorization, 'Bearer bearer-regression-token');
  });

  it('TOKEN_CURL flag is independent of KEYCLOAK env', () => {
    process.env.API_TEST_USERNAME = 'u';
    process.env.API_TEST_PASSWORD = 'p';
    process.env.API_KEYCLOAK_URL = 'https://auth.example.com';
    delete process.env.COTESTER_TOKEN_CURL;
    assert.equal(isTokenCurlCredential(), false);
    process.env.COTESTER_TOKEN_CURL = '1';
    assert.equal(isTokenCurlCredential(), true);
  });

  it('http evidence redacts client_secret in form bodies', () => {
    const body =
      'grant_type=password&client_id=c&username=u&password=secret123&client_secret=abc123';
    const redacted = redactFormUrlEncoded(body);
    assert.ok(redacted);
    assert.match(redacted!, /client_secret=\[REDACTED\]/);
    assert.equal(redacted!.includes('abc123'), false);
    assert.equal(redacted!.includes('secret123'), false);
  });
});
