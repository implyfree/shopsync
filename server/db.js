import pg from 'pg';
import { getSettings } from './settings.js';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    const { databaseUrl } = getSettings();
    const url = databaseUrl || process.env.DATABASE_URL;
    if (!url) throw new Error('Database URL not configured. Set it in Settings or DATABASE_URL env.');
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export function resetPool() {
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
  }
}

export async function query(sql, params = []) {
  const p = getPool();
  return p.query(sql, params);
}

export async function getPoolForUrl(connectionString) {
  return new Pool({ connectionString });
}

export async function testConnection(connectionString) {
  const p = new Pool({ connectionString });
  try {
    await p.query('SELECT 1');
    return true;
  } finally {
    await p.end();
  }
}
