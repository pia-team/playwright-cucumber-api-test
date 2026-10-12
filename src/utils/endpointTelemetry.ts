/**
 * Safe target-API endpoint telemetry for CoTester analytics (AA-3).
 * Writes aggregates to disk; never throws into the test flow.
 * Does not store full URL, query values, headers, bodies, or tokens.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Legacy shared path (pre job-scoped isolation). Prefer {@link telemetryRelativePath}. */
export const TELEMETRY_RELATIVE_PATH = 'reports/api-endpoint-telemetry.json';
export const TELEMETRY_VERSION = 1;

const JOB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Job-scoped file avoids concurrent API runs clobbering each other on a shared project cwd. */
export function telemetryRelativePath(jobId?: string | null): string {
  const id = typeof jobId === 'string' ? jobId.trim() : '';
  if (id && JOB_ID_RE.test(id)) {
    return `reports/api-endpoint-telemetry-${id}.json`;
  }
  return TELEMETRY_RELATIVE_PATH;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_RE = /^\d{1,18}$/;
const LONG_HEX_RE = /^[0-9a-f]{16,64}$/i;
const MAX_TEMPLATE_LEN = 200;

export type StatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'none';

export type EndpointAggregate = {
  method: string;
  pathTemplate: string;
  hitCount: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  transportErrors: number;
  scenarioPassedHits: number;
  scenarioFailedHits: number;
  firstObservedAt: string;
  lastObservedAt: string;
};

type PendingHit = {
  method: string;
  pathTemplate: string;
  statusClass: StatusClass;
  transportError: boolean;
  observedAt: string;
};

type TelemetryFile = {
  version: number;
  jobId: string | null;
  generatedAt: string;
  endpoints: EndpointAggregate[];
};

const pendingScenarioHits: PendingHit[] = [];
const processAggregates = new Map<string, EndpointAggregate>();

function keyOf(method: string, pathTemplate: string): string {
  return `${method} ${pathTemplate}`;
}

/** Strip query/fragment/host; normalize dynamic segments to {id}. */
export function normalizeEndpointPath(rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null;
  let p = rawPath.trim();
  if (!p) return null;

  try {
    if (p.includes('://')) {
      const u = new URL(p);
      p = u.pathname || '/';
    }
  } catch {
    // keep as path-like
  }

  const q = p.indexOf('?');
  if (q >= 0) p = p.substring(0, q);
  const hash = p.indexOf('#');
  if (hash >= 0) p = p.substring(0, hash);

  if (p.includes('..') || p.includes('\\') || p.includes('@') || p.includes('%')) {
    return null;
  }
  if (!p.startsWith('/')) {
    p = `/${p}`;
  }
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  if (p === '/') return '/';

  const parts = p.substring(1).split('/').filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (UUID_RE.test(part) || NUMERIC_RE.test(part) || LONG_HEX_RE.test(part)) {
      out.push('{id}');
      continue;
    }
    // Opaque dynamic tokens (project keys, slugs) → {id}; keep short safe literals.
    if (/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(part) && part.length <= 48) {
      // Prefer keeping REST vocabulary segments; treat long mixed tokens as ids.
      if (/^[a-z][a-z0-9-]{0,40}$/.test(part)) {
        out.push(part.toLowerCase());
      } else {
        out.push('{id}');
      }
      continue;
    }
    out.push('{id}');
  }
  const template = `/${out.join('/')}`;
  if (template.length > MAX_TEMPLATE_LEN) return null;
  return template;
}

export function statusClassOf(status?: number | null): StatusClass {
  if (status == null || !Number.isFinite(status)) return 'none';
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'none';
}

function bumpAggregate(
  method: string,
  pathTemplate: string,
  statusClass: StatusClass,
  transportError: boolean,
  observedAt: string,
  scenarioOutcome?: 'passed' | 'failed' | 'skipped',
): void {
  const key = keyOf(method, pathTemplate);
  let agg = processAggregates.get(key);
  if (!agg) {
    agg = {
      method,
      pathTemplate,
      hitCount: 0,
      status2xx: 0,
      status3xx: 0,
      status4xx: 0,
      status5xx: 0,
      transportErrors: 0,
      scenarioPassedHits: 0,
      scenarioFailedHits: 0,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
    };
    processAggregates.set(key, agg);
  }
  agg.hitCount += 1;
  agg.lastObservedAt = observedAt;
  if (transportError) agg.transportErrors += 1;
  if (statusClass === '2xx') agg.status2xx += 1;
  else if (statusClass === '3xx') agg.status3xx += 1;
  else if (statusClass === '4xx') agg.status4xx += 1;
  else if (statusClass === '5xx') agg.status5xx += 1;
  if (scenarioOutcome === 'passed') agg.scenarioPassedHits += 1;
  if (scenarioOutcome === 'failed') agg.scenarioFailedHits += 1;
}

