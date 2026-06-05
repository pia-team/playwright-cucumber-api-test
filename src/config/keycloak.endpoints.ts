/** Shared Keycloak token path (base URL comes from API_KEYCLOAK_BASE_URL at runtime). */
export const keycloakEndpoints = {
  /** Default realm host only when UI does not set API_KEYCLOAK_BASE_URL */
  defaultBaseURI: 'https://diam.pi.dev-gcu.com',
  token: '/realms/orbitant-realm/protocol/openid-connect/token',
} as const;
