import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { runSchema } from '../schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL in .env or use the UI Settings to initialize the database.');
  process.exit(1);
}

runSchema(connectionString)
  .then(() => {
    console.log('Database schema initialized.');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
