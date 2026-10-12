/**
 * Child worker for jobTokenCache multiprocess tests — one managed-token acquire/renew cycle.
 */
import * as http from 'http';
import {
  beginAcquisition,
  resolveExpiration,
  storeEntry,
} from '../../src/utils/jobTokenCache';

async function postToken(mockBase: string): Promise<{ body: unknown; token: string; status: number }> {
  return new Promise((resolve, reject) => {
    const url = new URL('/oauth/token', mockBase);
    const body = 'grant_type=client_credentials';
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            const token = typeof json.access_token === 'string' ? json.access_token : '';
            resolve({ body: json, token, status: res.statusCode || 0 });
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main(): Promise<void> {
  const mockBase = process.env.MOCK_BASE_URL?.trim();
  const fingerprint = process.env.TOKEN_FINGERPRINT?.trim();
  if (!mockBase || !fingerprint) {
    console.error('MISSING_ENV');
    process.exit(2);
  }

  const outcome = await beginAcquisition(fingerprint);
  if (outcome.kind === 'hit') {
    console.log(JSON.stringify({
      kind: 'hit',
      tokenPresent: Boolean(outcome.entry.values.access_token),
      expectedStatus: outcome.entry.expectedStatus,
      generation: outcome.entry.generation,
      expirationSource: outcome.entry.expirationSource || null,
    }));
    return;
  }
  if (outcome.kind === 'disabled') {
    console.log(JSON.stringify({ kind: 'disabled' }));
    process.exit(3);
  }

  const fetched = await postToken(mockBase);
  if (fetched.status < 200 || fetched.status >= 300 || !fetched.token.trim()) {
    const { releaseLock } = await import('../../src/utils/jobTokenCache');
    releaseLock(outcome.lockPath);
    console.log(JSON.stringify({
      kind: 'acquire_failed',
      status: fetched.status,
      tokenPresent: false,
    }));
    process.exit(4);
  }

  const acquiredAt = Date.now();
  const expiration = resolveExpiration(acquiredAt, fetched.body, fetched.token);
  const generation = outcome.previousGeneration + 1;
  const result = storeEntry(
    outcome.cacheKey,
    {
      values: { access_token: fetched.token },
      expectedStatus: 200,
      acquiredAt,
      expiresAt: expiration.expiresAt,
      lifetimeMs: expiration.lifetimeMs,
      expirationSource: expiration.source,
      generation,
    },
    outcome.lockPath,
  );
  console.log(JSON.stringify({
    kind: outcome.renewing ? 'renew' : 'acquire',
    tokenPresent: true,
    stored: result.stored,
    generation,
    expirationSource: expiration.source,
    renewing: outcome.renewing,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
