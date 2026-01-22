import { Before } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';

Before(function (scenario) {
  const featureUri = scenario.gherkinDocument?.uri || '';
  const featureName = featureUri.includes('/')
    ? featureUri.substring(featureUri.lastIndexOf('/') + 1).replace('.feature', '')
    : featureUri.includes('\\')
      ? featureUri.substring(featureUri.lastIndexOf('\\') + 1).replace('.feature', '')
      : featureUri.replace('.feature', '');

  // Store feature name in world for use in step hooks
  (this as any).currentFeatureName = featureName;

  if (featureName) {
    console.log(`🎯 FEATURE START: ${featureName}`);
    console.log(`📁 Feature File: ${featureUri}`);
  }

  const gherkinFeatureName = scenario.gherkinDocument?.feature?.name || 'Unknown Feature';
  const scenarioName = scenario.pickle?.name || 'Unknown Scenario';
  
  ReportHelper.setFeature(gherkinFeatureName);
  ReportHelper.startScenario(scenarioName);
});
