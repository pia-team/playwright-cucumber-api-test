import { Then } from '@cucumber/cucumber';
import { evidenceForAttach, getHttpEvidence } from '../../../utils/httpEvidence';

/**
 * E2E-only assertion: harness sets E2E_MOCK_KNOWN_TOKEN to the mock server's synthetic access_token.
 */
Then('the HTTP evidence redaction rules are satisfied for the mock E2E token', async function () {
  const known = process.env.E2E_MOCK_KNOWN_TOKEN?.trim();
  if (!known) {
    throw new Error(
      'E2E_MOCK_KNOWN_TOKEN is not set. Run via npm run test:e2e:local so the mock harness configures redaction checks.',
    );
  }

  const compact = evidenceForAttach(false);
  const full = evidenceForAttach(true);
  for (const blob of [compact, full]) {
    if (!blob) continue;
    if (blob.includes(known)) {
      throw new Error('HTTP evidence attachment still contains the mock access token (expected redaction)');
    }
    if (/Bearer\s+(?!(\[REDACTED\]))/i.test(blob)) {
      throw new Error('HTTP evidence attachment contains a non-redacted Bearer value');
    }
  }

  const ev = getHttpEvidence();
  if (ev?.requestHeaders?.Authorization && ev.requestHeaders.Authorization !== '[REDACTED]') {
    throw new Error('Stored HTTP evidence request Authorization header was not redacted');
  }
  if (ev?.responseBody && ev.responseBody.includes(known)) {
    throw new Error('Stored HTTP evidence response body still contains access_token value');
  }
});
