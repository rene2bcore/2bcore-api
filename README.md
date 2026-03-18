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

### API Keys (JWT required)
```
POST   /v1/keys         # Create key (raw returned once)
GET    /v1/keys         # List keys (metadata only, no raw values)
DELETE /v1/keys/:id     # Revoke key
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

## ADRs

- [ADR-001: Auth Strategy — JWT RS256 + API Keys](docs/adr/001-auth-strategy.md)
