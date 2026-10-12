import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startMockApiServer } from './e2e/mockApiServer';

describe('cucumber criteria collection', () => {
  it('records a later PASS after an earlier FAIL and fails the scenario', async () => {
    const server = await startMockApiServer();
    const reportPath = path.join(process.cwd(), 'reports/cucumber-report/criteria-e2e.json');
    const feature = path.join(process.cwd(), 'tests/e2e/criteria-results.feature');
    const env = { ...process.env, COTESTER_API_BASE_URL: server.baseUrl, BASE_URL: server.baseUrl };
    delete env.API_TOKEN;
    delete env.API_KEY_VALUE;
    try {
      const code = await runCucumber(env, feature, reportPath);
      const report = JSON.parse(readFileSync(reportPath, 'utf8')) as Array<{
        elements: Array<{
          steps: Array<{ name: string; result?: { status?: string }; embeddings?: Array<{ mime_type?: string; data?: string }> }>;
          after?: Array<{ result?: { status?: string; error_message?: string } }>;
        }>;
      }>;
      const scenario = report[0].elements[0];
      const criteria = scenario.steps.filter((step) => step.name?.includes('criterion'));
      assert.equal(criteria.length, 2);
      assert.equal(criteria[0].result?.status, 'passed');
      assert.equal(criteria[1].result?.status, 'passed');
      const decoded = criteria.map((step) => decodeCriterion(step.embeddings || []));
      assert.equal(decoded[0].status, 'FAIL');
      assert.equal(decoded[0].description, 'Response içinde taxNumber bulunmalı');
      assert.equal(decoded[0].path, '$.taxNumber');
      assert.equal(decoded[1].status, 'PASS');
      assert.equal(decoded[1].description, 'users dolu olmalı');
      const statusStep = scenario.steps.find((step) => step.name?.includes('status should be'));
      assert.equal(statusStep?.result?.status, 'passed');
      const failedHook = scenario.steps.find(
        (step) => step.keyword === 'After' && step.result?.status === 'failed',
      );
      assert.ok(failedHook);
      assert.match(failedHook.result?.error_message || '', /taxNumber/);
      assert.match(failedHook.result?.error_message || '', /Sonuç: FAIL/);
      assert.equal(code, 1);
    } finally {
      await server.close();
    }
  });
});

function decodeCriterion(embeddings: Array<{ mime_type?: string; data?: string }>): { status: string; description: string; path?: string } {
  const embedding = embeddings.find((item) => item.mime_type === 'application/vnd.cotester.criterion+json');
  assert.ok(embedding?.data);
  return JSON.parse(Buffer.from(embedding.data, 'base64').toString('utf8'));
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
