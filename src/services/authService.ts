import { ApiClient } from '../core/api/apiClient';
import { keycloakEndpoints } from '../config/keycloak.endpoints';
import { keycloakTokenUri } from '../config/projectEnv';

export interface TokenRequest {
  grant_type: string;
  client_id: string;
  username: string;
  password: string;
  /** Present only for confidential clients; never log the value. */
  client_secret?: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  'not-before-policy': number;
  session_state: string;
  scope: string;
}

/** Form fields for password grant — omits client_secret when absent (public client). */
export function buildPasswordGrantForm(credentials: TokenRequest): Record<string, string> {
  const form: Record<string, string> = {
    grant_type: credentials.grant_type,
    client_id: credentials.client_id,
    username: credentials.username,
    password: credentials.password,
  };
  const secret = credentials.client_secret?.trim();
  if (secret) {
    form.client_secret = secret;
  }
  return form;
}

/**
 * Resolve token endpoint: explicit env → credential URL → legacy base → default host.
 * Never concatenates a hardcoded realm onto an already-resolved full token URL.
 */
export function resolveKeycloakTokenEndpointUrl(): string {
  const explicit = process.env.API_KEYCLOAK_TOKEN_URL?.trim();
  if (explicit) {
    return keycloakTokenUri(explicit);
  }
  const fromCredential = process.env.API_KEYCLOAK_URL?.trim();
  if (fromCredential) {
    return keycloakTokenUri(fromCredential);
  }
  const legacyBase = process.env.API_KEYCLOAK_BASE_URL?.trim();
  if (legacyBase) {
    return keycloakTokenUri(legacyBase);
  }
  return keycloakTokenUri(keycloakEndpoints.defaultBaseURI);
}

export class AuthService {
  constructor(private api: ApiClient) {}

  getToken(credentials: TokenRequest) {
    const fullUrl = resolveKeycloakTokenEndpointUrl();
    const form = buildPasswordGrantForm(credentials);

    return this.api.post(fullUrl, form, {
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/x-www-form-urlencoded',
      },
      form: true,
    });
  }
}
