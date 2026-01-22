import { BeforeStep, AfterStep } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';

BeforeStep(function ({ pickleStep }) {
  const featureName = (this as any).currentFeatureName || 'unknown';
  // Format: ➡ STEP START [feature-name]: step text
  console.log(`➡ STEP START [${featureName}]: ${pickleStep.text}`);
  
  ReportHelper.startStep(pickleStep.text);
});

AfterStep(function ({ result, pickleStep }) {
  const featureName = (this as any).currentFeatureName || 'unknown';
  const status = result.status;
  const error = result.message;

  // Format: ✓ STEP PASS [feature-name]: step text  OR  ✗ STEP FAIL [feature-name]: step text
  if (status === 'PASSED') {
    console.log(`✓ STEP PASS [${featureName}]: ${pickleStep.text}`);
  } else {
    console.log(`✗ STEP FAIL [${featureName}]: ${pickleStep.text}`);
  }

  ReportHelper.endStep(
    pickleStep.text,
    status.toLowerCase() as 'passed' | 'failed' | 'skipped',
    error
  );
});