/**
 * Record one completed HTTP attempt. Safe to call from steps; never throws.
 */
export function recordEndpointHit(input: {
  method: string;
  path: string;
  status?: number | null;
  transportError?: boolean;
}): void {
  try {
    const method = (input.method || 'GET').toUpperCase();
    if (!/^[A-Z]{3,7}$/.test(method)) return;
    const pathTemplate = normalizeEndpointPath(input.path);
    if (!pathTemplate) return;
    const observedAt = new Date().toISOString();
    const statusClass = input.transportError ? 'none' : statusClassOf(input.status);
    pendingScenarioHits.push({
      method,
      pathTemplate,
      statusClass,
      transportError: Boolean(input.transportError),
      observedAt,
    });
  } catch {
    // never break tests
  }
}

/** Apply scenario outcome to hits recorded in this scenario, then fold into process aggregates. */
export function finalizeScenarioHits(outcome: 'passed' | 'failed' | 'skipped'): void {
  try {
    while (pendingScenarioHits.length) {
      const hit = pendingScenarioHits.shift()!;
      bumpAggregate(
        hit.method,
        hit.pathTemplate,
        hit.statusClass,
        hit.transportError,
        hit.observedAt,
        outcome === 'skipped' ? undefined : outcome,
      );
    }
  } catch {
    pendingScenarioHits.length = 0;
  }
}

function mergeAggregates(into: Map<string, EndpointAggregate>, rows: EndpointAggregate[]): void {
  for (const row of rows) {
    if (!row?.method || !row?.pathTemplate) continue;
    const key = keyOf(row.method, row.pathTemplate);
    const existing = into.get(key);
    if (!existing) {
      into.set(key, { ...row });
      continue;
    }
    existing.hitCount += row.hitCount || 0;
    existing.status2xx += row.status2xx || 0;
    existing.status3xx += row.status3xx || 0;
    existing.status4xx += row.status4xx || 0;
    existing.status5xx += row.status5xx || 0;
    existing.transportErrors += row.transportErrors || 0;
    existing.scenarioPassedHits += row.scenarioPassedHits || 0;
    existing.scenarioFailedHits += row.scenarioFailedHits || 0;
    if (row.firstObservedAt && row.firstObservedAt < existing.firstObservedAt) {
      existing.firstObservedAt = row.firstObservedAt;
    }
    if (row.lastObservedAt && row.lastObservedAt > existing.lastObservedAt) {
      existing.lastObservedAt = row.lastObservedAt;
    }
  }
}

/** Flush process aggregates into job-scoped telemetry file (merge for suite features). */
export function flushEndpointTelemetry(cwd: string = process.cwd()): void {
  try {
    // Fold any leftover pending hits as skipped-outcome (counts hits, not scenario pass/fail).
    finalizeScenarioHits('skipped');
    if (processAggregates.size === 0) return;

    const jobId = process.env.COTESTER_RUN_JOB_ID?.trim() || null;
    const filePath = path.join(cwd, telemetryRelativePath(jobId));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const merged = new Map<string, EndpointAggregate>();
    if (fs.existsSync(filePath)) {
      try {
        const prev = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TelemetryFile;
        // Only merge prior file when it belongs to this job (or both lack jobId).
        const prevJob = prev?.jobId?.trim() || null;
        if (!prevJob || !jobId || prevJob === jobId) {
          if (prev?.endpoints && Array.isArray(prev.endpoints)) {
            mergeAggregates(merged, prev.endpoints);
          }
        }
      } catch {
        // corrupt prior file — replace with this process
      }
    }
    mergeAggregates(merged, [...processAggregates.values()]);

    const payload: TelemetryFile = {
      version: TELEMETRY_VERSION,
      jobId,
      generatedAt: new Date().toISOString(),
      endpoints: [...merged.values()].sort((a, b) =>
        keyOf(a.method, a.pathTemplate).localeCompare(keyOf(b.method, b.pathTemplate)),
      ),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    processAggregates.clear();
  } catch {
    // never break AfterAll
  }
}

/** Test helpers */
export function _resetEndpointTelemetryForTests(): void {
  pendingScenarioHits.length = 0;
  processAggregates.clear();
}

export function _snapshotProcessAggregatesForTests(): EndpointAggregate[] {
  return [...processAggregates.values()];
}
