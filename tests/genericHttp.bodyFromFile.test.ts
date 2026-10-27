import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resetTestDataCache } from '../src/utils/testData';

describe('genericHttp body-from-file step contract', () => {
  let workDir: string;
  let prevManifest: string | undefined;

  before(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotester-body-file-'));
    const payloadPath = path.join(workDir, 'payload.json');
    fs.writeFileSync(payloadPath, '{"hello":"world"}', 'utf8');
    const manifestPath = path.join(workDir, 'manifest.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        resources: {
          payload: { localPath: payloadPath, resourceType: 'FILE' },
        },
      }),
      'utf8',
    );
    prevManifest = process.env.COTESTER_RUN_DATA_MANIFEST_PATH;
    process.env.COTESTER_RUN_DATA_MANIFEST_PATH = manifestPath;
    resetTestDataCache();
  });

  after(() => {
    if (prevManifest === undefined) {
      delete process.env.COTESTER_RUN_DATA_MANIFEST_PATH;
    } else {
      process.env.COTESTER_RUN_DATA_MANIFEST_PATH = prevManifest;
    }
    resetTestDataCache();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('testData.getFile resolves materialized localPath for REQUEST_BODY binding', async () => {
    const { testData } = await import('../src/utils/testData');
    const filePath = await testData.getFile('payload');
    assert.equal(fs.readFileSync(filePath, 'utf8'), '{"hello":"world"}');
  });

  it('loadRequestBodyBufferFromBinding returns Buffer (byte-safe)', async () => {
    const { loadRequestBodyBufferFromBinding } = await import('../src/utils/requestBodyFile');
    const buf = await loadRequestBodyBufferFromBinding('payload');
    assert.ok(Buffer.isBuffer(buf));
    assert.equal(buf.toString('utf8'), '{"hello":"world"}');
  });

  it('step definition text exists for body-from-file (compile contract)', () => {
    const stepSource = fs.readFileSync(
      path.join(__dirname, '../src/features/steps/common/genericHttp.step.ts'),
      'utf8',
    );
    assert.match(
      stepSource,
      /the API request body is loaded from Data Center file \{string\}/,
    );
    assert.match(stepSource, /loadRequestBodyBufferFromBinding/);
    // Must resolve via manifest getFile — not hard-coded absolute paths in the step.
    assert.doesNotMatch(stepSource, /readFile\(['"]\/|@\/Users\//);
  });
});
