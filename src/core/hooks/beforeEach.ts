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

Before(async function (scenario) {
  enterAuthScenario();
  clearAuthScenarioToken();
  resetTestDataCache();
  // Fresh scenario scope; optional Test Flow preload below.
  const world = this as { scenarioVars?: Record<string, string> };
  world.scenarioVars = {};
  const flowContextPath = process.env.COTESTER_FLOW_CONTEXT_PATH;
  if (flowContextPath) {
    try {
      const fs = await import('fs/promises');
      const raw = await fs.readFile(flowContextPath, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        world.scenarioVars = { ...(parsed as Record<string, string>) };
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
