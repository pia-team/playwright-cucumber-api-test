import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startMockApiServer } from './e2e/mockApiServer';

describe('runtime UUID query cucumber', () => {
  it('sends a generated UUID as the id query parameter', async () => {
    const server = await startMockApiServer();
    const reportPath = path.join(process.cwd(), 'reports/cucumber-report/runtime-uuid-query-e2e.json');
    const feature = path.join(process.cwd(), 'tests/e2e/runtime-uuid-query.feature');
    const featureText = readFileSync(feature, 'utf8');
    assert.match(featureText, /generated as "uuid"/);
    assert.match(featureText, /\{\{resourceId\}\}/);
    assert.doesNotMatch(featureText, /Rastgele UUID/);

    const env = { ...process.env, COTESTER_API_BASE_URL: server.baseUrl, BASE_URL: server.baseUrl };
    try {
      const code = await runCucumber(env, feature, reportPath);
      assert.equal(code, 0, 'cucumber should pass');

      const lookup = server.requests.find((call) => call.method === 'GET' && call.path === '/lookup');
      assert.ok(lookup, 'expected GET /lookup');
      const params = new URLSearchParams(lookup.query);
      const id = params.get('id') || '';
      assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.equal(params.get('limit'), '10');
      assert.notEqual(id, 'Rastgele UUID');
    } finally {
      await server.close();
    }
  });
});

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
