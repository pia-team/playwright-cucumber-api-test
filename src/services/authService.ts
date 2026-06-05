import { ApiClient } from '../core/api/apiClient';
import { keycloakEndpoints } from '../config/keycloak.endpoints';

export interface TokenRequest {
  grant_type: string;
  client_id: string;
  username: string;
  password: string;
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

export class AuthService {
  constructor(private api: ApiClient) {}

  getToken(credentials: TokenRequest) {
    const keycloakBase =
      process.env.API_KEYCLOAK_BASE_URL?.trim() || keycloakEndpoints.defaultBaseURI;
    const fullUrl = `${keycloakBase}${keycloakEndpoints.token}`;
    
    return this.api.post(fullUrl, credentials, {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/x-www-form-urlencoded'
      },
      form: true
    });
  }
}
