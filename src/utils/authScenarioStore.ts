import { AsyncLocalStorage } from 'async_hooks';
import { TokenResponse } from '../services/authService';

export interface AuthScenarioState {
  tokenResponse: TokenResponse | null;
}

const storage = new AsyncLocalStorage<AuthScenarioState>();

/** Fallback when Cucumber hooks did not enter ALS — keyed by CoTester job runtime dir. */
const jobFallback = new Map<string, AuthScenarioState>();

function jobKey(): string {
  return (
    process.env.COTESTER_RUNTIME_DIR?.trim() ||
    process.env.CUCUMBER_WORKER_ID?.trim() ||
    'default'
  );
}

/** Start an isolated auth token cache for the current Cucumber scenario (parallel-safe within a worker). */
export function enterAuthScenario(): void {
  storage.enterWith({ tokenResponse: null });
}

export function getAuthScenarioState(): AuthScenarioState {
  const store = storage.getStore();
  if (store) {
    return store;
  }
  const key = jobKey();
  let fallback = jobFallback.get(key);
  if (!fallback) {
    fallback = { tokenResponse: null };
    jobFallback.set(key, fallback);
  }
  return fallback;
}

export function clearAuthScenarioToken(): void {
  const store = storage.getStore();
  if (store) {
    store.tokenResponse = null;
  }
  jobFallback.delete(jobKey());
}
