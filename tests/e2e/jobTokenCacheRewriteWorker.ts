/**
 * Test helper: rewrite a cached entry into the proactive-renewal window.
 */
import { buildRuntimeCacheKey, forceStoreEntryForTests } from '../../src/utils/jobTokenCache';

const fingerprint = process.env.TOKEN_FINGERPRINT?.trim();
if (!fingerprint) {
  console.error('MISSING_FINGERPRINT');
  process.exit(2);
}

const key = buildRuntimeCacheKey(fingerprint);
const now = Date.now();
forceStoreEntryForTests(key, {
  values: { access_token: 'near-expiry-seed' },
  expectedStatus: 200,
  acquiredAt: now - 50 * 60 * 1000,
  expiresAt: now + 60 * 1000,
  lifetimeMs: 60 * 60 * 1000,
  expirationSource: 'expires_in',
  generation: 1,
});
console.log(JSON.stringify({ ok: true }));
