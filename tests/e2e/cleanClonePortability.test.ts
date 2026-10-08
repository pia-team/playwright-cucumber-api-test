import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '../..');
const MOBILE_ROOT = path.resolve(REPO_ROOT, '../test-assistant-mobile');
const WEB_ROOT = path.resolve(REPO_ROOT, '../test-asistant-playwright');

const BLOCKED_PATH_FRAGMENTS = ['.env', '.pem', 'credentials', 'secret', 'id_rsa', 'api-auth.runtime.json'];
const BLOCKED_PREFIXES = ['node_modules/', 'reports/', 'test-results/', '.cotester/'];

function isBlockedRelative(rel: string): boolean {
  const normalized = rel.replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('..')) return true;
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1);
  if (fileName === '.env' || fileName.startsWith('.env.')) return true;
  for (const fragment of BLOCKED_PATH_FRAGMENTS) {
    if (fileName.includes(fragment) && !fileName.endsWith('.ts') && !fileName.endsWith('.feature')) {
      return true;
    }
  }
  for (const prefix of BLOCKED_PREFIXES) {
    if (normalized.startsWith(prefix) || normalized.includes(`/${prefix}`)) return true;
  }
  return false;
}

function sanitizeProjectJson(raw: string): string {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  for (const key of ['password', 'token', 'secret', 'api_key', 'client_secret', 'username']) {
    delete parsed[key];
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function copyPublishTree(srcRoot: string, destRoot: string, relativePaths: string[]) {
  for (const rel of relativePaths) {
    if (isBlockedRelative(rel)) {
      throw new Error(`blocked path would have been published: ${rel}`);
    }
    const src = path.join(srcRoot, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(destRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (rel.endsWith('.json') && rel.includes('config/projects/')) {
      fs.writeFileSync(dest, sanitizeProjectJson(fs.readFileSync(src, 'utf8')));
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

function run(cmd: string, args: string[], cwd: string) {
  execFileSync(cmd, args, { cwd, stdio: 'pipe', env: process.env });
}

describe('clean-clone GitHub portability (local fixture)', () => {
  let workDir = '';
  let originDir = '';
  let cloneDir = '';

  before(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotester-clean-clone-'));
    originDir = path.join(workDir, 'origin.git');
    cloneDir = path.join(workDir, 'consumer');

    run('git', ['init', '--bare', originDir], workDir);

    const seed = path.join(workDir, 'seed');
    fs.mkdirSync(seed, { recursive: true });

    const apiFiles = [
      'package.json',
      'package-lock.json',
      'cucumber.js',
      'tsconfig.json',
      'src/config/env.config.ts',
      'src/config/projectEnv.ts',
      'src/utils/logger.ts',
      'src/utils/runtimeCredentials.ts',
      'src/utils/authHelper.ts',
      'src/utils/authResolution.ts',
      'src/utils/httpEvidence.ts',
      'tests/genericHttp.auth.e2e.test.ts',
    ];
    copyPublishTree(REPO_ROOT, seed, apiFiles);
    fs.writeFileSync(
      path.join(seed, 'tsconfig.publish.json'),
      JSON.stringify(
        {
          extends: './tsconfig.json',
          include: ['src/utils/httpEvidence.ts'],
        },
        null,
        2,
      ),
    );

    // Deliberately present in workspace but must never appear in publish payload.
    fs.mkdirSync(path.join(seed, 'config/projects'), { recursive: true });
    fs.writeFileSync(
      path.join(seed, 'config/projects/Demo.dev.json'),
      sanitizeProjectJson(
        JSON.stringify({ baseLoginUrl: 'https://demo.example', password: 'SuperSecret123!' }),
      ),
    );
    // Local-only secret file (must never be part of publish payload / clone).
    fs.writeFileSync(path.join(seed, '.gitignore'), '.env\n');
    fs.writeFileSync(path.join(seed, '.env'), 'API_TOKEN=must-not-clone\n');

    const webFiles = [
      'package.json',
      'cucumber.js',
      'src/features/steps/common/world.ts',
    ];
    for (const rel of webFiles) {
      const src = path.join(WEB_ROOT, rel);
      if (!fs.existsSync(src)) continue;
      const dest = path.join(seed, 'web-runner', rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }

    run('git', ['init'], seed);
    run('git', ['config', 'user.email', 'clone-test@example.com'], seed);
    run('git', ['config', 'user.name', 'Clone Test'], seed);
    run('git', ['add', '-A'], seed);
    run('git', ['commit', '-m', 'seed publish payload'], seed);
    run('git', ['remote', 'add', 'origin', originDir], seed);
    run('git', ['push', '-u', 'origin', 'HEAD:main'], seed);

    run('git', ['clone', originDir, cloneDir], workDir);
  });

  after(() => {
    if (workDir) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('fresh clone excludes secret files from publish payload', () => {
    assert.equal(fs.existsSync(path.join(cloneDir, '.env')), false);
    const demoConfig = path.join(cloneDir, 'config/projects/Demo.dev.json');
    if (fs.existsSync(demoConfig)) {
      const text = fs.readFileSync(demoConfig, 'utf8');
      assert.ok(!text.includes('SuperSecret123!'));
      assert.ok(!/password/i.test(text));
    }
  });

  it('API runner: npm ci, typecheck auth utils, auth e2e unit against mock', () => {
    run('npm', ['ci'], cloneDir);
    run('npx', ['tsc', '--noEmit', '-p', 'tsconfig.publish.json'], cloneDir);
    run('npm', ['run', 'test:unit'], cloneDir);
  });

  it('MOBILE runner: npm ci, typecheck, cucumber dry-run bootstrap only', () => {
    if (!fs.existsSync(path.join(MOBILE_ROOT, 'package.json'))) {
      return;
    }
    const mobileClone = path.join(workDir, 'mobile-clone');
    fs.cpSync(MOBILE_ROOT, mobileClone, {
      recursive: true,
      filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`),
    });
    run('npm', ['ci'], mobileClone);
    run('npm', ['run', 'typecheck'], mobileClone);
    run('npm', ['run', 'test:dry'], mobileClone);
  });
});
