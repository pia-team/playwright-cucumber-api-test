import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { flowContext } from './flowContext';

/**
 * Run-scoped file resources (Phase 14). Binary content never enters Flow Context — only a resource id.
 * Storage: COTESTER_RUN_RESOURCE_DIR / resources / {resourceId}. Isolated per Flow/job run; cleaned up by the backend.
 * The same module is shipped to the UI runner and the API runner (support/runResource.ts (UI copy)).
 */

const KEY = /^[^\r\n]{1,200}$/;
const SAFE_NAME = /^[A-Za-z0-9._-]{1,120}$/;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_RESOURCES = 32;
const INDEX = 'index.json';

type IndexEntry = {
  resourceId: string;
  key: string;
  fileName: string;
  mediaType?: string;
  size: number;
  sensitive?: boolean;
};

type IndexFile = { resources: IndexEntry[] };

export type RunResourceHandle = {
  resourceId: string;
  path: string;
  mediaType?: string;
  size: number;
};

function rootDir(): string {
  const p = process.env.COTESTER_RUN_RESOURCE_DIR;
  if (!p) {
    throw new Error(
      'Run resources are not available (COTESTER_RUN_RESOURCE_DIR is not set). Runtime file handoff requires a CoTester run.',
    );
  }
  return path.resolve(p);
}

function checkKey(key: string): void {
  if (typeof key !== 'string' || !KEY.test(key) || key === '_meta') {
    throw new Error('Run resource key is invalid');
  }
}

function resourcesDir(): string {
  const dir = path.join(rootDir(), 'resources');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function indexPath(): string {
  return path.join(rootDir(), INDEX);
}

function readIndex(): IndexFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath(), 'utf8') || '{}');
    const resources = Array.isArray(parsed?.resources) ? parsed.resources : [];
    return { resources };
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { resources: [] };
    }
    throw new Error('Run resource index could not be read');
  }
}

function writeIndex(index: IndexFile): void {
  const p = indexPath();
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(index), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, p);
  try {
    fs.chmodSync(p, 0o600);
  } catch {
    // best effort
  }
}

function resolveInside(root: string, candidate: string): string {
  const resolved = path.resolve(candidate);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Run resource path escapes the run namespace');
  }
  try {
    if (fs.lstatSync(resolved).isSymbolicLink()) {
      throw new Error('Run resource path must not be a symlink');
    }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw e instanceof Error ? e : new Error('Run resource path is unsafe');
    }
  }
  return resolved;
}

function safeFileName(name: string | undefined): string {
  const base = (name || 'artifact.bin').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  return SAFE_NAME.test(base) ? base : 'artifact.bin';
}

function writeBytes(target: string, data: Buffer): void {
  if (data.length > MAX_BYTES) {
    throw new Error(`Run resource exceeds max size (${MAX_BYTES} bytes)`);
  }
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  fs.renameSync(tmp, target);
  try {
    fs.chmodSync(target, 0o600);
  } catch {
    // best effort
  }
}

export const runResource = {
  /**
   * Publish a runtime file under the current run and store its resource id in Flow Context under {@code key}.
   * Accepts Buffer, Uint8Array, or an absolute path that is copied into the run namespace (never kept as-is).
   */
  async publish(
    key: string,
    source: Buffer | Uint8Array | string,
    options?: { fileName?: string; mediaType?: string; sensitive?: boolean },
  ): Promise<RunResourceHandle> {
    checkKey(key);
    const dir = resourcesDir();
    const index = readIndex();
    if (index.resources.length >= MAX_RESOURCES) {
      throw new Error(`Run resource limit exceeded (max ${MAX_RESOURCES})`);
    }
    let bytes: Buffer;
    let fileName = safeFileName(options?.fileName);
    if (typeof source === 'string') {
      const abs = path.resolve(source);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        throw new Error('Run resource source file is missing');
      }
      try {
        if (fs.lstatSync(abs).isSymbolicLink()) {
          throw new Error('Run resource source must not be a symlink');
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('symlink')) {
          throw e;
        }
      }
      bytes = fs.readFileSync(abs);
      if (!options?.fileName) {
        fileName = safeFileName(path.basename(abs));
      }
    } else {
      bytes = Buffer.isBuffer(source) ? source : Buffer.from(source);
    }
    if (bytes.length > MAX_BYTES) {
      throw new Error(`Run resource exceeds max size (${MAX_BYTES} bytes)`);
    }
    const resourceId = crypto.randomUUID().replace(/-/g, '');
    const storedName = `${resourceId}-${fileName}`;
    const target = resolveInside(dir, path.join(dir, storedName));
    writeBytes(target, bytes);
    const entry: IndexEntry = {
      resourceId,
      key,
      fileName: storedName,
      mediaType: options?.mediaType,
      size: bytes.length,
      sensitive: options?.sensitive === true,
    };
    index.resources = index.resources.filter((r) => r.key !== key);
    index.resources.push(entry);
    writeIndex(index);
    flowContext.set(key, resourceId, options?.sensitive ? { sensitive: true } : undefined);
    return { resourceId, path: target, mediaType: options?.mediaType, size: bytes.length };
  },

  /** Resolve a previously published resource by Flow Context key. */
  async require(key: string): Promise<RunResourceHandle> {
    checkKey(key);
    const resourceId = flowContext.require(key);
    const index = readIndex();
    const entry = index.resources.find((r) => r.key === key && r.resourceId === resourceId);
    if (!entry) {
      throw new Error(
        `Run resource "${key}" was not published earlier in the same CoTester run (or belongs to another run).`,
      );
    }
    const dir = resourcesDir();
    const filePath = resolveInside(dir, path.join(dir, entry.fileName));
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`Run resource "${key}" file is missing`);
    }
    return {
      resourceId: entry.resourceId,
      path: filePath,
      mediaType: entry.mediaType,
      size: entry.size,
    };
  },
};
