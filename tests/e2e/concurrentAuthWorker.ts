/**
 * Child process entry for concurrent auth isolation tests.
 * Env: CONCURRENT_RUN_ID, CONCURRENT_AUTH_MODE (KEYCLOAK|BEARER), MOCK_BASE_URL, COTESTER_RUNTIME_DIR
 */
import * as fs from 'fs';
import * as path from 'path';
import { resolveRequestAuth } from '../../src/utils/authResolution';
import { AuthHelper, enterAuthScenario } from '../../src/utils/authHelper';
import { beginHttpEvidence, evidenceForAttach } from '../../src/utils/httpEvidence';

type AuthMode = 'KEYCLOAK' | 'BEARER';

async function main(): Promise<void> {
  const runId = process.env.CONCURRENT_RUN_ID?.trim();
  const mockBase = process.env.MOCK_BASE_URL?.trim();
  const runtimeDir = process.env.COTESTER_RUNTIME_DIR?.trim();
  const authMode = (process.env.CONCURRENT_AUTH_MODE?.trim() || 'BEARER') as AuthMode;

  if (!runId || !mockBase || !runtimeDir) {
    throw new Error('CONCURRENT_RUN_ID, MOCK_BASE_URL, and COTESTER_RUNTIME_DIR are required');
  }

  fs.mkdirSync(runtimeDir, { recursive: true });
  enterAuthScenario();

  beginHttpEvidence({ authMode, method: 'GET', url: `${mockBase}/secure` });
  const auth = await resolveRequestAuth(authMode);
  const res = await fetch(`${mockBase}/secure`, {
    headers: {
      ...auth.headers,
      'X-Concurrent-Run-Id': runId,
    },
  });
  const bodyText = await res.text();

  const evidencePath = path.join(runtimeDir, 'http-evidence.json');
  fs.writeFileSync(evidencePath, evidenceForAttach(res.status !== 200) || '{}', 'utf8');

  const result = {
    runId,
    authMode,
    status: res.status,
    ok: res.status === 200,
    bodyPreview: bodyText.slice(0, 120),
  };
  fs.writeFileSync(path.join(runtimeDir, 'result.json'), JSON.stringify(result), 'utf8');

  AuthHelper.clearToken();
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  const runtimeDir = process.env.COTESTER_RUNTIME_DIR?.trim();
  const message = err instanceof Error ? err.message : String(err);
  if (runtimeDir) {
    try {
      fs.mkdirSync(runtimeDir, { recursive: true });
      fs.writeFileSync(path.join(runtimeDir, 'result.json'), JSON.stringify({ ok: false, error: message }), 'utf8');
    } catch {
      // best effort
    }
  }
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
