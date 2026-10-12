import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { startMockApiServer } from './e2e/mockApiServer';

const ROOT = process.cwd();
const ALLURE_RESULTS = path.join(ROOT, 'allure-results');
const ALLURE_REPORT = path.join(ROOT, 'reports/api-reports/allure-e2e-job');

describe('API Allure reporter (mock)', () => {
  it('cucumber.js and package.json declare allure-cucumberjs', () => {
    const cucumberJs = readFileSync(path.join(ROOT, 'cucumber.js'), 'utf8');
    assert.match(cucumberJs, /allure-cucumberjs\/reporter/);
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      devDependencies?: Record<string, string>;
    };
    assert.ok(pkg.devDependencies?.['allure-cucumberjs']);
    assert.ok(pkg.devDependencies?.['allure-js-commons']);
  });

  it('writes allure-results and generates job-scoped HTML for pass/fail/soft/chain', async () => {
    const server = await startMockApiServer();
    const feature = path.join(ROOT, 'tests/e2e/allure-coverage.feature');
    ensureAllureFeature(feature);
    rmSync(ALLURE_RESULTS, { recursive: true, force: true });
    rmSync(ALLURE_REPORT, { recursive: true, force: true });

    const env = { ...process.env, COTESTER_API_BASE_URL: server.baseUrl, BASE_URL: server.baseUrl };
    delete env.API_TOKEN;
    delete env.API_KEY_VALUE;

    try {
      const code = await runCucumber(env, feature);
      assert.equal(code, 1, 'soft-fail + NOT_EVALUATED scenarios should fail the run');

      assert.ok(existsSync(ALLURE_RESULTS), 'allure-results directory');
      const resultFiles = readdirSync(ALLURE_RESULTS).filter((f) => f.endsWith('-result.json'));
      assert.ok(resultFiles.length >= 3, `expected multiple result files, got ${resultFiles.length}`);

      const resultsBlob = resultFiles
        .map((f) => readFileSync(path.join(ALLURE_RESULTS, f), 'utf8'))
        .join('\n');
      // Attachment bodies live in companion *-attachment.json files, not inlined in result.json.
      const attachmentBlob = readdirSync(ALLURE_RESULTS)
        .filter((f) => f.includes('attachment'))
        .map((f) => readFileSync(path.join(ALLURE_RESULTS, f), 'utf8'))
        .join('\n');
      const allBlob = `${resultsBlob}\n${attachmentBlob}`;

      assert.match(resultsBlob, /Allure happy path/);
      assert.match(resultsBlob, /Allure soft FAIL/);
      assert.match(resultsBlob, /Allure chain/);
      assert.match(resultsBlob, /Allure UUID query/);
      assert.equal(allBlob.includes('super-secret-token-value'), false);
      assert.match(resultsBlob, /HTTP Summary\.json/);
      assert.match(resultsBlob, /HTTP Request\.json/);
      assert.match(resultsBlob, /HTTP Response\.json/);
      assert.match(attachmentBlob, /"durationMs"/);
      assert.match(attachmentBlob, /\/lookup\?id=/);
      assert.match(
        attachmentBlob,
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
      );

      const genCode = await runAllureGenerate();
      assert.equal(genCode, 0);
      assert.ok(existsSync(path.join(ALLURE_REPORT, 'index.html')));
      const indexHtml = readFileSync(path.join(ALLURE_REPORT, 'index.html'), 'utf8');
      assert.match(indexHtml, /allure/i);
    } finally {
      await server.close();
      rmSync(feature, { force: true });
    }
  });
});

function ensureAllureFeature(featurePath: string): void {
  mkdirSync(path.dirname(featurePath), { recursive: true });
  writeFileSync(
    featurePath,
    `@e2e-allure
Feature: Allure coverage against local mock API

  Scenario: Allure happy path
    Given the API request uses auth mode "NONE"
    When the user sends a GET request to "/users"
    Then the API response status should be 200
    And the API response JSON path "$.users" should exists "true"

  Scenario: Allure UUID query
    Given the scenario variable "resourceId" is generated as "uuid"
    Given the API chain step "s0" "GET /lookup"
    And the API request uses auth mode "NONE"
    And the API request query parameters are
      | id | {{resourceId}} |
      | limit | 10 |
    When the user sends a GET request to "/lookup"
    And API step "s0" "GET /lookup" expects status 200

  Scenario: Allure soft FAIL then PASS still fails scenario
    Given the API request uses auth mode "NONE"
    When the user sends a GET request to "/users/1"
    Then the API response status should be 200
    And criterion "missing" holds: "taxNumber must exist"
      """
      {"id":"missing","description":"taxNumber must exist","type":"field_exists","path":"$.taxNumber","operator":"exists"}
      """
    And criterion "name" holds: "name equals Demo User"
      """
      {"id":"name","description":"name equals Demo User","type":"field_equals","path":"$.name","operator":"eq","expected":"Demo User"}
      """

  Scenario: Allure chain with secret redaction and NOT_EVALUATED
    Given the API chain step "s1" "POST /customers"
    And the API request uses auth mode "NONE"
    And the API request body is
      """
      {"name":"secret"}
      """
    And the API chain will store response path "$.id"
    When the user sends a POST request to "/customers"
    And API step "s1" "POST /customers" expects status 201
    And the user stores the API response JSON path "$.id" as sensitive scenario variable "customerId"
    Given the API chain step "s2" "GET /customers/{{missingVar}}"
    And the API request uses auth mode "NONE"
    When the user sends a GET request to "/customers/{{missingVar}}"
    And API step "s2" "GET /customers/{{missingVar}}" expects status 200
`,
    'utf8',
  );
}

function runCucumber(env: NodeJS.ProcessEnv, feature: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // No shell: true — globs must reach cucumber-js unexpanded (same as BE API argv).
    const child = spawn(
      'npx',
      [
        'cucumber-js',
        feature,
        '--require',
        'src/features/steps/**/*.step.ts',
        '--require',
        'src/core/hooks/**/*.ts',
        '--format',
        'progress',
        '--format',
        'allure-cucumberjs/reporter',
      ],
      { cwd: ROOT, env, stdio: 'inherit', shell: false },
    );
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function runAllureGenerate(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      [
        '--yes',
        '--package=allure-commandline',
        'allure',
        'generate',
        'allure-results',
        '--clean',
        '-o',
        'reports/api-reports/allure-e2e-job',
      ],
      { cwd: ROOT, env: process.env, stdio: 'inherit', shell: false },
    );
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}
