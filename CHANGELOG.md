# Changelog

All notable changes to ShopSync will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-03

### Added

#### Shopify Data Pipeline
- **Orders Sync** — Pull all orders from Shopify with full financial details
- **Products Sync** — Sync product catalog including variants and inventory
- **Customers Sync** — Import customer profiles and contact information
- **Incremental Sync** — Only fetch new/updated records after initial sync
- **Error Handling** — Robust retry logic with detailed error reporting

#### Scheduling Engine
- **Cron-based scheduling** — Automated sync on configurable intervals
- **Schedule presets** — Quick setup: every 30 min, 1 hour, 6 hours, daily
- **Persistent schedules** — Stored in PostgreSQL, survives restarts
- **Manual trigger** — "Sync Now" button for on-demand data refresh

#### Web Dashboard
- **Dashboard** — Overview with data counts and recent sync runs
- **Sync History** — Complete history with status, duration, and entity counts
- **Data Browser** — Explore synced data with sortable, filterable tables
- **Settings** — Configure PostgreSQL and Shopify credentials via UI

#### Analytics
- **Order Trends** — Daily/weekly/monthly order volume charts
- **Revenue Metrics** — Total revenue, average order value tracking
- **Top Products** — Best-selling products by volume and revenue
- **Customer Insights** — New vs returning customer analysis

#### Analytics Pro
- **Cohort Analysis** — Customer retention cohorts
- **Funnel Visualization** — Conversion funnel metrics
- **Revenue Forecasting** — Trend-based revenue projections
- **Advanced Filtering** — Date range, product, and customer filters

#### Security
- **Helmet** — HTTP security headers
- **CORS** — Configurable cross-origin resource sharing
- **Rate Limiting** — API rate limiting (300 req/min)
- **Non-root Container** — Runs as unprivileged user in Docker
- **Kubernetes Security Contexts** — Pod and container security policies

#### Deployment
- **Docker** — Multi-stage build, multi-arch (amd64 + arm64)
- **Docker Compose** — One-command setup with PostgreSQL
- **Helm Chart** — Production-ready Kubernetes deployment
- **Health Checks** — Liveness and readiness probes
- **Database Migration** — Automatic schema initialization

---

[1.0.0]: https://github.com/implyfree/shopsync/releases/tag/v1.0.0
