import pg from 'pg';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL in .env');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();
  const { rowCount } = await client.query(
    `UPDATE sync_runs SET status = 'failed', finished_at = COALESCE(finished_at, NOW()), error_message = COALESCE(error_message, 'Sync stopped or crashed before finishing') WHERE status = 'running'`
  );
  console.log('Marked', rowCount, 'stuck sync(s) as failed.');
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
