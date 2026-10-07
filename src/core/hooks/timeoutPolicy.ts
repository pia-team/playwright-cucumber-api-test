import { setDefaultTimeout } from '@cucumber/cucumber';

function parsePositiveInt(envKey: string, fallbackMs: number): number {
  const raw = process.env[envKey];
  if (raw == null || raw.trim() === '') {
    return fallbackMs;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

const apiRequestTimeoutMs = parsePositiveInt('COTESTER_API_REQUEST_TIMEOUT_MS', 60_000);
const stepTimeoutMs = parsePositiveInt('COTESTER_STEP_TIMEOUT_MS', apiRequestTimeoutMs);

setDefaultTimeout(Math.max(stepTimeoutMs, apiRequestTimeoutMs));
