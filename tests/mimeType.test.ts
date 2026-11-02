import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMultipartMimeType } from '../src/utils/mimeType';

describe('resolveMultipartMimeType', () => {
  it('keeps explicit content type', () => {
    assert.equal(resolveMultipartMimeType('x.bin', 'application/pdf'), 'application/pdf');
  });

  it('guesses common extensions', () => {
    assert.equal(resolveMultipartMimeType('photo.PNG'), 'image/png');
    assert.equal(resolveMultipartMimeType('/tmp/a.pdf'), 'application/pdf');
    assert.equal(resolveMultipartMimeType('data.json'), 'application/json');
  });

  it('falls back to octet-stream for unknown extensions', () => {
    assert.equal(resolveMultipartMimeType('blob.unknownext'), 'application/octet-stream');
    assert.equal(resolveMultipartMimeType(''), 'application/octet-stream');
  });
});
