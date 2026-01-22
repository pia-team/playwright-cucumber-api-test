import { request } from '@playwright/test';
import { AuthService, TokenRequest, TokenResponse } from '../services/authService';
import { ApiClient } from '../core/api/apiClient';
import { TestDataHelper } from './testDataHelper';
import { logger } from './logger';
import { endpoints } from '../config/endpoints';
import { envConfig } from '../config/env.config';

export class AuthHelper {
  private static tokenResponse: TokenResponse | null = null;
  private static authService: AuthService | null = null;

  static async getCredentialsForUser(username: string): Promise<TokenRequest> {
    logger.debug(`Getting credentials for user: ${username}`);
    
    try {
      const usersData = TestDataHelper.getData<Record<string, { username: string; password: string; client_id: string }>>('users.json');
      const userData = usersData[username];
      
      if (userData) {
        logger.info(`User credentials loaded from test data for: ${username}`);
        return {
          grant_type: 'password',
          client_id: userData.client_id || 'orbitant-ui-client',
          username: userData.username,
          password: userData.password
        };
      } else {
        throw new Error(`User ${username} not found in test data`);
      }
    } catch {
      logger.warn(`User ${username} not found in test data, using default credentials`);
      return {
        grant_type: 'password',
        client_id: 'orbitant-ui-client',
        username: username === 'orbitant' ? 'orbitant' : username,
        password: username === 'orbitant' ? 'orbitant123' : 'password'
      };
    }
  }

  static getInvalidCredentials(): TokenRequest {
    return {
      grant_type: 'password',
      client_id: 'orbitant-ui-client',
      username: 'invalid_user',
      password: 'invalid_password'
    };
  }

  static getMissingCredentials(): TokenRequest {
    return {
      grant_type: 'password',
      client_id: 'orbitant-ui-client',
      username: '',
      password: ''
    };
  }

  static async initializeAuthService(): Promise<AuthService> {
    if (!this.authService) {
      const context = await request.newContext({
        baseURL: envConfig.baseUrl,
        extraHTTPHeaders: {
          'accept': 'application/json, text/plain, */*',
          'content-type': 'application/x-www-form-urlencoded'
        }
      });
      
      this.authService = new AuthService(new ApiClient(context));
      logger.debug('Auth service initialized');
    }
    
    return this.authService;
  }

  static async getToken(credentials: TokenRequest): Promise<any> {
    const service = await this.initializeAuthService();
    
    logger.logRequest('POST', endpoints.keycloackAuth.token, undefined, {
      grant_type: credentials.grant_type,
      client_id: credentials.client_id,
      username: credentials.username,
      password: '***' // Don't log password
    });
    
    const response = await service.getToken(credentials);
    (global as any).response = response;
    
    const status = response.status();
    logger.logResponse(status, response.statusText(), response.headers());
    
    if (status === 200) {
      const responseBody = await response.text();
      try {
        if (responseBody.trim().startsWith('<!DOCTYPE html>')) {
           logger.warn('Received HTML response instead of JSON token. This might be due to SSO/Cloudflare Access.');
           // Fallback to auth.json if available
           try {
             const authData = TestDataHelper.getData<{ token: string }>('auth.json');
             if (authData && authData.token) {
               logger.info('Using fallback token from auth.json');
               this.tokenResponse = { access_token: authData.token } as any;
             }
           } catch (e) {
             logger.error('Failed to load fallback token from auth.json', e);
           }
        } else {
          this.tokenResponse = JSON.parse(responseBody);
          logger.debug('Token response received and parsed');
        }
      } catch (error) {
        logger.error(`Failed to parse token response as JSON. Status: ${status}, Body: ${responseBody}`, error);
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
