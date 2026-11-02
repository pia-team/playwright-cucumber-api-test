import { BeforeStep, AfterStep } from '@cucumber/cucumber';
import { ReportHelper } from '../../utils/reportHelper';
import {
  buildExecutionUnitKey,
  buildScenarioKey,
  emitStepEvent,
  parseRowIndexFromEnv,
  parseRowLabelFromEnv,
  type StepEventKind,
} from './step-event';

const attemptByPickleId = new Map<string, number>();
const stepIndexByAttempt = new Map<string, number>();

function pickleKey(pickle: { id?: string; uri?: string } | undefined): string {
  return pickle?.id ?? pickle?.uri ?? 'unknown';
}

function attemptKey(pickleId: string, attempt: number): string {
  return `${pickleId}#${attempt}`;
}

BeforeStep(function ({ pickleStep, pickle }) {
  const featureName = (this as any).currentFeatureName || 'unknown';
  const featurePath = pickle?.uri || featureName;
  const pickleId = pickleKey(pickle);
  let attempt = attemptByPickleId.get(pickleId);
  if (!attempt) {
    attempt = 1;
    attemptByPickleId.set(pickleId, attempt);
    stepIndexByAttempt.set(attemptKey(pickleId, attempt), 0);
  }
  const aKey = attemptKey(pickleId, attempt);
  const next = (stepIndexByAttempt.get(aKey) ?? 0) + 1;
  stepIndexByAttempt.set(aKey, next);

  const scenarioName = pickle?.name || 'Unknown Scenario';
  const rowIndex = parseRowIndexFromEnv();
  const rowLabel = parseRowLabelFromEnv();
  const scenarioKey = buildScenarioKey({
    featurePath,
    scenarioName,
    pickleId,
    rowIndex,
  });
  const executionUnitKey = buildExecutionUnitKey({
    featurePath,
    scenarioKey,
    attempt,
    rowIndex,
  });
  (this as any).__cotesterStepCtx = {
    featurePath,
    featureName,
    scenarioName,
    scenarioKey,
    attempt,
    pickleId,
    rowIndex,
    rowLabel,
    executionUnitKey,
    stepIndex: next,
  };

  // Format: ➡ STEP START [feature-name]: step text
  console.log(`➡ STEP START [${featureName}]: ${pickleStep.text}`);

  emitStepEvent({
    v: 1,
    event: 'START',
    runner: 'API',
    featurePath,
    featureName,
    scenarioKey,
    scenarioName,
    attempt,
    stepIndex: next,
    pickleStepId: pickleStep.id,
    rowIndex,
    rowLabel,
    text: pickleStep.text ?? '',
    executionUnitKey,
  });

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

  const ctx = (this as any).__cotesterStepCtx as
    | {
        featurePath: string;
        featureName: string;
        scenarioName: string;
        scenarioKey: string;
        attempt: number;
        rowIndex?: number;
        rowLabel?: string;
        executionUnitKey: string;
        stepIndex: number;
      }
    | undefined;

  let event: StepEventKind = 'FAIL';
  let reason: string | undefined;
  let logLine: string;

  // Compare via string form — Status enum vs messages string union narrows poorly under ts-node typecheck.
  const statusName = String(status);

  // Cucumber step status is unchanged; log distinguishes soft-assertion outcomes from a true PASS.
  if (statusName === 'PASSED' && softFail) {
    event = 'FAIL';
    reason = 'soft-fail';
    logLine = `✗ STEP SOFT-FAIL [${featureName}]: ${pickleStep.text} (deferred; scenario fails in After if unresolved)`;
  } else if (statusName === 'PASSED' && softSkipped) {
    event = 'SKIP';
    reason = 'not-evaluated';
    logLine = `⊘ STEP NOT_EVALUATED [${featureName}]: ${pickleStep.text} (skipped after status mismatch)`;
  } else if (statusName === 'PASSED') {
    event = 'PASS';
    logLine = `✓ STEP PASS [${featureName}]: ${pickleStep.text}`;
  } else if (statusName === 'SKIPPED') {
    event = 'SKIP';
    logLine = `⊘ STEP SKIPPED [${featureName}]: ${pickleStep.text}`;
  } else if (statusName === 'UNDEFINED') {
    event = 'FAIL';
    reason = 'undefined';
    logLine = `✗ STEP FAIL [${featureName}]: ${pickleStep.text}`;
  } else if (statusName === 'AMBIGUOUS') {
    event = 'FAIL';
    reason = 'ambiguous';
    logLine = `✗ STEP FAIL [${featureName}]: ${pickleStep.text}`;
  } else {
    event = 'FAIL';
    if (String(error || '').toLowerCase().includes('timed out')) {
      reason = 'timeout';
    }
    logLine = `✗ STEP FAIL [${featureName}]: ${pickleStep.text}`;
  }
  console.log(logLine);

  if (ctx) {
    emitStepEvent({
      v: 1,
      event,
      runner: 'API',
      featurePath: ctx.featurePath,
      featureName: ctx.featureName || featureName,
      scenarioKey: ctx.scenarioKey,
      scenarioName: ctx.scenarioName,
      attempt: ctx.attempt,
      stepIndex: ctx.stepIndex,
      pickleStepId: pickleStep.id,
      rowIndex: ctx.rowIndex,
      rowLabel: ctx.rowLabel,
      text: pickleStep.text ?? '',
      reason,
      executionUnitKey: ctx.executionUnitKey,
    });
  }

  const reportStatus =
    status === 'PASSED' && softFail
      ? 'failed'
      : status === 'PASSED' && softSkipped
        ? 'skipped'
        : (status.toLowerCase() as 'passed' | 'failed' | 'skipped');

  ReportHelper.endStep(pickleStep.text, reportStatus, error);
});
