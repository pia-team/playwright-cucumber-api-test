import * as fs from 'fs';

export type RuntimeCredentialType =
  | 'WEB_LOGIN'
  | 'MOBILE_LOGIN'
  | 'KEYCLOAK'
  | 'BEARER_TOKEN'
  | 'BASIC_AUTH'
  | 'API_KEY';

export interface RuntimeCredentialsFile {
  type: RuntimeCredentialType;
  secrets: Record<string, string>;
}

let cachedFile: RuntimeCredentialsFile | null | undefined;

/** Read job-scoped credentials JSON (COTESTER_RUNTIME_CREDENTIALS_FILE); never log contents. */
export function loadRuntimeCredentialsFile(): RuntimeCredentialsFile | null {
  if (cachedFile !== undefined) {
    return cachedFile;
  }
  const filePath = process.env.COTESTER_RUNTIME_CREDENTIALS_FILE?.trim();
  if (!filePath || !fs.existsSync(filePath)) {
    cachedFile = null;
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as RuntimeCredentialsFile).type === 'string' &&
      (parsed as RuntimeCredentialsFile).secrets &&
      typeof (parsed as RuntimeCredentialsFile).secrets === 'object'
    ) {
      cachedFile = parsed as RuntimeCredentialsFile;
      return cachedFile;
    }
  } catch {
    // ignore — env injection is primary
  }
  cachedFile = null;
  return null;
}

function putIfBlank(key: string, value: string | undefined): void {
  if (value == null || value === '') {
    return;
  }
  const existing = process.env[key];
  if (existing == null || existing.trim() === '') {
    process.env[key] = value;
  }
}

/** Fill process env from runtime credentials file when CoTester did not inject a specific key. */
export function hydrateRuntimeCredentialEnv(): void {
  const file = loadRuntimeCredentialsFile();
  if (!file) {
    return;
  }
  const s = file.secrets;
  switch (file.type) {
    case 'BEARER_TOKEN':
      putIfBlank('API_TOKEN', s.token);
      break;
    case 'BASIC_AUTH':
      putIfBlank('API_BASIC_USERNAME', s.username);
      putIfBlank('API_BASIC_PASSWORD', s.password);
      break;
    case 'API_KEY':
      putIfBlank('API_KEY_VALUE', s.apiKeyValue);
      putIfBlank('API_KEY_HEADER', s.headerName ?? s.keyName);
      putIfBlank('API_KEY_QUERY', s.queryName);
      putIfBlank('API_KEY_PLACEMENT', s.placement);
      break;
    case 'KEYCLOAK':
      putIfBlank('API_TEST_USERNAME', s.username);
      putIfBlank('API_TEST_PASSWORD', s.password);
      putIfBlank('API_TEST_CLIENT_ID', s.clientId);
      putIfBlank('API_TEST_CLIENT_SECRET', s.clientSecret);
      putIfBlank('API_KEYCLOAK_URL', s.keycloakUrl);
      break;
    default:
      break;
  }
}
