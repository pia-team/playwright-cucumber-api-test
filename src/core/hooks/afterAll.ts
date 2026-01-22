import { AfterAll } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';
import { logger } from '../../utils/logger';

AfterAll(async () => {
  logger.info('=== Test Execution Completed ===');
  ReportHelper.generateDetailedReport();
  logger.info('Detailed report generated successfully');
});
