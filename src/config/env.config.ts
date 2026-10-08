import * as fs from 'fs';
import * as path from 'path';

/** Resolve API base URL: CoTester runtime env first, then migrated project variables (api.base). */
function resolveBaseUrl(): string {
  const fromRuntime = process.env.COTESTER_API_BASE_URL?.trim();
  if (fromRuntime) {
    return fromRuntime;
  }
  const fromEnv = process.env.BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const projectKey = process.env.API_PROJECT_KEY?.trim();
  if (!projectKey) {
    return '';
  }
  try {
    const file = path.resolve(__dirname, `../../config/variables/${projectKey}.json`);
    if (!fs.existsSync(file)) {
      return '';
    }
    const vars = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    for (const key of ['api.base', 'BASE_URL', 'baseUrl']) {
      const value = vars[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  } catch {
    // leave empty; ApiContext will fail with a clear Invalid URL
  }
  return '';
}

export const envConfig = {
  get baseUrl(): string {
    return resolveBaseUrl();
  },
  get token(): string | undefined {
    return process.env.API_TOKEN;
  },
};
