/**
 * Bounded PostgreSQL test-runtime capability (Phase 14). Connection comes from CoTester env injected for the run:
 * COTESTER_DATABASE_URL or COTESTER_DATABASE_HOST/PORT/NAME/USER/PASSWORD. Never hardcode credentials in tests.
 * Requires the optional `pg` package in the runner. Copied to the API runner as utils/database.ts.
 */

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };

function config() {
  const url = process.env.COTESTER_DATABASE_URL;
  if (url && url.trim()) {
    return { connectionString: url.trim(), ssl: process.env.COTESTER_DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined };
  }
  const host = process.env.COTESTER_DATABASE_HOST;
  const database = process.env.COTESTER_DATABASE_NAME;
  const user = process.env.COTESTER_DATABASE_USER;
  const password = process.env.COTESTER_DATABASE_PASSWORD;
  if (!host || !database || !user) {
    throw new Error(
      'Database runtime is not configured. Map database host/name/user (Configuration/Environment) and password (Credentials) before execution.',
    );
  }
  return {
    host,
    port: Number(process.env.COTESTER_DATABASE_PORT || '5432'),
    database,
    user,
    password: password || '',
    ssl: process.env.COTESTER_DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined,
  };
}

async function client() {
  let pg: { Client: new (c: unknown) => { connect(): Promise<void>; query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>; end(): Promise<void> } };
  try {
    // Optional peer dependency — keep migration runnable without forcing every project to install pg.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pg = require('pg');
  } catch {
    throw new Error(
      'Database runtime requires the "pg" package in the runner. Install it for PostgreSQL-backed migrated tests.',
    );
  }
  const c = new pg.Client(config());
  await c.connect();
  return c;
}

export const database = {
  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    if (typeof sql !== 'string' || !sql.trim()) {
      throw new Error('database.query requires a non-empty SQL string');
    }
    const c = await client();
    try {
      const result = await c.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
    } finally {
      await c.end();
    }
  },

  async execute(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    const result = await database.query(sql, params);
    return { rowCount: result.rowCount };
  },
};
