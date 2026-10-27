/**
 * Controlled HTTP fixture: Data Center manifest → testData.getFile / loadRequestBodyBuffer
 * / multipartUpload → Playwright ApiClient → local echo server.
 *
 * Layers covered: runner utils + HTTP wire (not BE compile, not FE panel, not full DC upload API).
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { AddressInfo } from 'node:net';
import { request as playwrightRequest } from '@playwright/test';
import { ApiContext } from '../src/core/api/apiContext';
import { ApiClient } from '../src/core/api/apiClient';
import { postMultipartFile, postMultipartFiles } from '../src/utils/multipartUpload';
import { loadRequestBodyBufferFromBinding } from '../src/utils/requestBodyFile';
import { resetTestDataCache, testData } from '../src/utils/testData';

type Captured = {
  method: string;
  path: string;
  contentType: string;
  rawBody: Buffer;
};

async function startCaptureServer(): Promise<{
  baseUrl: string;
  last: () => Captured | null;
  close: () => Promise<void>;
}> {
  let last: Captured | null = null;
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      last = {
        method: (req.method || 'GET').toUpperCase(),
        path: req.url || '/',
        contentType: String(req.headers['content-type'] || ''),
        rawBody: Buffer.concat(chunks),
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, bytes: last.rawBody.length }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    last: () => last,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

describe('WP3 body-file + multipart HTTP fixture', { concurrency: 1 }, () => {
  let workDir: string;
  let prevManifest: string | undefined;
  let capture: Awaited<ReturnType<typeof startCaptureServer>>;
  let pdfBytes: Buffer;
  let pngBytes: Buffer;
  let jsonBytes: Buffer;
  let txtBytes: Buffer;

  before(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotester-wp3-body-'));
    // Minimal PDF / PNG magic + payload so UTF-8 decode would corrupt if used.
    pdfBytes = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\nbinary-\x00\x01\x02\xff body', 'binary');
    pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0x01,
    ]);
    jsonBytes = Buffer.from('{"hello":"world","n":1}', 'utf8');
    txtBytes = Buffer.from('plain-text-body\n', 'utf8');

    const paths = {
      document: path.join(workDir, 'FORM.pdf'),
      attachment: path.join(workDir, 'shot.png'),
      payload: path.join(workDir, 'payload.json'),
      notes: path.join(workDir, 'notes.txt'),
    };
    fs.writeFileSync(paths.document, pdfBytes);
    fs.writeFileSync(paths.attachment, pngBytes);
    fs.writeFileSync(paths.payload, jsonBytes);
    fs.writeFileSync(paths.notes, txtBytes);

    const manifestPath = path.join(workDir, 'manifest.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        resources: {
          document: { localPath: paths.document, resourceType: 'FILE' },
          attachment: { localPath: paths.attachment, resourceType: 'FILE' },
          payload: { localPath: paths.payload, resourceType: 'FILE' },
          notes: { localPath: paths.notes, resourceType: 'FILE' },
        },
      }),
      'utf8',
    );
    prevManifest = process.env.COTESTER_RUN_DATA_MANIFEST_PATH;
    process.env.COTESTER_RUN_DATA_MANIFEST_PATH = manifestPath;
    resetTestDataCache();
    capture = await startCaptureServer();
    // ApiContext resolves relative paths against COTESTER_API_BASE_URL when set.
    process.env.COTESTER_API_BASE_URL = capture.baseUrl;
  });

  after(async () => {
    await capture.close();
    if (prevManifest === undefined) delete process.env.COTESTER_RUN_DATA_MANIFEST_PATH;
    else process.env.COTESTER_RUN_DATA_MANIFEST_PATH = prevManifest;
    delete process.env.COTESTER_API_BASE_URL;
    resetTestDataCache();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('multipart single file field reaches the server', async () => {
    const filePath = await testData.getFile('document');
    // Mirror genericHttp multipart step: no stale application/json Content-Type
    // (ApiContext defaults would otherwise break multipart boundary).
    const pw = await playwrightRequest.newContext({ baseURL: capture.baseUrl });
    try {
      const client = new ApiClient(pw);
      const res = await postMultipartFile(client, '/upload', 'document', filePath);
      assert.equal(res.status(), 200);
      const hit = capture.last();
      assert.ok(hit);
      assert.match(hit!.contentType, /multipart\/form-data/i);
      assert.ok(hit!.rawBody.includes(Buffer.from('FORM.pdf')));
      // PDF magic should appear inside the multipart body (not UTF-8-mojibake).
      assert.ok(hit!.rawBody.includes(Buffer.from('%PDF-1.4')));
      assert.ok(hit!.rawBody.includes(Buffer.from([0x00, 0x01, 0x02, 0xff])));
    } finally {
      await pw.dispose();
    }
  });

  it('multipart file plus text form field extras (WP6)', async () => {
    const filePath = await testData.getFile('document');
    const pw = await playwrightRequest.newContext({ baseURL: capture.baseUrl });
    try {
      const client = new ApiClient(pw);
      const res = await postMultipartFile(client, '/upload', 'file', filePath, {
        meta: 'demo',
      });
      assert.equal(res.status(), 200);
      const hit = capture.last();
      assert.ok(hit);
      assert.match(hit!.contentType, /multipart\/form-data/i);
      const body = hit!.rawBody.toString('binary');
      assert.ok(body.includes('name="file"'));
      assert.ok(body.includes('name="meta"'));
      assert.ok(body.includes('demo'));
      assert.ok(hit!.rawBody.includes(Buffer.from('%PDF-1.4')));
    } finally {
      await pw.dispose();
    }
  });

  it('multipart binary array: same field name repeated twice (WP5)', async () => {
    const doc = await testData.getFile('document');
    const att = await testData.getFile('attachment');
    const pw = await playwrightRequest.newContext({ baseURL: capture.baseUrl });
    try {
      const client = new ApiClient(pw);
      const res = await postMultipartFiles(client, '/batch-files', 'files', [doc, att]);
      assert.equal(res.status(), 200);
      const hit = capture.last();
      assert.ok(hit);
      assert.match(hit!.contentType, /multipart\/form-data/i);
      const body = hit!.rawBody.toString('binary');
      // Same multipart field name appears twice on the wire
      const fieldHits = body.match(/name="files"/g) || [];
      assert.equal(fieldHits.length, 2, `expected 2 name="files" parts, got ${fieldHits.length}`);
      assert.ok(hit!.rawBody.includes(Buffer.from('%PDF-1.4')));
      assert.ok(hit!.rawBody.includes(Buffer.from([0x89, 0x50, 0x4e, 0x47])));
      assert.ok(hit!.rawBody.includes(Buffer.from('FORM.pdf')));
      assert.ok(hit!.rawBody.includes(Buffer.from('shot.png')));
    } finally {
      await pw.dispose();
    }
  });

  it('multipart single-file regression via postMultipartFiles length-1', async () => {
    const filePath = await testData.getFile('document');
    const pw = await playwrightRequest.newContext({ baseURL: capture.baseUrl });
    try {
      const client = new ApiClient(pw);
      const res = await postMultipartFiles(client, '/upload', 'document', [filePath]);
      assert.equal(res.status(), 200);
      const hit = capture.last();
      assert.ok(hit);
      assert.match(hit!.contentType, /multipart\/form-data/i);
      assert.ok(hit!.rawBody.includes(Buffer.from('%PDF-1.4')));
      const fieldHits = hit!.rawBody.toString('binary').match(/name="document"/g) || [];
      assert.equal(fieldHits.length, 1);
    } finally {
      await pw.dispose();
    }
  });

  it('multipart multiple file fields', async () => {
    const doc = await testData.getFile('document');
    const att = await testData.getFile('attachment');
    const ctx = await playwrightRequest.newContext({ baseURL: capture.baseUrl });
    try {
      const docBuf = await fs.promises.readFile(doc);
      const attBuf = await fs.promises.readFile(att);
      const res = await ctx.post('/upload-multi', {
        multipart: {
          document: { name: 'FORM.pdf', mimeType: 'application/pdf', buffer: docBuf },
          attachment: { name: 'shot.png', mimeType: 'image/png', buffer: attBuf },
        },
      });
      assert.equal(res.status(), 200);
      const hit = capture.last();
      assert.ok(hit);
      assert.match(hit!.contentType, /multipart\/form-data/i);
      assert.ok(hit!.rawBody.includes(Buffer.from('%PDF-1.4')));
      assert.ok(hit!.rawBody.includes(Buffer.from([0x89, 0x50, 0x4e, 0x47])));
      assert.ok(hit!.rawBody.includes(Buffer.from('document')));
      assert.ok(hit!.rawBody.includes(Buffer.from('attachment')));
    } finally {
      await ctx.dispose();
    }
  });

  it('binary PDF body byte equality', async () => {
    const body = await loadRequestBodyBufferFromBinding('document');
    assert.ok(Buffer.isBuffer(body));
    assert.deepEqual(body, pdfBytes);

    const ctx = await ApiContext.create({
      'Content-Type': 'application/pdf',
    });
    const client = new ApiClient(ctx);
    const res = await client.post('/ingest-pdf', body, {
      headers: { 'Content-Type': 'application/pdf' },
    });
    assert.equal(res.status(), 200);
    const hit = capture.last();
    assert.ok(hit);
    assert.match(hit!.contentType, /application\/pdf/i);
    assert.deepEqual(hit!.rawBody, pdfBytes);
  });

  it('binary PNG body byte equality', async () => {
    const body = await loadRequestBodyBufferFromBinding('attachment');
    assert.deepEqual(body, pngBytes);
    const ctx = await ApiContext.create({ 'Content-Type': 'image/png' });
    const client = new ApiClient(ctx);
    const res = await client.post('/ingest-png', body, {
      headers: { 'Content-Type': 'image/png' },
    });
    assert.equal(res.status(), 200);
    assert.deepEqual(capture.last()!.rawBody, pngBytes);
  });

  it('JSON file body preserves UTF-8 text bytes', async () => {
    const body = await loadRequestBodyBufferFromBinding('payload');
    assert.deepEqual(body, jsonBytes);
    assert.equal(body.toString('utf8'), '{"hello":"world","n":1}');
    const ctx = await ApiContext.create({ 'Content-Type': 'application/json' });
    const client = new ApiClient(ctx);
    const res = await client.post('/ingest-json', body, {
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status(), 200);
    assert.deepEqual(capture.last()!.rawBody, jsonBytes);
  });

  it('TXT file body preserves UTF-8 text bytes', async () => {
    const body = await loadRequestBodyBufferFromBinding('notes');
    assert.deepEqual(body, txtBytes);
    const ctx = await ApiContext.create({ 'Content-Type': 'text/plain' });
    const client = new ApiClient(ctx);
    await client.post('/ingest-txt', body, {
      headers: { 'Content-Type': 'text/plain' },
    });
    assert.deepEqual(capture.last()!.rawBody, txtBytes);
  });

  it('inline string body regression (non-file) still sends exact text', async () => {
    const inline = '{"ok":true}';
    const ctx = await ApiContext.create({ 'Content-Type': 'application/json' });
    const client = new ApiClient(ctx);
    await client.post('/inline', inline, {
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(capture.last()!.rawBody.toString('utf8'), inline);
  });

  it('missing binding fails before HTTP', async () => {
    await assert.rejects(
      () => loadRequestBodyBufferFromBinding('does-not-exist'),
      /not available|Data Center file binding/i,
    );
  });

  it('missing materialized file fails when path is gone', async () => {
    const gone = path.join(workDir, 'gone.bin');
    fs.writeFileSync(gone, Buffer.from([1, 2, 3]));
    const manifestPath = path.join(workDir, 'manifest-gone.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ resources: { ghost: { localPath: gone, resourceType: 'FILE' } } }),
      'utf8',
    );
    process.env.COTESTER_RUN_DATA_MANIFEST_PATH = manifestPath;
    resetTestDataCache();
    fs.unlinkSync(gone);
    await assert.rejects(
      () => loadRequestBodyBufferFromBinding('ghost'),
      /ENOENT|no such file|PREFLIGHT|missing on disk/i,
    );
    // restore primary manifest for any later hooks
    process.env.COTESTER_RUN_DATA_MANIFEST_PATH = path.join(workDir, 'manifest.json');
    resetTestDataCache();
  });
});
