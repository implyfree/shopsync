import cron from 'node-cron';
import { getPool, query } from './db.js';
import { config } from './config.js';
import { runSync } from './sync.js';

let scheduledTask = null;

export async function startCronFromDb() {
  if (!config.databaseUrl) return;
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT schedule FROM cron_jobs WHERE name = 'shopify_sync' AND enabled = true LIMIT 1"
    );
    if (rows.length === 0) return;
    const schedule = rows[0].schedule;
    if (!cron.validate(schedule)) {
      console.warn('Invalid cron schedule in DB:', schedule);
      return;
    }
    if (scheduledTask) scheduledTask.stop();
    scheduledTask = cron.schedule(schedule, async () => {
      try {
        await runSync();
        await pool.query(
          "UPDATE cron_jobs SET last_run_at = NOW() WHERE name = 'shopify_sync'"
        );
      } catch (e) {
        console.error('Cron sync failed:', e.message);
      }
    });
    console.log('Cron started with schedule:', schedule);
  } catch (e) {
    console.warn('Could not start cron from DB:', e.message);
  }
}

export function stopCron() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

export async function updateCronSchedule(schedule) {
  if (!cron.validate(schedule)) throw new Error('Invalid cron expression');
  const pool = getPool();
  await pool.query(
    "UPDATE cron_jobs SET schedule = $1, updated_at = NOW() WHERE name = 'shopify_sync'",
    [schedule]
  );
  stopCron();
  await startCronFromDb();
}

export async function setCronEnabled(enabled) {
  const pool = getPool();
  await pool.query(
    'UPDATE cron_jobs SET enabled = $1, updated_at = NOW() WHERE name = $2',
    [enabled, 'shopify_sync']
  );
  stopCron();
  if (enabled) await startCronFromDb();
}

export async function getCronConfig() {
  if (!config.databaseUrl) return null;
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT schedule, enabled, last_run_at FROM cron_jobs WHERE name = 'shopify_sync' LIMIT 1"
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}
