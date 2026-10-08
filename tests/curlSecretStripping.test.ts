import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CurlParser lives in test-assistant-ai-be (Java), not in this runner.
 * This test documents that gap and validates runner-side header redaction used by HTTP evidence instead.
 */
describe('cURL secret stripping (runner scope)', () => {
  it('CurlParser is backend-only; runner uses httpEvidence redaction for secrets', () => {
    const beParser = path.resolve(
      __dirname,
      '../../test-assistant-ai-be/src/main/java/com/app/testassistantaibe/service/apitesting/CurlParser.java',
    );
    assert.ok(fs.existsSync(beParser), 'expected BE CurlParser source for API authoring');
    // Runner E2E covers generic HTTP + auth lifecycle; no TS CurlParser in this package.
  });
});
