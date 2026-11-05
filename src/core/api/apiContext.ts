import { request, APIRequestContext } from '@playwright/test';
import { envConfig } from '../../config/env.config';

export type ApiContextCreateOptions = {
  /** Playwright must set `multipart/form-data; boundary=…` itself. */
  omitContentType?: boolean;
};

export class ApiContext {
  static async create(
    headers?: Record<string, string>,
    options?: ApiContextCreateOptions,
  ): Promise<APIRequestContext> {
    const defaultHeaders: Record<string, string> = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'pragma': 'no-cache'
    };
    if (!options?.omitContentType) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    if (headers) {
      Object.assign(defaultHeaders, headers);
    }
    if (options?.omitContentType) {
      for (const key of Object.keys(defaultHeaders)) {
        if (key.toLowerCase() === 'content-type') {
          delete defaultHeaders[key];
        }
      }
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
