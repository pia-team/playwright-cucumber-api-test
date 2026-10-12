import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeUnauthorizedChallenge } from '../src/utils/httpEvidence';

describe('summarizeUnauthorizedChallenge', () => {
  it('reports missing WWW-Authenticate without claiming token expiry', () => {
    const text = summarizeUnauthorizedChallenge(401, {});
    assert.match(text, /HTTP 401 Unauthorized/);
    assert.match(text, /no WWW-Authenticate/);
    assert.match(text, /validity not determined/i);
    assert.equal(text.toLowerCase().includes('expired'), false);
  });

  it('keeps scheme and error code but redacts sensitive challenge parameters', () => {
    const text = summarizeUnauthorizedChallenge(401, {
      'www-authenticate':
        'Bearer realm="api", error="invalid_token", error_description="The access token expired", access_token="secret-value"',
    });
    assert.match(text, /scheme=Bearer/);
    assert.match(text, /error=invalid_token/);
    assert.equal(text.includes('secret-value'), false);
    assert.equal(text.includes('access token expired'), false);
    assert.equal(text.includes('error_description'), false);
    assert.match(text, /redacted/i);
  });

  it('does not dump the raw WWW-Authenticate header', () => {
    const header = 'Bearer error="invalid_token", error_description="leak-me-please"';
    const text = summarizeUnauthorizedChallenge(401, { 'WWW-Authenticate': header });
    assert.equal(text.includes(header), false);
    assert.equal(text.includes('leak-me-please'), false);
  });
});
