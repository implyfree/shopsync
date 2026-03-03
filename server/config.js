import dotenv from 'dotenv';
import { getSettings } from './settings.js';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  get shopify() {
    return getSettings().shopify;
  },
  get databaseUrl() {
    return getSettings().databaseUrl || process.env.DATABASE_URL || '';
  },
  apiVersion: process.env.SHOPIFY_API_VERSION || '2025-01',
};

export function hasShopifyConfig() {
  const s = getSettings();
  return !!(s.shopify.store && s.shopify.accessToken);
}

export function hasDbConfig() {
  const s = getSettings();
  return !!(s.databaseUrl || process.env.DATABASE_URL);
}
