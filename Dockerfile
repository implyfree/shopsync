# ── Stage 1: Build client ────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY client/package.json client/package-lock.json* client/
RUN cd client && npm ci --ignore-scripts

COPY . .
RUN cd client && npm run build

# ── Stage 2: Production image ────────────────────────────────────────
FROM node:18-alpine AS production

RUN apk add --no-cache tini dumb-init \
 && addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY server/ server/
COPY --from=builder /app/client/dist client/dist/

RUN mkdir -p data && chown -R app:app /app

USER app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "server/index.js"]
