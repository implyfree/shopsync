import axios from 'axios';
import { config } from './config.js';

const API_VERSION = config.apiVersion || '2025-01';

function getBaseUrl(store) {
  const s = (store || config.shopify.store).replace(/\.myshopify\.com.*/, '');
  return `https://${s}.myshopify.com/admin/api/${API_VERSION}`;
}

function getHeaders(accessToken) {
  const token = accessToken || config.shopify.accessToken;
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': token,
  };
}

export async function testShopifyConnection(store, accessToken) {
  const base = getBaseUrl(store);
  const headers = getHeaders(accessToken);
  try {
    const { data } = await axios.get(`${base}/shop.json`, { headers });
    return { ok: true, shop: data?.shop };
  } catch (err) {
    return { ok: false, error: err.response?.data?.errors || err.message };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Rate-limit aware paginator.
 * Handles Shopify link-header pagination and 429 throttle.
 * @param {Function} onPage  Optional callback(items, pageNum) for progress
 */
async function paginate(base, path, headers, { limit = 250, onPage } = {}) {
  const out = [];
  let url = `${base}${path}${path.includes('?') ? '&' : '?'}limit=${limit}`;
  let page = 0;
  while (url) {
    let res;
    let retries = 0;
    const maxRetries = 3;
    while (true) {
      try {
        res = await axios.get(url, { headers, timeout: 30000 });
        break; // success
      } catch (err) {
        const status = err.response?.status;
        // Handle rate limiting (429)
        if (status === 429) {
          const retryAfter = parseFloat(err.response.headers['retry-after']) || 2;
          await sleep(retryAfter * 1000);
          continue;
        }
        // Retry on 5xx server errors
        if (status >= 500 && retries < maxRetries) {
          retries++;
          const delay = Math.min(2000 * Math.pow(2, retries), 15000);
          console.log(`Shopify ${status} error, retry ${retries}/${maxRetries} in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        throw err;
      }
    }
    const { data } = res;
    const resHeaders = res.headers || {};
    const key = Object.keys(data).find((k) => Array.isArray(data[k]));
    if (key) {
      out.push(...data[key]);
      page++;
      if (onPage) onPage(data[key], page);
    }
    const link = resHeaders.link || resHeaders.Link;
    const nextMatch = link && link.match(/<([^>]+)>;\s*rel="next"/);
    const next = nextMatch ? nextMatch[1].trim() : null;
    url = next || null;
    if (url) await sleep(350);
  }
  return out;
}

/**
 * Fetch orders with optional updated_at_min for incremental sync
 */
export async function fetchOrders(store, accessToken, { updatedAtMin, onPage } = {}) {
  const base = getBaseUrl(store);
  const headers = getHeaders(accessToken);
  let path = '/orders.json?status=any';
  if (updatedAtMin) {
    path += `&updated_at_min=${encodeURIComponent(updatedAtMin)}`;
  }
  return paginate(base, path, headers, { onPage });
}

/**
 * Fetch products with optional updated_at_min for incremental sync
 */
export async function fetchProducts(store, accessToken, { updatedAtMin, onPage } = {}) {
  const base = getBaseUrl(store);
  const headers = getHeaders(accessToken);
  let path = '/products.json';
  if (updatedAtMin) {
    path += `?updated_at_min=${encodeURIComponent(updatedAtMin)}`;
  }
  return paginate(base, path, headers, { onPage });
}

/**
 * Fetch customers with optional updated_at_min for incremental sync
 */
export async function fetchCustomers(store, accessToken, { updatedAtMin, onPage } = {}) {
  const base = getBaseUrl(store);
  const headers = getHeaders(accessToken);
  let path = '/customers.json';
  if (updatedAtMin) {
    path += `?updated_at_min=${encodeURIComponent(updatedAtMin)}`;
  }
  return paginate(base, path, headers, { onPage });
}

/**
 * Fetch custom collections
 */
export async function fetchCustomCollections(store, accessToken, { updatedAtMin, onPage } = {}) {
  const base = getBaseUrl(store);
  const headers = getHeaders(accessToken);
  let path = '/custom_collections.json';
  if (updatedAtMin) {
    path += `?updated_at_min=${encodeURIComponent(updatedAtMin)}`;
  }
  return paginate(base, path, headers, { onPage });
}

/**
 * Fetch smart collections
 */
export async function fetchSmartCollections(store, accessToken, { updatedAtMin, onPage } = {}) {
  const base = getBaseUrl(store);
  const headers = getHeaders(accessToken);
  let path = '/smart_collections.json';
  if (updatedAtMin) {
    path += `?updated_at_min=${encodeURIComponent(updatedAtMin)}`;
  }
  return paginate(base, path, headers, { onPage });
}

/**
 * Fetch inventory levels for all locations
 */
export async function fetchInventoryLevels(store, accessToken, { locationIds, onPage } = {}) {
  const base = getBaseUrl(store);
  const headers = getHeaders(accessToken);
  const all = [];
  // First get all locations
  let locations = locationIds;
  if (!locations || locations.length === 0) {
    try {
      const { data } = await axios.get(`${base}/locations.json`, { headers });
      locations = (data.locations || []).map((l) => l.id);
    } catch {
      return [];
    }
  }
  for (const locId of locations) {
    const items = await paginate(base, `/inventory_levels.json?location_ids=${locId}`, headers, { onPage });
    all.push(...items);
  }
  return all;
}
