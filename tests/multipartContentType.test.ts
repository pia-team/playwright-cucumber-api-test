import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { AddressInfo } from 'node:net';
import { ApiContext } from '../src/core/api/apiContext';
import { ApiClient } from '../src/core/api/apiClient';
import { postMultipartFile, postMultipartFiles } from '../src/utils/multipartUpload';

type Captured = {
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
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      last = {
        contentType: String(req.headers['content-type'] || ''),
        rawBody: Buffer.concat(chunks),
      };
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
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

describe('multipart Content-Type is not application/json', () => {
  let workDir: string;
  let filePath: string;
  let fileBytes: Buffer;
  let capture: Awaited<ReturnType<typeof startCaptureServer>>;
  let previousBaseUrl: string | undefined;

  before(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotester-multipart-ct-'));
    fileBytes = Buffer.from('%PDF-1.4\nboundary-probe-\x00\x01\xff', 'binary');
    filePath = path.join(workDir, 'invoice.pdf');
    fs.writeFileSync(filePath, fileBytes);
    capture = await startCaptureServer();
    previousBaseUrl = process.env.COTESTER_API_BASE_URL;
    process.env.COTESTER_API_BASE_URL = capture.baseUrl;
  });

  after(async () => {
    await capture.close();
    if (previousBaseUrl === undefined) delete process.env.COTESTER_API_BASE_URL;
    else process.env.COTESTER_API_BASE_URL = previousBaseUrl;
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('omitContentType sends multipart/form-data with the file bytes', async () => {
    const ctx = await ApiContext.create(
      { 'Content-Type': 'application/json', 'X-Trace': 'multipart' },
      { omitContentType: true },
    );
    try {
      const client = new ApiClient(ctx);
      const res = await postMultipartFile(client, '/upload', 'file', filePath);
      assert.equal(res.status(), 201);
      const hit = capture.last();
      assert.ok(hit);
      assert.match(hit!.contentType, /^multipart\/form-data;\s*boundary=/i);
      assert.ok(hit!.rawBody.includes(fileBytes));
    } finally {
      await ctx.dispose();
    }
  });

  it('postMultipartFiles FormData uses the same boundary content type', async () => {
    const second = path.join(workDir, 'note.txt');
    const secondBytes = Buffer.from('second-part', 'utf8');
    fs.writeFileSync(second, secondBytes);
    const ctx = await ApiContext.create(undefined, { omitContentType: true });
    try {
      const client = new ApiClient(ctx);
      const res = await postMultipartFiles(client, '/upload', 'file', [filePath, second]);
      assert.equal(res.status(), 201);
      const hit = capture.last();
      assert.ok(hit);
      assert.match(hit!.contentType, /^multipart\/form-data;\s*boundary=/i);
      assert.ok(hit!.rawBody.includes(fileBytes));
      assert.ok(hit!.rawBody.includes(secondBytes));
    } finally {
      await ctx.dispose();
    }
  });

  it('JSON POST still uses application/json', async () => {
    const ctx = await ApiContext.create();
    try {
      const client = new ApiClient(ctx);
      const res = await client.post('/items', '{"ok":true}');
      assert.equal(res.status(), 201);
      const hit = capture.last();
      assert.ok(hit);
      assert.match(hit!.contentType, /^application\/json\b/i);
      assert.equal(hit!.rawBody.toString('utf8'), '{"ok":true}');
    } finally {
      await ctx.dispose();
    }
  });
});
