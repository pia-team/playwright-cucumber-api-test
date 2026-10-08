import * as fs from 'fs';
import * as path from 'path';

/**
 * Run-scoped CoTester Flow context (COTESTER_FLOW_CONTEXT_PATH): scalar values handed from one Flow step to the
 * next. The file is created per Flow run by the backend and deleted after it. Sensitive values are listed in
 * `_meta.sensitive`; they are never preloaded into scenario variables and never appear in error messages.
 * The same module is shipped to the UI runner (support/flowContext.ts) and the API runner (src/utils/flowContext.ts).
 */
export type FlowScalar = string | number | boolean;

const META = '_meta';
const KEY = /^[^\r\n]{1,200}$/;

type ContextFile = Record<string, unknown> & { _meta?: { sensitive?: string[] } };

function contextPath(): string {
  const p = process.env.COTESTER_FLOW_CONTEXT_PATH;
  if (!p) {
    throw new Error(
      'Flow context is not available (COTESTER_FLOW_CONTEXT_PATH is not set). This step must run inside a CoTester Flow.',
    );
  }
  return p;
}

function checkKey(key: string): void {
  if (typeof key !== 'string' || !KEY.test(key) || key === META) {
    throw new Error('Flow context key is invalid');
  }
}

function readFile(p: string): ContextFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8') || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ContextFile) : {};
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {};
    }
    throw new Error('Flow context could not be read');
  }
}

function writeFile(p: string, data: ContextFile): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, p);
  try {
    fs.chmodSync(p, 0o600);
  } catch {
    // permissions are best effort on file systems without POSIX modes
  }
}

function sensitiveOf(data: ContextFile): Set<string> {
  const list = data[META]?.sensitive;
  return new Set(Array.isArray(list) ? list.filter((k) => typeof k === 'string') : []);
}

function valueOf(data: ContextFile, key: string): string | undefined {
  const v = data[key];
  return v === undefined || v === null ? undefined : String(v);
}

export const flowContext = {
  /** Stores a scalar for later Flow steps; mark tokens, passwords, cookies and similar values sensitive. */
  set(key: string, value: FlowScalar, options?: { sensitive?: boolean }): void {
    checkKey(key);
    if (value === undefined || value === null || typeof value === 'object' || typeof value === 'function') {
      throw new Error(`Flow context value for "${key}" must be a string, number or boolean`);
    }
    const p = contextPath();
    const data = readFile(p);
    data[key] = String(value);
    const sensitive = sensitiveOf(data);
    if (options?.sensitive) {
      sensitive.add(key);
    }
    if (sensitive.size > 0) {
      data[META] = { ...(data[META] ?? {}), sensitive: [...sensitive].sort() };
    }
    writeFile(p, data);
  },

  /** Value written by an earlier Flow step; fails when it is missing (the producing step must run first). */
  require(key: string): string {
    checkKey(key);
    const value = valueOf(readFile(contextPath()), key);
    if (value === undefined || value === '') {
      throw new Error(
        `Flow context does not contain "${key}". The step that produces it must run earlier in the same CoTester Flow.`,
      );
    }
    return value;
  },

  get(key: string): string | undefined {
    checkKey(key);
    return valueOf(readFile(contextPath()), key);
  },

  has(key: string): boolean {
    checkKey(key);
    const value = valueOf(readFile(contextPath()), key);
    return value !== undefined && value !== '';
  },

  isSensitive(key: string): boolean {
    return sensitiveOf(readFile(contextPath())).has(key);
  },
};

/**
 * Non-sensitive values of the current Flow run (empty outside a Flow): what may be preloaded into scenario
 * variables. Sensitive values stay only in the run-scoped file and are read explicitly with `flowContext.require`.
 */
export function publicFlowValues(): Record<string, string> {
  const p = process.env.COTESTER_FLOW_CONTEXT_PATH;
  if (!p) {
    return {};
  }
  const data = readFile(p);
  const sensitive = sensitiveOf(data);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== META && !sensitive.has(key) && value !== undefined && value !== null && typeof value !== 'object') {
      out[key] = String(value);
    }
  }
  return out;
}
