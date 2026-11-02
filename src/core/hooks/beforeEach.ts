import { Before, After } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';
import {
  extractProjectKeyFromFeatureUri,
  setScenarioProjectKey,
} from '../../config/projectEnv';
import { resetTestDataCache } from '../../utils/testData';
import { runGeneratedAfter, runGeneratedBefore } from '../lifecycle/lifecycleRegistry';
import { clearAuthScenarioToken, enterAuthScenario } from '../../utils/authHelper';
import { resetApiHttpScenarioGlobals } from '../../utils/apiScenarioGlobals';
import { markAuthScenarioBoundary } from '../../utils/jobTokenCache';
import { isTokenCurlCredential } from '../../utils/tokenCurlAuth';

/**
 * Load Environment customVariables into scenarioVars for {{name}} substitution.
 * Prefers COTESTER_ENV_VARIABLES_JSON (original keys). Falls back to COTESTER_VAR_* and BASE_URL.
 * Secrets are never injected here.
 */
function hydrateEnvironmentVariables(world: { scenarioVars?: Record<string, string> }) {
  const vars: Record<string, string> = {};
  const json = process.env.COTESTER_ENV_VARIABLES_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === 'string' && key && !key.startsWith('_')) {
            vars[key] = value;
          }
        }
      }
    } catch {
      // ignore malformed payload; COTESTER_VAR_* fallback still applies
    }
  }
  for (const [envKey, value] of Object.entries(process.env)) {
    if (!envKey.startsWith('COTESTER_VAR_') || value == null || value === '') {
      continue;
    }
    const name = envKey.slice('COTESTER_VAR_'.length);
    if (name && vars[name] === undefined) {
      vars[name] = value;
    }
  }
  const base =
    process.env.COTESTER_API_BASE_URL?.trim() || process.env.BASE_URL?.trim() || '';
  if (base) {
    if (vars.BASE_URL === undefined) vars.BASE_URL = base;
    if (vars.baseUrl === undefined) vars.baseUrl = base;
  }
  world.scenarioVars = { ...vars, ...(world.scenarioVars || {}) };
}

Before(async function (scenario) {
  enterAuthScenario();
  clearAuthScenarioToken();
  markAuthScenarioBoundary();
  // Unknown TTL TOKEN_CURL: force per-scenario reacquire (do not keep job-start API_TOKEN).
  // Known TTL is marked via COTESTER_TOKEN_CURL_EXPIRES_AT when available.
  if (
    process.env.COTESTER_TOKEN_CURL === '1' &&
    isTokenCurlCredential() &&
    !process.env.COTESTER_TOKEN_CURL_EXPIRES_AT?.trim()
  ) {
    delete process.env.API_TOKEN;
  }
  resetTestDataCache();
  // Fresh scenario scope; optional Test Flow preload below.
  const world = this as { scenarioVars?: Record<string, string> };
  world.scenarioVars = {};
  // Non-secret Environment customVariables from CoTester runtime (never secrets).
  hydrateEnvironmentVariables(world);
  const flowContextPath = process.env.COTESTER_FLOW_CONTEXT_PATH;
  if (flowContextPath) {
    try {
      const fs = await import('fs/promises');
      const raw = await fs.readFile(flowContextPath, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        world.scenarioVars = {
          ...world.scenarioVars,
          ...(parsed as Record<string, string>),
        };
      }
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn('Failed to load flow context:', e);
      }
    }
  }
  resetApiHttpScenarioGlobals();
  const featureUri = scenario.pickle?.uri || scenario.gherkinDocument?.uri || '';
  const projectKey = extractProjectKeyFromFeatureUri(featureUri);
  setScenarioProjectKey(projectKey);

  const featureName = featureUri.includes('/')
    ? featureUri.substring(featureUri.lastIndexOf('/') + 1).replace('.feature', '')
    : featureUri.includes('\\')
      ? featureUri.substring(featureUri.lastIndexOf('\\') + 1).replace('.feature', '')
      : featureUri.replace('.feature', '');

  (this as any).currentFeatureName = featureName;

  if (featureName) {
    console.log(`🎯 FEATURE START: ${featureName}`);
    console.log(`📁 Feature File: ${featureUri}`);
    if (projectKey) {
      console.log(`🏷️ API project env: ${projectKey} (TEST_ENV=${process.env.TEST_ENV || 'dev'})`);
    }
  }

  const gherkinFeatureName = scenario.gherkinDocument?.feature?.name || 'Unknown Feature';
  const scenarioName = scenario.pickle?.name || 'Unknown Scenario';

  ReportHelper.setFeature(gherkinFeatureName);
  ReportHelper.startScenario(scenarioName);

  // Scoped BEFORE lifecycle of migrated tests (no-op for features without a registration).
  await runGeneratedBefore(featureUri, this);
});

// Runs before afterEach.ts's After (After hooks run in reverse definition order), while the project key is set.
After(async function (scenario) {
  try {
    await runGeneratedAfter(scenario.pickle?.uri || scenario.gherkinDocument?.uri || '', this);
  } finally {
    setScenarioProjectKey(undefined);
  }
});
