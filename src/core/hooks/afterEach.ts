import { After } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';
import { logger } from '../../utils/logger';

After(function (scenario) {
  const status = scenario.result?.status || 'skipped';
  const error = scenario.result?.message || undefined;
  
  ReportHelper.endScenario(
    status as 'passed' | 'failed' | 'skipped',
    error
  );
});
