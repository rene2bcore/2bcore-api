# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --ignore-scripts

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:24-alpine AS runtime

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy Prisma schema + generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma/

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# Health check dependency
RUN apk add --no-cache curl

USER appuser

EXPOSE 3000 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
