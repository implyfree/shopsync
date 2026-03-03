import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { config } from './config.js';
import routes from './routes.js';
import { startCronFromDb } from './cronManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err?.message || err);
});

const app = express();

app.use(helmet({
  contentSecurityPolicy: isProd ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors(isProd ? {
  origin: process.env.CORS_ORIGIN || false,
  credentials: true,
} : undefined));

app.use(express.json({ limit: '1mb' }));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use(routes);

const clientDir = join(__dirname, '../client/dist');
if (existsSync(clientDir)) {
  app.use(express.static(clientDir, { maxAge: isProd ? '1d' : 0 }));
}

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexFile = join(clientDir, 'index.html');
  if (existsSync(indexFile)) {
    res.sendFile(indexFile, (err) => { if (err) res.status(404).send('Not found'); });
  } else {
    res.type('html').send(`
      <!DOCTYPE html><html><head><title>ShopSync</title></head><body>
        <h1>ShopSync API</h1>
        <p>API is running. Build the UI with <code>npm run build</code> then restart.</p>
        <p><a href="/api/health">/api/health</a></p>
      </body></html>
    `);
  }
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error(`[${status}]`, err.message);
  res.status(status).json({ error: isProd ? 'Internal server error' : err.message });
});

const port = config.port;
app.listen(port, '0.0.0.0', async () => {
  console.log(`ShopSync running at http://localhost:${port}`);
  try {
    await startCronFromDb();
  } catch (e) {
    console.warn('Cron not started (DB may not be configured):', e.message);
  }
});
