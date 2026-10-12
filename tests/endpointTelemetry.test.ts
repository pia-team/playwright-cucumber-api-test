import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  normalizeEndpointPath,
  statusClassOf,
  recordEndpointHit,
  finalizeScenarioHits,
  flushEndpointTelemetry,
  _resetEndpointTelemetryForTests,
  _snapshotProcessAggregatesForTests,
  TELEMETRY_RELATIVE_PATH,
  telemetryRelativePath,
} from '../src/utils/endpointTelemetry';

describe('endpointTelemetry normalization', () => {
  it('normalizes UUID and numeric path segments', () => {
    assert.equal(
      normalizeEndpointPath('/customers/550e8400-e29b-41d4-a716-446655440000/orders/42'),
      '/customers/{id}/orders/{id}',
    );
  });

  it('strips query values and host (no secrets stored in template)', () => {
    const t = normalizeEndpointPath(
      'https://api.example.com/v1/items/99?access_token=secret&api_key=abc',
    );
    assert.equal(t, '/v1/items/{id}');
    assert.ok(t && !t.includes('secret'));
    assert.ok(t && !t.includes('api_key'));
    assert.ok(t && !t.includes('example.com'));
  });

  it('groups different ids under the same template', () => {
    const a = normalizeEndpointPath('/users/1');
    const b = normalizeEndpointPath('/users/999');
    assert.equal(a, b);
    assert.equal(a, '/users/{id}');
  });

  it('maps status to class without treating 4xx as special failure', () => {
    assert.equal(statusClassOf(200), '2xx');
    assert.equal(statusClassOf(404), '4xx');
    assert.equal(statusClassOf(500), '5xx');
    assert.equal(statusClassOf(null), 'none');
  });
});

describe('endpointTelemetry aggregates', () => {
  beforeEach(() => {
    _resetEndpointTelemetryForTests();
  });

  it('records GET and POST hits with multi-call hit counts', () => {
    recordEndpointHit({ method: 'GET', path: '/catalog/items/1', status: 200 });
    recordEndpointHit({ method: 'GET', path: '/catalog/items/2', status: 200 });
    recordEndpointHit({ method: 'POST', path: '/catalog/items', status: 201 });
    finalizeScenarioHits('passed');

    const rows = _snapshotProcessAggregatesForTests();
    const get = rows.find((r) => r.method === 'GET');
    const post = rows.find((r) => r.method === 'POST');
    assert.ok(get);
    assert.ok(post);
    assert.equal(get!.pathTemplate, '/catalog/items/{id}');
    assert.equal(get!.hitCount, 2);
    assert.equal(get!.status2xx, 2);
    assert.equal(get!.scenarioPassedHits, 2);
    assert.equal(post!.pathTemplate, '/catalog/items');
    assert.equal(post!.hitCount, 1);
  });

  it('tracks transport errors separately from HTTP status', () => {
    recordEndpointHit({
      method: 'GET',
      path: '/health',
      status: null,
      transportError: true,
    });
    finalizeScenarioHits('failed');
    const rows = _snapshotProcessAggregatesForTests();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].transportErrors, 1);
    assert.equal(rows[0].status4xx, 0);
    assert.equal(rows[0].scenarioFailedHits, 1);
  });

  it('does not mark expected 4xx as transport error; scenario outcome stays independent', () => {
    recordEndpointHit({ method: 'GET', path: '/missing', status: 404 });
    finalizeScenarioHits('passed');
    const row = _snapshotProcessAggregatesForTests()[0];
    assert.equal(row.status4xx, 1);
    assert.equal(row.transportErrors, 0);
    assert.equal(row.scenarioPassedHits, 1);
    assert.equal(row.scenarioFailedHits, 0);
  });

  it('flush merges and never throws on disk write', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aa3-tel-'));
    process.env.COTESTER_RUN_JOB_ID = '11111111-1111-1111-1111-111111111111';
    recordEndpointHit({ method: 'GET', path: '/a/1', status: 200 });
    finalizeScenarioHits('passed');
    flushEndpointTelemetry(cwd);
    const file = path.join(cwd, telemetryRelativePath(process.env.COTESTER_RUN_JOB_ID));
    assert.ok(fs.existsSync(file));
    assert.notEqual(file, path.join(cwd, TELEMETRY_RELATIVE_PATH));
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(payload.version, 1);
    assert.equal(payload.jobId, process.env.COTESTER_RUN_JOB_ID);
    assert.equal(payload.endpoints[0].hitCount, 1);

    // Second flush with more hits merges (suite feature pattern)
    recordEndpointHit({ method: 'GET', path: '/a/2', status: 200 });
    finalizeScenarioHits('passed');
    flushEndpointTelemetry(cwd);
    const again = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(again.endpoints[0].hitCount, 2);
  });

  it('isolates concurrent jobs via job-scoped telemetry paths', () => {
    const a = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const b = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    assert.notEqual(telemetryRelativePath(a), telemetryRelativePath(b));
    assert.match(telemetryRelativePath(a), /api-endpoint-telemetry-aaaaaaaa/);
  });
});
