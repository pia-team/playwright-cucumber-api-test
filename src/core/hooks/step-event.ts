/**
 * Paket 8 / Faz 2 — structured step markers (API runner).
 * Mirror of WEB support/step-event.ts — keep payload shape in sync.
 */

export type StepEventKind = 'START' | 'PASS' | 'FAIL' | 'SKIP';

export type StepEventPayload = {
  v: 1;
  event: StepEventKind;
  runner: 'WEB' | 'API' | 'MOBILE';
  featurePath: string;
  featureName: string;
  scenarioKey: string;
  scenarioName: string;
  attempt: number;
  stepIndex: number;
  pickleStepId?: string;
  rowIndex?: number;
  rowLabel?: string;
  text: string;
  reason?: string;
  executionUnitKey: string;
};

const STEP_PREFIX = 'COTESTER_STEP_EVENT:';

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export function emitStepEvent(payload: StepEventPayload): void {
  const json = safeJson(payload);
  if (!json) return;
  console.log(`${STEP_PREFIX}${json}`);
}

export function buildScenarioKey(opts: {
  featurePath: string;
  scenarioName: string;
  pickleId?: string;
  outlineLine?: number | null;
  rowIndex?: number | null;
}): string {
  const parts = [
    opts.featurePath || 'unknown',
    opts.scenarioName || 'unknown',
    opts.pickleId || '',
    opts.outlineLine != null ? `L${opts.outlineLine}` : '',
    opts.rowIndex != null && opts.rowIndex >= 0 ? `R${opts.rowIndex}` : '',
  ];
  return parts.join('#');
}

export function buildExecutionUnitKey(opts: {
  featurePath: string;
  scenarioKey: string;
  attempt: number;
  rowIndex?: number | null;
}): string {
  const row = opts.rowIndex != null && opts.rowIndex >= 0 ? String(opts.rowIndex) : '-';
  return `${opts.featurePath}|${opts.scenarioKey}|a${opts.attempt}|r${row}`;
}

export function parseRowIndexFromEnv(): number | undefined {
  const raw = process.env.COTESTER_DATASET_ROW_INDEX;
  if (raw == null || raw.trim() === '') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseRowLabelFromEnv(): string | undefined {
  const raw = process.env.COTESTER_DATASET_ROW_LABEL;
  return raw && raw.trim() ? raw.trim() : undefined;
}
