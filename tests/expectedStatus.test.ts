import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startMockApiServer } from './e2e/mockApiServer';
import { ResponseHelper } from '../src/utils/responseHelper';

/**
 * The generic HTTP step `Then the API response status should be {int}`
 * compares with expect(actual).toBe(expected). ResponseHelper.validateStatus
 * uses that same comparison.
 */
describe('expected HTTP status', () => {
  it('passes when expected 403 and actual 403, fails when actual is 200', async () => {
    const server = await startMockApiServer();
    try {
      const forbidden = await fetch(`${server.baseUrl}/protected`, {
        headers: { Authorization: 'Bearer wrong-token' },
      });
      assert.equal(forbidden.status, 403);
      await ResponseHelper.validateStatus({ status: () => forbidden.status }, 403);

      const ok = await fetch(`${server.baseUrl}/users`);
      assert.equal(ok.status, 200);
      await assert.rejects(
        () => ResponseHelper.validateStatus({ status: () => ok.status }, 403),
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          assert.match(message, /403/);
          assert.match(message, /200/);
          return true;
        },
      );
    } finally {
      await server.close();
    }
  });
});
