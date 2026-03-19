# 2BCORE API — Secure AI-First Engine

Production-ready REST API following Clean Architecture, security-by-design, and observability-by-design principles.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v24 + TypeScript (strict) |
| Framework | Fastify v5 |
| Auth | JWT RS256 (users) + API Keys SHA-256 (integrations) |
| Database | PostgreSQL via Prisma ORM |
| Cache / Sessions | Redis (ioredis) |
| Logging | Pino (structured JSON, redaction) |
| Observability | OpenTelemetry + Prometheus |
| Containerization | Docker + Docker Compose |

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- Docker + Docker Compose

### 1. Install dependencies
```bash
npm install
```

### 2. Generate RSA keys for JWT signing
```bash
npm run generate:keys
# Creates keys/private.pem and keys/public.pem (gitignored)
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and REDIS_URL
```

### 4. Start infrastructure
```bash
docker compose up postgres redis -d
```

### 5. Run migrations and seed
```bash
npm run prisma:migrate
npm run prisma:seed
# Creates admin@2bcore.local / Admin@2bcore! for local testing
```

### 6. Start development server
```bash
npm run dev
```

The API is available at `http://localhost:3000`.

---

## API Routes

### Health
```
GET  /health          # Liveness check
GET  /health/ready    # Readiness: checks DB + Redis
```

### Auth
```
POST /v1/auth/login     # Returns access_token + sets refresh_token cookie
POST /v1/auth/refresh   # Rotates refresh token, returns new access_token
POST /v1/auth/logout    # Blacklists access token, clears refresh cookie
```

### Users
```
POST   /v1/users        # Register (public)
GET    /v1/users/me     # Get own profile (JWT or API key)
PATCH  /v1/users/me     # Update email / password (JWT required)
DELETE /v1/users/me     # GDPR hard-delete with password confirmation (JWT required)
```

### API Keys
```
POST   /v1/keys         # Create key — raw value returned once (JWT required)
GET    /v1/keys         # List keys — metadata only (JWT or API key)
GET    /v1/keys/:id     # Get key metadata (JWT or API key)
DELETE /v1/keys/:id     # Revoke key (JWT required)
```

### AI
```
POST   /v1/ai/chat      # Chat completion, supports streaming SSE (JWT or API key)
GET    /v1/ai/usage     # Own AI usage history with token/cost summary (JWT required)
```

### Admin (JWT + ADMIN role required)
```
GET    /v1/admin/users           # List all users (paginated)
GET    /v1/admin/users/:id       # Get user by ID
PATCH  /v1/admin/users/:id       # Update user role or active status
DELETE /v1/admin/users/:id       # Hard-delete user
GET    /v1/admin/ai/usage        # Cross-user AI billing history
```

---

## Authentication

### JWT (human users)
```bash
# Login
curl -X POST http://localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@2bcore.local","password":"Admin@2bcore!"}'
# Response: { accessToken, tokenType: "Bearer", expiresIn: 900, user }
# Cookie: refresh_token (HttpOnly, Secure, SameSite=Strict)

# Authenticated request
curl http://localhost:3000/v1/keys \
  -H 'Authorization: Bearer <accessToken>'
```

### API Keys (machine-to-machine)
```bash
# Create key
curl -X POST http://localhost:3000/v1/keys \
  -H 'Authorization: Bearer <jwt>' \
  -d '{"name":"CI Pipeline"}'
# Response: { id, name, key: "sk-live-...", prefix }
# STORE THE KEY — it is never shown again

# Use key
curl http://localhost:3000/v1/keys \
  -H 'X-API-Key: sk-live-...'
```

---

## Security Highlights

- **Passwords**: bcrypt cost factor 12
- **JWT**: RS256 asymmetric signing, 15-minute access tokens
- **Refresh tokens**: stored as SHA-256 hash in Redis, rotated on every use
- **API keys**: stored as SHA-256 hash, never logged, raw returned once
- **Token revocation**: Redis blacklist with TTL = remaining token lifetime
- **Rate limiting**: Redis sliding window — 100 req/min global, 10 req/15min for auth
- **Secure headers**: Helmet (CSP, HSTS, X-Frame-Options, Referrer-Policy)
- **CORS**: allowlist-only from env config
- **Audit log**: every auth event and key lifecycle event written to DB
- **Log redaction**: passwords, tokens, keys automatically redacted via Pino

---

## Testing

```bash
npm test               # Run all tests
npm run test:coverage  # Coverage report (target: 80%)
npm run typecheck      # TypeScript strict check
```

---

## Observability

- **Logs**: structured JSON via Pino. Set `LOG_PRETTY=true` for local dev.
- **Traces**: OpenTelemetry HTTP + Fastify instrumentation. Export via OTLP.
- **Metrics**: Prometheus endpoint on port `9090` (`/metrics`).
- **Correlation ID**: `x-correlation-id` header propagated through all logs.
- **Health**: `GET /health/ready` checks DB and Redis connectivity.

---

## Project Structure

```
src/
  domain/           # Entities, repository interfaces, domain errors
  application/      # Use cases, DTOs (Zod), AuthService
  infrastructure/   # Prisma repos, Redis, Fastify plugins/routes
  interfaces/http/  # App factory, server bootstrap
  shared/           # Env config, constants, utilities
docs/adr/           # Architecture Decision Records
tasks/              # Technical debt, lessons learned
memory/             # Architecture reference
```

---

## Environment Variables

See `.env.example` for all required and optional variables with descriptions.

Critical variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection URL
- `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` — RSA key paths
- `CORS_ALLOWED_ORIGINS` — comma-separated allowed origins

---

## Docker

### Run with Docker Compose
```bash
docker compose up
```

The API container automatically runs `prisma migrate deploy` on startup before accepting requests. No manual migration step required.

### Build production image
```bash
docker build -t 2bcore-api .
```

---

## AI Chat

### Non-streaming
```bash
curl -X POST http://localhost:3000/v1/ai/chat \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Explain Clean Architecture in one paragraph","tier":"standard"}'
```

### Streaming (SSE)
```bash
curl -X POST http://localhost:3000/v1/ai/chat \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Explain Clean Architecture","tier":"standard","stream":true}' \
  --no-buffer
```

Model tiers: `fast` (haiku), `standard` (sonnet), `powerful` (opus).

Per-user monthly token budget is enforced. Exceeding it returns `429 AI_001`.

---

## ADRs

- [ADR-001: Auth Strategy — JWT RS256 + API Keys](docs/adr/001-auth-strategy.md)
- [ADR-002: Clean Architecture](docs/adr/002-clean-architecture.md)
- [ADR-003: AI Cost Tracking](docs/adr/003-ai-cost-tracking.md)
- [ADR-004: RBAC](docs/adr/004-rbac.md)
