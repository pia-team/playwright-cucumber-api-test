/**
 * Token Request body credential placeholders — resolved from job-scoped Credential Profile
 * into the request body only. Values never enter scenarioVars.
 */
import { loadRuntimeCredentialsFile, type RuntimeCredentialType } from './runtimeCredentials';
import { placeholderNames } from './scenarioTemplate';

/** Feature placeholder name → Credential Profile secret key + allowed profile types. */
export const CREDENTIAL_BODY_PLACEHOLDERS: Record<
  string,
  { secretKey: string; types: RuntimeCredentialType[] }
> = {
  username: {
    secretKey: 'username',
    types: ['KEYCLOAK', 'BASIC_AUTH', 'WEB_LOGIN', 'MOBILE_LOGIN'],
  },
  password: {
    secretKey: 'password',
    types: ['KEYCLOAK', 'BASIC_AUTH', 'WEB_LOGIN', 'MOBILE_LOGIN'],
  },
  client_id: {
    secretKey: 'clientId',
    types: ['KEYCLOAK'],
  },
  client_secret: {
    secretKey: 'clientSecret',
    types: ['KEYCLOAK'],
  },
};

export const CREDENTIAL_PLACEHOLDER_NAMES = new Set(Object.keys(CREDENTIAL_BODY_PLACEHOLDERS));

const NAMED = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

export function isCredentialBodyPlaceholder(name: string): boolean {
  return CREDENTIAL_PLACEHOLDER_NAMES.has(name);
}

export function credentialPlaceholdersIn(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...new Set(placeholderNames(text).filter(isCredentialBodyPlaceholder))];
}

function escapeJsonString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function loadCredentialSecrets(): {
  type: RuntimeCredentialType;
  secrets: Record<string, string>;
} {
  const file = loadRuntimeCredentialsFile();
  if (!file) {
    throw new Error(
      'Token Request credential body placeholders require a Credential Profile for this run. '
        + 'Select a profile and try again. The request was not sent.',
    );
  }
  return { type: file.type, secrets: file.secrets || {} };
}

/**
 * Resolve allowlisted {{username}} / {{password}} / {{client_id}} / {{client_secret}}
 * from the runtime Credential Profile. Does not use scenarioVars for secret values.
 * Throws on missing profile/field, unsupported type, or name collision with scenarioVars.
 */
export function resolveCredentialBodyPlaceholders(
  body: string,
  contentType: string | null | undefined,
  scenarioVars?: Record<string, string>,
): { body: string; sensitiveValues: string[] } {
  const names = credentialPlaceholdersIn(body);
  if (names.length === 0) {
    return { body, sensitiveValues: [] };
  }

  for (const name of names) {
    const existing = scenarioVars?.[name];
    if (existing != null && existing !== '') {
      throw new Error(
        `Credential placeholder {{${name}}} conflicts with scenario variable "${name}". `
          + 'Rename the scenario variable or remove the credential placeholder. The request was not sent.',
      );
    }
  }

  const { type, secrets } = loadCredentialSecrets();
  const resolved: Record<string, string> = {};
  const sensitiveValues: string[] = [];

  for (const name of names) {
    const meta = CREDENTIAL_BODY_PLACEHOLDERS[name];
    if (!meta.types.includes(type)) {
      throw new Error(
        `Credential placeholder {{${name}}} is not supported by Credential Profile type ${type}. `
          + `Use a profile that provides ${meta.secretKey}. The request was not sent.`,
      );
    }
    const value = secrets[meta.secretKey];
    if (value == null || value === '') {
      throw new Error(
        `Credential field "${meta.secretKey}" is missing or empty on the selected Credential Profile. `
          + `Cannot resolve {{${name}}}. The request was not sent.`,
      );
    }
    resolved[name] = value;
    sensitiveValues.push(value);
  }

  const trimmed = body.trim();
  const isForm =
    (contentType || '').toLowerCase().includes('application/x-www-form-urlencoded')
    || (!trimmed.startsWith('{') && !trimmed.startsWith('[') && trimmed.includes('=') && trimmed.includes('&'));
  const next = body.replace(NAMED, (full, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(resolved, name)) {
      return full;
    }
    const value = resolved[name];
    return isForm ? encodeURIComponent(value) : escapeJsonString(value);
  });

  // Fail-closed: no credential placeholder may remain.
  const leftover = credentialPlaceholdersIn(next);
  if (leftover.length > 0) {
    throw new Error(
      `Credential placeholders were not resolved: ${leftover.map((n) => `{{${n}}}`).join(', ')}. `
        + 'The request was not sent.',
    );
  }

  return { body: next, sensitiveValues };
}
