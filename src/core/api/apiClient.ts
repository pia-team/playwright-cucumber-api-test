import { envConfig } from '../../config/env.config';
import { APIRequestContext } from '@playwright/test';

export class ApiClient {
  constructor(private context: APIRequestContext) {}

  /**
   * Playwright resolves a leading-slash path against the ORIGIN of baseURL (URL semantics), so
   * base "https://host/playground/api/v1" + "/products" became "https://host/products" (404).
   * Keep the base path: join it explicitly. Absolute URLs and bases without a path are unchanged.
   */
  private resolve(url: string): string {
    const base = String(envConfig.baseUrl || '').trim();
    if (!base || !url || !url.startsWith('/') || url.startsWith('//')) return url;
    let basePath = '';
    try {
      basePath = new URL(base).pathname.replace(/\/+$/, '');
    } catch {
      return url;
    }
    if (!basePath || url === basePath || url.startsWith(basePath + '/')) return url;
    return base.replace(/\/+$/, '') + url;
  }

  get(url: string, options?: { headers?: Record<string, string>; params?: Record<string, string | number> }) {
    const requestOptions: any = {
      headers: options?.headers
    };
    
    if (options?.params) {
      requestOptions.params = options.params;
    }
    
    return this.context.get(this.resolve(url), requestOptions);
  }

  /** True HTTP HEAD — must not be silently rewritten to GET. */
  head(url: string, options?: { headers?: Record<string, string>; params?: Record<string, string | number> }) {
    const requestOptions: any = {
      headers: options?.headers,
    };
    if (options?.params) {
      requestOptions.params = options.params;
    }
    return this.context.head(this.resolve(url), requestOptions);
  }

  /** True HTTP OPTIONS — CORS/preflight probes; must not rewrite to GET. */
  options(url: string, options?: { headers?: Record<string, string>; params?: Record<string, string | number> }) {
    const requestOptions: any = {
      method: 'OPTIONS',
      headers: options?.headers,
    };
    if (options?.params) {
      requestOptions.params = options.params;
    }
    return this.context.fetch(this.resolve(url), requestOptions);
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

    return this.context.post(this.resolve(url), requestOptions);
  }

  put(url: string, body?: unknown, options?: { headers?: Record<string, string> }) {
    return this.context.put(this.resolve(url), { 
      data: body,
      headers: options?.headers
    });
  }

  delete(url: string, options?: { headers?: Record<string, string> }) {
    return this.context.delete(this.resolve(url), {
      headers: options?.headers
    });
  }

  patch(url: string, body?: unknown, options?: { headers?: Record<string, string> }) {
    return this.context.patch(this.resolve(url), {
      data: body,
      headers: options?.headers
    });
  }

  postMultipart(
    url: string,
    multipart: {
      [key: string]:
        | string
        | number
        | boolean
        | { name: string; mimeType: string; buffer: Buffer };
    },
    options?: { headers?: Record<string, string> },
  ) {
    return this.context.post(this.resolve(url), {
      multipart,
      headers: options?.headers,
    });
  }

  /**
   * Multipart via FormData — required when the same field name is appended
   * more than once (OpenAPI array of binary files).
   */
  postMultipartForm(
    url: string,
    form: FormData,
    options?: { headers?: Record<string, string> },
  ) {
    return this.context.post(this.resolve(url), {
      multipart: form,
      headers: options?.headers,
    });
  }
}
