# ShopSync

**Enterprise Shopify-to-PostgreSQL data pipeline** with real-time sync, automated scheduling, and powerful analytics.

ShopSync connects your Shopify store to a PostgreSQL database, enabling advanced analytics with tools like Power BI, Grafana, or any SQL-based reporting tool. It provides a beautiful web UI for managing syncs, viewing data, and monitoring pipeline health.

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/shopsync)](https://artifacthub.io/packages/search?repo=shopsync)
[![Docker Image](https://img.shields.io/docker/v/shyamkrishna21/shopsync?sort=semver&label=Docker%20Hub)](https://hub.docker.com/r/shyamkrishna21/shopsync)
[![Docker Pulls](https://img.shields.io/docker/pulls/shyamkrishna21/shopsync)](https://hub.docker.com/r/shyamkrishna21/shopsync)
[![GitHub Release](https://img.shields.io/github/v/release/implyfree/shopsync?label=Release)](https://github.com/implyfree/shopsync/releases/latest)
[![Helm Chart](https://img.shields.io/badge/Helm-v1.0.0-blue?logo=helm)](./helm/shopsync)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Docs-GitHub%20Pages-blue?logo=github)](https://implyfree.github.io/shopsync)

---

## Features

- **Real-Time Sync** — Pull orders, products, and customers from Shopify into PostgreSQL
- **Automated Scheduling** — Cron-based sync with presets (30 min, 1 hour, 6 hours, daily)
- **Analytics Dashboard** — Built-in charts and metrics for order trends, revenue, and product performance
- **Advanced Analytics Pro** — Deep-dive analytics with cohort analysis, funnel visualization, and forecasting
- **Data Browser** — Explore synced data with sortable, filterable tables
- **Settings UI** — Configure PostgreSQL and Shopify credentials from the browser
- **Health Monitoring** — Built-in health check endpoint (`/api/health`)
- **Power BI Ready** — Connect Power BI directly to your PostgreSQL tables
- **Security** — Helmet, CORS, rate limiting, non-root Docker container

## Architecture

```
┌──────────────┐      REST API       ┌──────────────┐       Shopify API      ┌──────────────┐
│              │ ◄─────────────────► │              │ ◄───────────────────►  │              │
│   Browser    │                     │   ShopSync   │                        │   Shopify    │
│   (React)    │                     │   (Node.js)  │                        │   Store      │
│              │                     │              │                        │              │
└──────────────┘                     └──────┬───────┘                        └──────────────┘
                                            │
                                            │  pg driver
                                            ▼
                                    ┌──────────────┐
                                    │  PostgreSQL   │
                                    │   Database    │
                                    └──────────────┘
                                            │
                                   ┌────────┴────────┐
                                   │                  │
                              ┌────▼────┐      ┌─────▼─────┐
                              │Power BI │      │ Grafana / │
                              │         │      │ Any SQL   │
                              └─────────┘      └───────────┘
```

## Quick Start

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- A **Shopify** store with Admin API access

### 1. Install Dependencies

```bash
npm install
cd client && npm install && cd ..
```

### 2. Create PostgreSQL Database

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/shopify_sync"
npm run init-db
```

### 3. Start the Application

```bash
# Production
npm run build    # Build the React UI
npm start        # Runs on http://localhost:3000

# Development (hot reload)
npm run dev                          # Backend with --watch
cd client && npm run dev             # Vite dev server (proxies /api to backend)
```

### 4. Configure via Settings UI

Open **Settings** in the browser and set:

| Setting | Example |
|---------|---------|
| **PostgreSQL URL** | `postgresql://user:password@host:5432/dbname` |
| **Shopify Store** | `my-store.myshopify.com` |
| **Shopify Token** | `shpat_xxxxxxxxxxxx` |

> **Note:** If your PostgreSQL password contains special characters (`# $ , + \ < >` etc.), URL-encode them in the connection string (e.g. `#` → `%23`).

## Shopify API Setup

1. In Shopify Admin, go to **Settings → Apps and sales channels → Develop apps**
2. Create a **Custom app** with these Admin API scopes:
   - `read_orders`
   - `read_products`
   - `read_customers`
   - `read_all_orders` (for orders older than 60 days)
3. Install the app and copy the **Admin API access token** (`shpat_...`)

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes* | — |
| `SHOPIFY_STORE` | Store domain | No* | — |
| `SHOPIFY_ACCESS_TOKEN` | Admin API token | No* | — |
| `PORT` | Server port | No | `3000` |
| `NODE_ENV` | Environment | No | — |
| `CORS_ORIGIN` | Allowed CORS origin | No | — |

*Can be configured via the Settings UI instead of environment variables.

## Docker

### Using Docker Compose (Recommended)

```bash
docker compose up -d
# Open http://localhost:3000
```

This starts PostgreSQL + ShopSync with automatic database migration.

### Manual Docker Run

```bash
# Build the image
docker build -t shopsync:latest .

# Run with external PostgreSQL
docker run -d \
  --name shopsync \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:password@host:5432/dbname \
  -v shopsync-data:/app/data \
  shyamkrishna21/shopsync:latest
```

### Pre-built Images

Multi-architecture images (linux/amd64 + linux/arm64) are available on Docker Hub:

```bash
docker pull shyamkrishna21/shopsync:latest
docker pull shyamkrishna21/shopsync:v1.0.0
```

## Kubernetes (Helm)

### Prerequisites

- Kubernetes 1.23+
- Helm 3.8+

### Quick Install

```bash
cd helm/shopsync

# Install in the shopsync namespace
helm install shopsync . -n shopsync --create-namespace \
  --set env.DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

### Install with Bundled PostgreSQL

```bash
helm install shopsync . -n shopsync --create-namespace \
  --set postgresql.enabled=true \
  --set postgresql.auth.password=secure-password
```

### Install with Ingress

```bash
helm install shopsync . -n shopsync --create-namespace \
  --set env.DATABASE_URL="postgresql://user:password@host:5432/dbname" \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=shopsync.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

### Access the Application

```bash
kubectl -n shopsync port-forward svc/shopsync 3000:80
# Open http://localhost:3000
```

For detailed Helm chart configuration, see [helm/shopsync/README.md](helm/shopsync/README.md).

## UI Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Data counts, "Sync Now" button, recent sync runs |
| **Sync History** | All sync runs with status and entity counts |
| **Schedule** | Cron-based sync scheduling with presets |
| **Data** | Browse synced orders, products, and customers |
| **Analytics** | Charts for order trends, revenue, top products |
| **Analytics Pro** | Advanced analytics with cohort analysis, forecasting |
| **Settings** | PostgreSQL and Shopify credential management |

## Power BI Integration

Connect Power BI to the same PostgreSQL database to build custom reports:

1. Open Power BI → **Get Data** → **PostgreSQL Database**
2. Enter your database host, port, and credentials
3. Select tables:
   - `shopify_orders` — Order data with line items
   - `shopify_products` — Product catalog
   - `shopify_customers` — Customer information
   - `sync_runs` — Sync history metadata

## Database Schema

| Table | Description |
|-------|-------------|
| `shopify_orders` | Orders with financial details |
| `shopify_products` | Product catalog with variants |
| `shopify_customers` | Customer profiles |
| `sync_runs` | Sync execution history |
| `sync_schedule` | Cron schedule configuration |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Chart.js |
| **Backend** | Node.js 18, Express 4 |
| **Database** | PostgreSQL 16 |
| **Containerization** | Docker (multi-stage, non-root) |
| **Orchestration** | Kubernetes, Helm 3 |

## Production Checklist

- [ ] Set a strong `DATABASE_URL` password
- [ ] Configure Shopify credentials via the Settings UI
- [ ] Enable Ingress with TLS/HTTPS
- [ ] Set up PostgreSQL backups
- [ ] Configure resource limits in Helm values
- [ ] Set `NODE_ENV=production`
- [ ] Consider managed PostgreSQL (Cloud SQL, RDS) for HA

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

---

**Made with ❤️ by [Shyam Sunder KS](https://github.com/shyamkrishna21)**