/**
 * Defaults when Credential Profile does not set API_KEYCLOAK_URL.
 * Token path is built by {@link keycloakTokenUri} (preserves custom realms).
 */
export const keycloakEndpoints = {
  /** Default realm host only when UI does not set API_KEYCLOAK_URL / TOKEN_URL */
  defaultBaseURI: 'https://diam.pi.dev-gcu.com',
  /** @deprecated Prefer keycloakTokenUri — kept for documentation / legacy imports */
  token: '/realms/orbitant-realm/protocol/openid-connect/token',
} as const;
