import { request } from '@playwright/test';
import { AuthService, TokenRequest, TokenResponse } from '../services/authService';
import { ApiClient } from '../core/api/apiClient';
import { logger } from './logger';
import { keycloakEndpoints } from '../config/keycloak.endpoints';
import { envConfig } from '../config/env.config';

export class AuthHelper {
  private static tokenResponse: TokenResponse | null = null;
  private static authService: AuthService | null = null;

  /**
   * Credentials from the test-run UI via process env (set by backend before Cucumber starts).
   * Requires API_TEST_USERNAME, API_TEST_PASSWORD, and optionally API_TEST_CLIENT_ID / API_KEYCLOAK_BASE_URL.
   */
  static getConfiguredCredentials(): TokenRequest {
    const username = process.env.API_TEST_USERNAME?.trim();
    const password = process.env.API_TEST_PASSWORD;

    if (!username || !password) {
      throw new Error(
        'No API credentials in environment. Run tests from the Test Assistant UI with a Keycloak profile selected.',
      );
    }

    logger.info(`Using API credentials from test-run UI for user: ${username}`);
    return {
      grant_type: 'password',
      client_id: process.env.API_TEST_CLIENT_ID?.trim() || 'orbitant-ui-client',
      username,
      password,
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
    if (!this.authService) {
      const context = await request.newContext({
        baseURL: envConfig.baseUrl,
        extraHTTPHeaders: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/x-www-form-urlencoded',
        },
      });

      this.authService = new AuthService(new ApiClient(context));
      logger.debug('Auth service initialized');
    }

    return this.authService;
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
            'Received HTML instead of JSON token (SSO/Cloudflare?). Check Keycloak URL in the UI profile.',
          );
        } else {
          this.tokenResponse = JSON.parse(responseBody);
          logger.debug('Token response received and parsed');
        }
      } catch (error) {
        logger.error(
          `Failed to parse token response as JSON. Status: ${status}, Body: ${responseBody}`,
          error,
        );
      }
    }

    return response;
  }

  static setTokenResponse(tokenResponse: TokenResponse): void {
    this.tokenResponse = tokenResponse;
  }

  static getTokenResponse(): TokenResponse | null {
    return this.tokenResponse;
  }

  static getAccessToken(): string | null {
    return this.tokenResponse?.access_token || null;
  }

  static clearToken(): void {
    this.tokenResponse = null;
  }
}
