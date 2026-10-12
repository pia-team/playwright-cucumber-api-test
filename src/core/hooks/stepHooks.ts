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
  const softFail = Boolean((global as any).__cotesterSoftAssertionFail);
  const softSkipped = Boolean((global as any).__cotesterSoftAssertionSkipped);
  (global as any).__cotesterSoftAssertionFail = false;
  (global as any).__cotesterSoftAssertionSkipped = false;

  // Cucumber step status is unchanged; log distinguishes soft-assertion outcomes from a true PASS.
  if (status === 'PASSED' && softFail) {
    console.log(
      `✗ STEP SOFT-FAIL [${featureName}]: ${pickleStep.text} (deferred; scenario fails in After if unresolved)`,
    );
  } else if (status === 'PASSED' && softSkipped) {
    console.log(
      `⊘ STEP NOT_EVALUATED [${featureName}]: ${pickleStep.text} (skipped after status mismatch)`,
    );
  } else if (status === 'PASSED') {
    console.log(`✓ STEP PASS [${featureName}]: ${pickleStep.text}`);
  } else if (status === 'SKIPPED') {
    console.log(`⊘ STEP SKIPPED [${featureName}]: ${pickleStep.text}`);
  } else {
    console.log(`✗ STEP FAIL [${featureName}]: ${pickleStep.text}`);
  }

  const reportStatus =
    status === 'PASSED' && softFail
      ? 'failed'
      : status === 'PASSED' && softSkipped
        ? 'skipped'
        : (status.toLowerCase() as 'passed' | 'failed' | 'skipped');

  ReportHelper.endStep(pickleStep.text, reportStatus, error);
});
