import { spawn } from 'child_process';
import * as path from 'path';
import { MOCK_SYNTHETIC_ACCESS_TOKEN, startMockApiServer } from './mockApiServer';

function runCucumber(env: NodeJS.ProcessEnv, cwd: string, feature: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // Must be async spawn — spawnSync would block the event loop and stall the in-process mock server.
    const child = spawn(
      'npx',
      ['cucumber-js', feature, '--tags', '@e2e-local-mock'],
      {
        cwd,
        env,
        stdio: 'inherit',
        shell: true,
      },
    );
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<number> {
  const server = await startMockApiServer();
  const env = {
    ...process.env,
    COTESTER_API_BASE_URL: server.baseUrl,
    BASE_URL: server.baseUrl,
    E2E_MOCK_KNOWN_TOKEN: MOCK_SYNTHETIC_ACCESS_TOKEN,
  };
  delete env.API_TOKEN;
  delete env.API_KEY_VALUE;

  const feature = path.join(__dirname, 'local-mock-api.feature');
  const cwd = path.join(__dirname, '../..');

  console.log(`Local mock API listening at ${server.baseUrl}`);
  try {
    return await runCucumber(env, cwd, feature);
  } finally {
    await server.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
