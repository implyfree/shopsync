# Contributing to ShopSync

Thank you for your interest in contributing to ShopSync! We welcome contributions from the community.

## 📋 Rules

1. **Only maintainers** (`shyamkrishna21`) can push directly to the `main` branch.
2. **All other contributors** must fork the repository and submit a Pull Request (PR).
3. PRs require at least **1 approval** before merging.
4. All PRs must pass CI checks before merging.
5. Follow the existing code style and conventions.

## 🚀 Getting Started

### 1. Fork & Clone

```bash
# Fork via GitHub UI, then:
git clone https://github.com/<your-username>/shopsync.git
cd shopsync
```

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

> **Never** work directly on the `main` branch.

### 3. Set Up Development Environment

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Start PostgreSQL (Docker)
docker run -d --name shopsync-db \
  -e POSTGRES_DB=shopsync \
  -e POSTGRES_USER=shopsync \
  -e POSTGRES_PASSWORD=shopsync_secret \
  -p 5432:5432 \
  postgres:16-alpine

# Set environment
export DATABASE_URL="postgresql://shopsync:shopsync_secret@localhost:5432/shopsync"

# Initialize database
npm run init-db

# Start development servers
npm run dev                    # Backend (port 3000)
cd client && npm run dev       # Frontend (port 5173)
```

### 4. Make Your Changes

- Write clean, well-documented code
- Follow existing patterns and conventions
- Add comments for complex logic
- Update documentation if needed

### 5. Test Your Changes

- Ensure the application builds: `npm run build`
- Verify the app runs without errors
- Test both the UI and API endpoints
- Check health endpoint: `curl http://localhost:3000/api/health`

### 6. Commit & Push

```bash
git add .
git commit -m "feat: description of your change"
git push origin feature/your-feature-name
```

#### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Usage |
|--------|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `style:` | Formatting, no code change |
| `refactor:` | Code restructuring |
| `perf:` | Performance improvement |
| `test:` | Adding tests |
| `chore:` | Maintenance tasks |

### 7. Open a Pull Request

1. Go to [ShopSync PRs](https://github.com/implyfree/shopsync/pulls)
2. Click **"New Pull Request"**
3. Select your fork and branch
4. Fill in the PR template
5. Request review from `@shyamkrishna21`

## 📐 Code Style

- **JavaScript**: ES modules (`import`/`export`), no semicolons optional
- **React**: Functional components with hooks
- **CSS**: Vanilla CSS with CSS custom properties
- **Naming**: camelCase for variables/functions, PascalCase for components

## 🐳 Docker Testing

Before submitting, verify your changes work in Docker:

```bash
docker compose up --build -d
# Open http://localhost:3000 and test
docker compose down
```

## 📁 Project Structure

```
shopsync/
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── pages/       # Page components
│   │   ├── App.jsx      # Main app with routing
│   │   └── App.css      # Global styles
│   └── vite.config.js
├── server/              # Node.js backend (Express)
│   ├── index.js         # Server entry point
│   ├── routes.js        # API routes
│   ├── sync.js          # Shopify sync logic
│   ├── schema.js        # PostgreSQL schema
│   ├── db.js            # Database connection
│   ├── cronManager.js   # Cron scheduling
│   └── scripts/         # CLI scripts
├── helm/shopsync/       # Helm chart
├── docs/                # GitHub Pages + Helm repo
├── Dockerfile           # Multi-stage Docker build
├── docker-compose.yml   # Docker Compose setup
└── README.md
```

## 🔒 Security Issues

If you discover a security vulnerability, please **do not** open a public issue.
Instead, email **shyam21091996@gmail.com** directly. See [SECURITY.md](SECURITY.md).

## 📜 License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for helping make ShopSync better! 🎉
