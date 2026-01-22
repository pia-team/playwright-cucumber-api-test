import { APIRequestContext } from '@playwright/test';

export class ApiClient {
  constructor(private context: APIRequestContext) {}

  get(url: string, options?: { headers?: Record<string, string>; params?: Record<string, string | number> }) {
    const requestOptions: any = {
      headers: options?.headers
    };
    
    if (options?.params) {
      requestOptions.params = options.params;
    }
    
    return this.context.get(url, requestOptions);
  }

  post(url: string, body?: unknown, options?: { headers?: Record<string, string>; form?: boolean }) {
    const requestOptions: any = {
      headers: options?.headers
    };

    if (options?.form && typeof body === 'object') {
      // Use Playwright's form option for URL-encoded form data
      requestOptions.form = body;
    } else {
      requestOptions.data = body;
    }

    return this.context.post(url, requestOptions);
  }

  put(url: string, body?: unknown, options?: { headers?: Record<string, string> }) {
    return this.context.put(url, { 
      data: body,
      headers: options?.headers
    });
  }

  delete(url: string, options?: { headers?: Record<string, string> }) {
    return this.context.delete(url, {
      headers: options?.headers
    });
  }

  patch(url: string, body?: unknown, options?: { headers?: Record<string, string> }) {
    return this.context.patch(url, {
      data: body,
      headers: options?.headers
    });
  }
}
