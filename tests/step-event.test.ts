import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildExecutionUnitKey,
  buildScenarioKey,
} from '../src/core/hooks/step-event';

describe('API step-event identity', () => {
  it('keeps soft-fail as FAIL event identity distinct per attempt', () => {
    const scen = buildScenarioKey({
      featurePath: 'api.feature',
      scenarioName: 'Assert body',
      pickleId: 'p-api',
    });
    const a1 = buildExecutionUnitKey({
      featurePath: 'api.feature',
      scenarioKey: scen,
      attempt: 1,
    });
    const a2 = buildExecutionUnitKey({
      featurePath: 'api.feature',
      scenarioKey: scen,
      attempt: 2,
    });
    assert.notEqual(a1, a2);
  });
});
