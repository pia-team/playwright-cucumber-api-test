/**
 * API Flow capture: after scenarios, if COTESTER_FLOW_CAPTURE=1,
 * apply binding rules against the buffered HTTP responses (method/URL/jsonPath).
 * Fail-closed on missing/ambiguous matches for required bindings.
 */
import { After, Before } from '@cucumber/cucumber';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  applyCaptureRules,
  clearFlowHttpBuffer,
  type CaptureRule,
} from '../../utils/flowResponseBuffer';

Before(async function () {
  if (process.env.COTESTER_FLOW_CONTEXT_PATH) {
    try {
      const raw = await fs.readFile(process.env.COTESTER_FLOW_CONTEXT_PATH, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      (this as any).scenarioVars = { ...(parsed || {}) };
    } catch {
      (this as any).scenarioVars = (this as any).scenarioVars || {};
    }
  }
});

After(async function () {
  if (process.env.COTESTER_FLOW_CAPTURE !== '1' || !process.env.COTESTER_FLOW_CONTEXT_PATH) {
    return;
  }
  try {
    let bindings: CaptureRule[] = [];
    if (process.env.COTESTER_FLOW_BINDINGS) {
      bindings = JSON.parse(await fs.readFile(process.env.COTESTER_FLOW_BINDINGS, 'utf8'));
    }
    let ctx: Record<string, string> = {};
    try {
      ctx = JSON.parse(await fs.readFile(process.env.COTESTER_FLOW_CONTEXT_PATH, 'utf8'));
    } catch {
      ctx = {};
    }

    const result = applyCaptureRules(bindings);
    if (result.errors.length > 0) {
      const msg = `API Flow capture failed:\n- ${result.errors.join('\n- ')}`;
      console.error(msg);
      throw new Error(msg);
    }
    Object.assign(ctx, result.values);

    const tmp = process.env.COTESTER_FLOW_CONTEXT_PATH + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(ctx, null, 2), 'utf8');
    await fs.rename(tmp, process.env.COTESTER_FLOW_CONTEXT_PATH);

    if (process.env.COTESTER_FLOW_CAPTURE_ARTIFACT) {
      await fs.mkdir(path.dirname(process.env.COTESTER_FLOW_CAPTURE_ARTIFACT), { recursive: true });
      const candidates = Object.keys(result.values).map((variableKey) => ({
        businessLabel: variableKey,
        variableKey,
        sourceType: 'NETWORK_RESPONSE',
        sampleValueMasked: '***',
      }));
      await fs.writeFile(
        process.env.COTESTER_FLOW_CAPTURE_ARTIFACT,
        JSON.stringify({ candidates }),
        'utf8',
      );
    }
  } catch (e) {
    // Re-throw capture failures so the scenario/step fails closed.
    if (e instanceof Error && e.message.startsWith('API Flow capture failed:')) {
      throw e;
    }
    console.warn('API flow capture flush failed', e);
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearFlowHttpBuffer();
  }
});
