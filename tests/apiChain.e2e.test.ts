import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startMockApiServer } from './e2e/mockApiServer';

describe('API chain cucumber', () => {
  it('uses a POST response value in later requests and blocks dependents', async () => {
    const server = await startMockApiServer();
    const reportPath = path.join(process.cwd(), 'reports/cucumber-report/api-chain-e2e.json');
    const feature = path.join(process.cwd(), 'tests/e2e/api-chain.feature');
    const featureText = readFileSync(feature, 'utf8');
    assert.match(featureText, /\{\{customerId\}\}/);
    assert.doesNotMatch(featureText, /super-secret-token-value/);
    const env = { ...process.env, COTESTER_API_BASE_URL: server.baseUrl, BASE_URL: server.baseUrl };
    delete env.API_TOKEN;
    delete env.API_KEY_VALUE;
    try {
      const code = await runCucumber(env, feature, reportPath);
      const report = JSON.parse(readFileSync(reportPath, 'utf8')) as Array<{
        elements: Array<{
          name: string;
          steps: Array<{
            name?: string;
            keyword?: string;
            result?: { status?: string };
            embeddings?: Array<{ mime_type?: string; data?: string }>;
          }>;
        }>;
      }>;
      const scenarios = report[0].elements;
      const byName = (name: string) => {
        const found = scenarios.find((item) => item.name === name);
        assert.ok(found, name);
        return found;
      };

      const happy = byName('POST id is used by GET PATCH and DELETE');
      assert.equal(outcome(happy, 's2', 'status'), 'PASS');
      assert.equal(outcome(happy, 'fetched', 'field_equals'), 'PASS');
      assert.equal(outcome(happy, 's1', 'field_equals'), 'PASS');
      assert.equal(failedHook(happy), undefined);

      const calls = server.requests;
      const firstGet = calls.find((call) => call.method === 'GET' && call.path.startsWith('/customers/'));
      assert.equal(firstGet?.path, '/customers/123');
      assert.equal(firstGet?.query, 'ref=123');
      assert.equal(firstGet?.customerHeader, '123');
      const patch = calls.find((call) => call.method === 'PATCH');
      assert.equal(patch?.path, '/customers/123');
      assert.match(patch?.body || '', /"echo":"123"/);
      assert.ok(calls.some((call) => call.method === 'DELETE' && call.path === '/customers/123'));

      const overwrite = byName('a later store overwrites the same variable');
      assert.equal(failedHook(overwrite), undefined);
      assert.ok(calls.some((call) => call.method === 'GET' && call.path === '/customers/125'));
      assert.equal(calls.filter((call) => call.path === '/customers/124' && call.method === 'GET').length, 0);

      const secret = byName('a stored secret is redacted and still sent');
      assert.ok(calls.some((call) => call.path === '/customers/super-secret-token-value'));
      const decoded = secret.steps.flatMap((step) =>
        (step.embeddings || [])
          .filter((item) => item.data)
          .map((item) => Buffer.from(item.data || '', 'base64').toString('utf8')),
      ).join('\n');
      assert.equal(decoded.includes('super-secret-token-value'), false);

      const missing = byName('a missing variable blocks only the dependent request');
      assert.equal(outcome(missing, 's1', 'status'), 'NOT_EVALUATED');
      assert.equal(outcome(missing, 's2', 'status'), 'PASS');
      assert.ok(failedHook(missing));

      const invalid = byName('an invalid JSON path does not store a value');
      assert.equal(outcome(invalid, 's1', 'extract'), 'FAIL');
      assert.equal(outcome(invalid, 's2', 'status'), 'NOT_EVALUATED');
      assert.equal(calls.filter((call) => call.path.includes('()')).length, 0);

      const failed = byName('one failed assertion fails the scenario and later requests still run');
      assert.equal(outcome(failed, 's1', 'field_exists'), 'FAIL');
      assert.equal(outcome(failed, 's2', 'status'), 'PASS');
      assert.ok(failedHook(failed));

      const blocked = byName('a status mismatch blocks a dependent request');
      assert.equal(outcome(blocked, 's1', 'status'), 'FAIL');
      assert.equal(outcome(blocked, 's2', 'status'), 'NOT_EVALUATED');
      assert.equal(outcome(blocked, 's3', 'status'), 'PASS');
      assert.equal(calls.filter((call) => call.method === 'GET' && call.path === '/customers/128').length, 0);

      const single = byName('a single request still checks status');
      const statusStep = single.steps.find((step) => step.name?.includes('status should be'));
      assert.equal(statusStep?.result?.status, 'passed');
      assert.equal(failedHook(single), undefined);

      assert.equal(code, 1);
    } finally {
      await server.close();
    }
  });
});

function outcome(
  scenario: { steps: Array<{ embeddings?: Array<{ mime_type?: string; data?: string }> }> },
  id: string,
  type: string,
): string | undefined {
  for (const step of scenario.steps) {
    for (const embedding of step.embeddings || []) {
      if (embedding.mime_type !== 'application/vnd.cotester.criterion+json' || !embedding.data) continue;
      const parsed = JSON.parse(Buffer.from(embedding.data, 'base64').toString('utf8')) as {
        id?: string;
        type?: string;
        status?: string;
        stepId?: string;
      };
      if ((parsed.id === id || parsed.stepId === id) && parsed.type === type) return parsed.status;
    }
  }
  return undefined;
}

function failedHook(scenario: { steps: Array<{ keyword?: string; result?: { status?: string } }> }): { result?: { status?: string } } | undefined {
  return scenario.steps.find((step) => step.keyword === 'After' && step.result?.status === 'failed');
}

function runCucumber(env: NodeJS.ProcessEnv, feature: string, reportPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['cucumber-js', feature, '--format', `json:${reportPath}`],
      { cwd: process.cwd(), env, stdio: 'inherit', shell: true },
    );
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}
