# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ Yes    |
| < 1.0   | ❌ No     |

## Reporting a Vulnerability

If you discover a security vulnerability in ShopSync, please report it responsibly.

**⚠️ Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **Email:** Send details to **shyam21091996@gmail.com**
2. **Subject:** `[SECURITY] ShopSync - Brief description`
3. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

| Action | Timeline |
|--------|----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Fix release | Within 2 weeks (critical) |

### What Happens Next

1. We will acknowledge your report within 48 hours
2. We will investigate and assess the severity
3. We will develop and test a fix
4. We will release a patch and credit you (unless you prefer anonymity)

## Security Best Practices

When deploying ShopSync:

- [ ] Use strong, unique PostgreSQL passwords
- [ ] Keep Docker images updated to latest version
- [ ] Enable TLS/HTTPS via Ingress in Kubernetes
- [ ] Set `NODE_ENV=production` in production
- [ ] Use Kubernetes secrets for sensitive configuration
- [ ] Restrict network access to PostgreSQL port
- [ ] Regularly rotate Shopify API tokens
- [ ] Enable Kubernetes RBAC and network policies

## Security Features

ShopSync includes these security measures:

- **Helmet.js** — HTTP security headers
- **CORS** — Configurable cross-origin policy
- **Rate Limiting** — 300 requests/minute per IP
- **Non-root Container** — Runs as UID 1000
- **Read-only Shopify** — Only reads data, never writes to Shopify
- **Pod Security Context** — `runAsNonRoot`, dropped capabilities
- **No privilege escalation** — Explicitly disabled
