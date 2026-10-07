/**
 * Minimal API-side capture: after scenarios, if COTESTER_FLOW_CAPTURE=1,
 * merge any `globalThis.__cotesterLastJsonBody` into flow context using bindings file.
 */
import { After, Before } from '@cucumber/cucumber';
import * as fs from 'fs/promises';
import * as path from 'path';

declare global {
  // eslint-disable-next-line no-var
  var __cotesterLastJsonBody: unknown;
  // eslint-disable-next-line no-var
  var __cotesterLastUrl: string | undefined;
  // eslint-disable-next-line no-var
  var __cotesterLastMethod: string | undefined;
}

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
    let bindings: Array<{ variableKey: string; sourceDefinition?: { jsonPath?: string; urlPattern?: string; method?: string } }> = [];
    if (process.env.COTESTER_FLOW_BINDINGS) {
      bindings = JSON.parse(await fs.readFile(process.env.COTESTER_FLOW_BINDINGS, 'utf8'));
    }
    let ctx: Record<string, string> = {};
    try {
      ctx = JSON.parse(await fs.readFile(process.env.COTESTER_FLOW_CONTEXT_PATH, 'utf8'));
    } catch {
      ctx = {};
    }
    const body = globalThis.__cotesterLastJsonBody;
    for (const rule of bindings) {
      const jp = rule.sourceDefinition?.jsonPath || '$.id';
      const parts = jp.replace(/^\$\.?/, '').split('.').filter(Boolean);
      let cur: any = body;
      for (const p of parts) {
        cur = cur?.[p];
      }
      if (cur != null) {
        ctx[rule.variableKey] = String(cur);
      }
    }
    const tmp = process.env.COTESTER_FLOW_CONTEXT_PATH + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(ctx, null, 2), 'utf8');
    await fs.rename(tmp, process.env.COTESTER_FLOW_CONTEXT_PATH);
    if (process.env.COTESTER_FLOW_CAPTURE_ARTIFACT) {
      await fs.mkdir(path.dirname(process.env.COTESTER_FLOW_CAPTURE_ARTIFACT), { recursive: true });
      await fs.writeFile(
        process.env.COTESTER_FLOW_CAPTURE_ARTIFACT,
        JSON.stringify({
          candidates: body
            ? [{ businessLabel: 'ID', variableKey: 'id', sourceType: 'NETWORK_RESPONSE', sampleValueMasked: '***' }]
            : [],
        }),
        'utf8',
      );
    }
  } catch (e) {
    console.warn('API flow capture flush failed', e);
  }
});
