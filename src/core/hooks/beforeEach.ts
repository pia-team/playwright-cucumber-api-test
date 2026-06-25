import { Before, After } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';
import {
  extractProjectKeyFromFeatureUri,
  setScenarioProjectKey,
} from '../../config/projectEnv';

Before(function (scenario) {
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
});

After(function () {
  setScenarioProjectKey(undefined);
});
