import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = join(__dirname, '../data/settings.json');

const defaults = {
  databaseUrl: '',
  shopify: { store: '', accessToken: '' },
};

function read() {
  try {
    if (existsSync(SETTINGS_PATH)) {
      const raw = readFileSync(SETTINGS_PATH, 'utf8');
      return { ...defaults, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Could not read settings file:', e.message);
  }
  return { ...defaults };
}

export function getSettings() {
  const fromFile = read();
  return {
    databaseUrl: fromFile.databaseUrl || process.env.DATABASE_URL || '',
    shopify: {
      store: fromFile.shopify?.store || process.env.SHOPIFY_STORE || '',
      accessToken: fromFile.shopify?.accessToken || process.env.SHOPIFY_ACCESS_TOKEN || '',
    },
  };
}

export function saveSettings({ databaseUrl, shopify }) {
  const dir = dirname(SETTINGS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const current = read();
  const next = {
    databaseUrl: databaseUrl !== undefined ? databaseUrl : current.databaseUrl,
    shopify: {
      store: shopify?.store !== undefined ? shopify.store : current.shopify?.store,
      accessToken: shopify?.accessToken !== undefined ? shopify.accessToken : current.shopify?.accessToken,
    },
  };
  writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}
