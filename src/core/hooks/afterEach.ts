import { After } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';
import { logger } from '../../utils/logger';

After(function (scenario) {
  const rawStatus = scenario.result?.status || 'skipped';
  const status = String(rawStatus).toLowerCase() as 'passed' | 'failed' | 'skipped';
  const error = scenario.result?.message || undefined;
  
  ReportHelper.endScenario(status, error);
});
