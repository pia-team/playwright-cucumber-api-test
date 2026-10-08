import { request } from '@playwright/test';
import { AuthService, TokenRequest, TokenResponse } from '../services/authService';
import { ApiClient } from '../core/api/apiClient';
import { logger } from './logger';
import { keycloakEndpoints } from '../config/keycloak.endpoints';
import { envConfig } from '../config/env.config';
import { getApiProjectConfig, extractKeycloakBaseUrl } from '../config/projectEnv';
import {
  clearAuthScenarioToken,
  enterAuthScenario,
  getAuthScenarioState,
} from './authScenarioStore';

export { clearAuthScenarioToken, enterAuthScenario };

/**
 * Job/scenario-scoped auth helper. Tokens live in authScenarioStore (or job key),
 * never in a process-wide static field shared across parallel CoTester jobs.
 */
export class AuthHelper {
  private static authServiceByJob = new Map<string, AuthService>();

  private static jobScopeKey(): string {
    return (
      process.env.COTESTER_RUNTIME_DIR?.trim() ||
      process.env.CUCUMBER_WORKER_ID?.trim() ||
      'default'
    );
  }

  /**
   * Credentials from runtime env (FAZ 3 Credential Profile) first, then
   * config/projects/{project}.json (legacy). Empty shared JSON password fails closed.
   */
  static getConfiguredCredentials(): TokenRequest {
    const envUsername = process.env.API_TEST_USERNAME?.trim();
    const envPassword = process.env.API_TEST_PASSWORD;
    const envKeycloak = process.env.API_KEYCLOAK_URL?.trim();

    if (envUsername && envPassword) {
      if (envKeycloak) {
        try {
          process.env.API_KEYCLOAK_BASE_URL = extractKeycloakBaseUrl(envKeycloak);
        } catch {
          process.env.API_KEYCLOAK_BASE_URL = envKeycloak;
        }
      }
      logger.info(`Using API credentials from runtime environment for user: ${envUsername}`);
      return {
        grant_type: 'password',
        client_id: process.env.API_TEST_CLIENT_ID?.trim() || 'orbitant-ui-client',
        username: envUsername,
        password: envPassword,
      };
    }

    const config = getApiProjectConfig();
    const baseUrl = extractKeycloakBaseUrl(config.keycloakUrl);
    process.env.API_KEYCLOAK_BASE_URL = baseUrl;

    if (!config.password) {
      throw new Error(
        'Keycloak password is not available. Select a KEYCLOAK Credential Profile for this run ' +
          '(shared config/projects JSON no longer stores passwords).',
      );
    }

    logger.info(`Using API credentials from project config for user: ${config.username}`);
    return {
      grant_type: 'password',
      client_id: config.clientId?.trim() || 'orbitant-ui-client',
      username: config.username,
      password: config.password,
    };
  }

  /** @deprecated Use getConfiguredCredentials(); kept for step text compatibility. */
  static getCredentialsForUser(_username: string): TokenRequest {
    return this.getConfiguredCredentials();
  }

  static getInvalidCredentials(): TokenRequest {
    return {
      grant_type: 'password',
      client_id: 'orbitant-ui-client',
      username: 'invalid_user',
      password: 'invalid_password',
    };
  }

  static getMissingCredentials(): TokenRequest {
    return {
      grant_type: 'password',
      client_id: 'orbitant-ui-client',
      username: '',
      password: '',
    };
  }

  static async initializeAuthService(): Promise<AuthService> {
    const key = this.jobScopeKey();
    let service = this.authServiceByJob.get(key);
    if (!service) {
      const context = await request.newContext({
        baseURL: envConfig.baseUrl,
        extraHTTPHeaders: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/x-www-form-urlencoded',
        },
      });
      service = new AuthService(new ApiClient(context));
      this.authServiceByJob.set(key, service);
      logger.debug('Auth service initialized (job-scoped)');
    }
    return service;
  }

  static async getToken(credentials: TokenRequest): Promise<any> {
    const service = await this.initializeAuthService();

    logger.logRequest('POST', keycloakEndpoints.token, undefined, {
      grant_type: credentials.grant_type,
      client_id: credentials.client_id,
      username: credentials.username,
      password: '***',
    });

    const response = await service.getToken(credentials);
    (global as any).response = response;

    const status = response.status();
    logger.logResponse(status, response.statusText(), response.headers());

    if (status === 200) {
      const responseBody = await response.text();
      try {
        if (responseBody.trim().startsWith('<!DOCTYPE html>')) {
          logger.warn(
            'Received HTML instead of JSON token (SSO/Cloudflare?). Check Keycloak URL in Ortamlar profile.',
          );
        } else {
          getAuthScenarioState().tokenResponse = JSON.parse(responseBody);
          logger.debug('Token response received and parsed (scenario-scoped)');
        }
      } catch (error) {
        logger.error(
          `Failed to parse token response as JSON. Status: ${status}, Body length: ${responseBody?.length ?? 0}`,
          error,
        );
      }
    }

    return response;
  }

  static setTokenResponse(tokenResponse: TokenResponse): void {
    getAuthScenarioState().tokenResponse = tokenResponse;
  }

  static getTokenResponse(): TokenResponse | null {
    return getAuthScenarioState().tokenResponse;
  }

  static getAccessToken(): string | null {
    return getAuthScenarioState().tokenResponse?.access_token || null;
  }

  static clearToken(): void {
    clearAuthScenarioToken();
    this.authServiceByJob.delete(this.jobScopeKey());
  }
}
