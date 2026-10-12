import { After } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';
import { finalizeScenarioHits } from '../../utils/endpointTelemetry';

After(function (scenario) {
  const rawStatus = scenario.result?.status || 'skipped';
  const status = String(rawStatus).toLowerCase() as 'passed' | 'failed' | 'skipped';
  const error = scenario.result?.message || undefined;

  ReportHelper.endScenario(status, error);
  try {
    finalizeScenarioHits(
      status === 'passed' || status === 'failed' || status === 'skipped' ? status : 'skipped',
    );
  } catch {
    // telemetry must not affect scenario cleanup
  }
});
