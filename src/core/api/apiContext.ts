import { request, APIRequestContext } from '@playwright/test';
import { envConfig } from '../../config/env.config';

export class ApiContext {
  static async create(headers?: Record<string, string>): Promise<APIRequestContext> {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'pragma': 'no-cache'
    };

    if (headers) {
      Object.assign(defaultHeaders, headers);
    }

    return await request.newContext({
      baseURL: envConfig.baseUrl,
      extraHTTPHeaders: defaultHeaders
    });
  }

  static async createWithAuth(token?: string): Promise<APIRequestContext> {
    const authToken = token || envConfig.token || '';
    return this.create({
      'authorization': `Bearer ${authToken}`
    });
  }
}
