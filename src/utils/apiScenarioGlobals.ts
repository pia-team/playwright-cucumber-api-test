import { clearManagedTokenVarRegistry, setLastHttpSendSnapshot } from './authTokenRecovery';
import { resetHttpEvidence } from './httpEvidence';
import { releaseLock } from './jobTokenCache';

/**
 * Clears process-global HTTP/chain state used by genericHttp.step.
 *
 * Cucumber-js (and CoTester API runs) execute scenarios sequentially inside a
 * worker/process. Resetting at each scenario Before is therefore the isolation
 * boundary. Do not treat this as safe for concurrent scenarios sharing one
 * Node process without AsyncLocalStorage — that mode is not configured today.
 */
export function resetApiHttpScenarioGlobals(): void {
  const g = global as any;
  const prev = g.__cotesterGenericHttp as
    | { managedTokenLockHeld?: boolean; managedTokenLockPath?: string }
    | undefined;
  if (prev?.managedTokenLockHeld && prev.managedTokenLockPath) {
    releaseLock(prev.managedTokenLockPath);
  }
  g.__cotesterGenericHttp = undefined;
  clearManagedTokenVarRegistry();
  setLastHttpSendSnapshot(null);
  g.__cotesterChainMode = false;
  g.__cotesterStepId = '';
  g.__cotesterStepLabel = '';
  g.__cotesterStepBlocked = '';
  g.__cotesterExtractAllowed = false;
  g.__cotesterPendingExtracts = [];
  g.__cotesterCriterionOutcomes = [];
  g.__cotesterRedactValues = [];
  g.__cotesterSentJson = undefined;
  g.__cotesterSentQuery = undefined;
  g.currentResponse = undefined;
  g.__cotesterResponseJson = undefined;
  g.__cotesterResponseBodyText = null;
  g.__cotesterElapsedMs = undefined;
  resetHttpEvidence();
}
