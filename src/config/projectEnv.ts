import * as fs from 'fs';
import * as path from 'path';

export interface ApiProjectConfig {
  keycloakUrl: string;
  username: string;
  password: string;
  clientId?: string;
}

const EXCLUDED_PROJECT_FOLDERS = new Set(['steps', 'pages', 'records', 'auth', 'common']);

let scenarioProjectKey: string | undefined;

export function setScenarioProjectKey(projectKey: string | undefined): void {
  scenarioProjectKey = projectKey?.trim() || undefined;
}

export function getScenarioProjectKey(): string | undefined {
  return scenarioProjectKey;
}

/**
 * Extract project key from a Cucumber feature URI/path.
 * Example: src/features/GCU/Agreement/foo.feature -> GCU
 */
export function extractProjectKeyFromFeatureUri(featureUri: string): string | undefined {
  if (!featureUri) {
    return undefined;
  }

  const normalized = featureUri.replace(/\\/g, '/');
  const match = normalized.match(/(?:^|\/)features\/([^/]+)\//i);
  if (!match) {
    return undefined;
  }

  const key = match[1].trim();
  if (!key || EXCLUDED_PROJECT_FOLDERS.has(key.toLowerCase())) {
    return undefined;
  }

  return key;
}

function resolveConfigFilePath(projectKey: string | undefined, tier: string): string | null {
  const projectsDir = path.resolve(__dirname, '../../config/projects');

  if (projectKey) {
    const tieredPath = path.join(projectsDir, `${projectKey}.${tier}.json`);
    if (fs.existsSync(tieredPath)) {
      return tieredPath;
    }

    const projectPath = path.join(projectsDir, `${projectKey}.json`);
    if (fs.existsSync(projectPath)) {
      return projectPath;
    }
  }

  const legacyPath = path.resolve(__dirname, `../../config/${tier}.json`);
  if (fs.existsSync(legacyPath)) {
    return legacyPath;
  }

  return null;
}

/**
 * Load Keycloak credentials for the current scenario.
 * Priority: config/projects/{project}.{tier}.json -> config/projects/{project}.json -> config/{tier}.json
 */
export function getApiProjectConfig(projectKey?: string): ApiProjectConfig {
  const tier = process.env.TEST_ENV || 'dev';
  const envProjectKey = process.env.API_PROJECT_KEY?.trim() || undefined;
  const effectiveProjectKey = projectKey ?? getScenarioProjectKey() ?? envProjectKey;
  const filePath = resolveConfigFilePath(effectiveProjectKey, tier);

  if (!filePath) {
    const hint = effectiveProjectKey
      ? `config/projects/${effectiveProjectKey}.${tier}.json or config/projects/${effectiveProjectKey}.json`
      : `config/${tier}.json`;
    throw new Error(
      `API config file not found for TEST_ENV='${tier}'` +
        (effectiveProjectKey ? ` project='${effectiveProjectKey}'` : '') +
        `. Expected: ${hint}. Define the profile under Ortamlar → Keycloak (API).`,
    );
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as ApiProjectConfig;
}

export function extractKeycloakBaseUrl(keycloakUrl: string): string {
  const trimmed = keycloakUrl.trim();
  try {
    const uri = new URL(trimmed);
    const port = uri.port ? `:${uri.port}` : '';
    return `${uri.protocol}//${uri.hostname}${port}`;
  } catch {
    const realmsIdx = trimmed.indexOf('/realms/');
    if (realmsIdx > 0) {
      return trimmed.substring(0, realmsIdx);
    }
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }
}
