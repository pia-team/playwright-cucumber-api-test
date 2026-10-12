import { AfterAll } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';
import { logger } from '../../utils/logger';
import { flushEndpointTelemetry } from '../../utils/endpointTelemetry';

AfterAll(async () => {
  logger.info('=== Test Execution Completed ===');
  try {
    flushEndpointTelemetry(process.cwd());
  } catch {
    // never fail the suite for analytics flush
  }
  ReportHelper.generateDetailedReport();
  logger.info('Detailed report generated successfully');
});
