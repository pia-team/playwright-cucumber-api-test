import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  credentialPlaceholdersIn,
  resolveCredentialBodyPlaceholders,
} from '../src/utils/credentialBodyBinding';
import { resetRuntimeCredentialsCacheForTests } from '../src/utils/runtimeCredentials';

describe('credentialBodyBinding', () => {
  const savedCredFile = process.env.COTESTER_RUNTIME_CREDENTIALS_FILE;
  let tempDir: string | undefined;

  afterEach(() => {
    resetRuntimeCredentialsCacheForTests();
    if (savedCredFile === undefined) {
      delete process.env.COTESTER_RUNTIME_CREDENTIALS_FILE;
    } else {
      process.env.COTESTER_RUNTIME_CREDENTIALS_FILE = savedCredFile;
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  function writeCreds(type: string, secrets: Record<string, string>) {
    resetRuntimeCredentialsCacheForTests();
    tempDir = mkdtempSync(join(tmpdir(), 'cotester-cred-'));
    const file = join(tempDir, 'credentials.env.json');
    writeFileSync(file, JSON.stringify({ type, secrets }), 'utf8');
    process.env.COTESTER_RUNTIME_CREDENTIALS_FILE = file;
  }

  it('lists credential placeholders only', () => {
    assert.deepEqual(
      credentialPlaceholdersIn('{"username":"{{username}}","id":"{{customerId}}"}'),
      ['username'],
    );
  });

  it('binds JSON username/password with escaping', () => {
    writeCreds('KEYCLOAK', {
      username: 'ada',
      password: 'p"ass\\word\n',
      keycloakUrl: 'https://kc.example',
      clientId: 'app',
    });
    const { body, sensitiveValues } = resolveCredentialBodyPlaceholders(
      '{"username":"{{username}}","password":"{{password}}"}',
      'application/json',
      {},
    );
    assert.equal(body.includes('{{username}}'), false);
    assert.equal(body.includes('{{password}}'), false);
    assert.match(body, /ada/);
    assert.match(body, /p\\"ass\\\\word\\n/);
    assert.ok(sensitiveValues.some((v) => v.includes('ass')));
  });

  it('binds form-urlencoded with percent-encoding', () => {
    writeCreds('BASIC_AUTH', {
      username: 'user&name',
      password: 'p=a+s%s',
    });
    const { body } = resolveCredentialBodyPlaceholders(
      'grant_type=password&username={{username}}&password={{password}}',
      'application/x-www-form-urlencoded',
      {},
    );
    assert.match(body, /grant_type=password/);
    assert.match(body, /username=user%26name/);
    assert.match(body, /password=p%3Da%2Bs%25s/);
    assert.equal(body.includes('{{'), false);
  });

  it('binds client_secret for KEYCLOAK', () => {
    writeCreds('KEYCLOAK', {
      username: 'u',
      password: 'p',
      clientId: 'cid',
      clientSecret: 'cs&1',
      keycloakUrl: 'https://kc.example',
    });
    const { body } = resolveCredentialBodyPlaceholders(
      'client_id={{client_id}}&client_secret={{client_secret}}',
      'application/x-www-form-urlencoded',
      {},
    );
    assert.match(body, /client_id=cid/);
    assert.match(body, /client_secret=cs%261/);
  });

  it('fails closed without credential file', () => {
    resetRuntimeCredentialsCacheForTests();
    delete process.env.COTESTER_RUNTIME_CREDENTIALS_FILE;
    assert.throws(
      () =>
        resolveCredentialBodyPlaceholders(
          '{"username":"{{username}}"}',
          'application/json',
          {},
        ),
      /Credential Profile/,
    );
  });

  it('rejects collision with scenario variable', () => {
    writeCreds('BASIC_AUTH', { username: 'a', password: 'b' });
    assert.throws(
      () =>
        resolveCredentialBodyPlaceholders('{"username":"{{username}}"}', 'application/json', {
          username: 'from-scenario',
        }),
      /conflicts/,
    );
  });

  it('rejects client_secret on BASIC_AUTH profile', () => {
    writeCreds('BASIC_AUTH', { username: 'a', password: 'b' });
    assert.throws(
      () =>
        resolveCredentialBodyPlaceholders(
          'client_secret={{client_secret}}&username={{username}}',
          'application/x-www-form-urlencoded',
          {},
        ),
      /not supported by Credential Profile type BASIC_AUTH/,
    );
  });

  it('rejects missing credential field', () => {
    writeCreds('BASIC_AUTH', { username: 'a' });
    assert.throws(
      () =>
        resolveCredentialBodyPlaceholders(
          'password={{password}}',
          'application/x-www-form-urlencoded',
          {},
        ),
      /missing or empty/,
    );
  });
});
