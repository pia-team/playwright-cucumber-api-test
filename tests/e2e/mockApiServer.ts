import * as http from 'http';
import { AddressInfo } from 'net';
import { URL } from 'url';

/** Fixed token returned by POST /auth/token — used by E2E redaction checks via env in harness. */
export const MOCK_SYNTHETIC_ACCESS_TOKEN = 'mock-synthetic-access-token-e2e-001';

export type MockUser = {
  id: string;
  name: string;
  email: string;
};

export type MockApiServer = {
  baseUrl: string;
  port: number;
  close: () => Promise<void>;
};

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function parseJsonBody(raw: string): unknown {
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function bearerToken(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth || !/^Bearer\s+/i.test(auth)) return null;
  return auth.replace(/^Bearer\s+/i, '').trim();
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendText(res: http.ServerResponse, status: number, body: string, contentType: string): void {
  res.writeHead(status, { 'content-type': contentType });
  res.end(body);
}

function matchUserId(pathname: string): string | null {
  const m = /^\/users\/([^/]+)$/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * In-process HTTP mock for OpenAPI-style generic HTTP Cucumber E2E (no AI).
 */
export async function startMockApiServer(options?: {
  host?: string;
  port?: number;
}): Promise<MockApiServer> {
  const host = options?.host ?? '127.0.0.1';
  const users = new Map<string, MockUser>([
    ['1', { id: '1', name: 'Demo User', email: 'demo@example.com' }],
  ]);
  let nextId = 2;

  const server = http.createServer(async (req, res) => {
    try {
      const method = (req.method || 'GET').toUpperCase();
      const url = new URL(req.url || '/', `http://${host}`);
      const pathname = url.pathname;

      if (method === 'GET' && pathname === '/users') {
        sendJson(res, 200, { users: Array.from(users.values()) });
        return;
      }

      if (method === 'GET' && pathname === '/protected') {
        const token = bearerToken(req);
        if (!token) {
          sendJson(res, 401, { error: 'missing_bearer' });
          return;
        }
        if (token !== MOCK_SYNTHETIC_ACCESS_TOKEN) {
          sendJson(res, 403, { error: 'invalid_token' });
          return;
        }
        sendJson(res, 200, { message: 'authorized', subject: 'e2e-mock' });
        return;
      }

      if (method === 'GET' && pathname === '/invalid-response') {
        sendText(res, 200, 'not-json{{{', 'text/plain');
        return;
      }

      if (method === 'POST' && pathname === '/auth/token') {
        const raw = await readBody(req);
        const ct = String(req.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json') && raw.trim()) {
          parseJsonBody(raw);
        }
        sendJson(res, 200, {
          access_token: MOCK_SYNTHETIC_ACCESS_TOKEN,
          token_type: 'Bearer',
          expires_in: 3600,
        });
        return;
      }

      const userId = matchUserId(pathname);
      if (userId) {
        if (method === 'GET') {
          const user = users.get(userId);
          if (!user) {
            sendJson(res, 404, { error: 'not_found' });
            return;
          }
          sendJson(res, 200, user);
          return;
        }

        if (method === 'DELETE') {
          if (!users.has(userId)) {
            sendJson(res, 404, { error: 'not_found' });
            return;
          }
          users.delete(userId);
          res.writeHead(204);
          res.end();
          return;
        }

        if (method === 'PUT' || method === 'PATCH') {
          const raw = await readBody(req);
          let body: Record<string, unknown>;
          try {
            body = (parseJsonBody(raw) as Record<string, unknown>) || {};
          } catch {
            sendJson(res, 400, { error: 'invalid_json' });
            return;
          }
          const existing = users.get(userId);
          if (!existing) {
            sendJson(res, 404, { error: 'not_found' });
            return;
          }
          const updated: MockUser = {
            id: userId,
            name: typeof body.name === 'string' ? body.name : existing.name,
            email: typeof body.email === 'string' ? body.email : existing.email,
          };
          users.set(userId, updated);
          sendJson(res, 200, updated);
          return;
        }
      }

      if (method === 'POST' && pathname === '/users') {
        const raw = await readBody(req);
        let body: Record<string, unknown>;
        try {
          body = (parseJsonBody(raw) as Record<string, unknown>) || {};
        } catch {
          sendJson(res, 400, { error: 'invalid_json' });
          return;
        }
        if (typeof body.name !== 'string' || typeof body.email !== 'string') {
          sendJson(res, 400, { error: 'name_and_email_required' });
          return;
        }
        const id = String(nextId++);
        const user: MockUser = { id, name: body.name, email: body.email };
        users.set(id, user);
        sendJson(res, 201, user);
        return;
      }

      sendJson(res, 404, { error: 'not_found', path: pathname, method });
    } catch {
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'internal_error' });
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options?.port ?? 0, host, () => resolve());
  });

  const addr = server.address() as AddressInfo;
  const port = addr.port;
  const baseUrl = `http://${host}:${port}`;

  return {
    baseUrl,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
