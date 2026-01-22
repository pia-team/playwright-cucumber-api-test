import { BeforeAll } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';
import { logger } from '../../utils/logger';

BeforeAll(async () => {
  logger.info('=== Test Execution Started ===');
  ReportHelper.clear();
});
