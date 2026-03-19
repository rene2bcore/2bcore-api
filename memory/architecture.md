# Architecture Reference — 2BCORE API

## Stack

- Runtime: Node.js v24 + TypeScript strict mode
- Framework: Fastify v5 (schema-first, plugin-based)
- ORM: Prisma + PostgreSQL
- Cache/Session: Redis (ioredis)
- Logging: Pino (structured JSON, redaction built-in)
- Observability: OpenTelemetry SDK (traces + Prometheus metrics)
- Containerization: Docker + Docker Compose

## Layer Responsibilities

| Layer | Responsibility |
|---|---|
| `domain/` | Entities, repository interfaces (ports), domain errors — no framework dependencies |
| `application/` | Use cases, DTOs (Zod), application services (AuthService) — orchestration only |
| `infrastructure/` | Prisma repos, Redis clients, Fastify plugins/routes — implements ports |
| `interfaces/http/` | Fastify app factory, server bootstrap |
| `shared/` | Config (env), constants, utility functions |

## Key Design Decisions

- Auth: JWT RS256 (access, 15m) + rotating refresh tokens (7d, Redis) + API Keys (SHA-256 hash, DB)
- RBAC: Two roles (USER / ADMIN). `requireAdmin` decorator enforces 403. Role is in JWT payload.
- Rate limiting: Redis sliding window — global per-IP, stricter per auth endpoint, tighter per AI endpoint
- AI tracking: Dual-layer — `AiUsageLog` table (billing) + `AuditLog` (security). Budget via Redis counters.
- Admin routes: `GET/PATCH/DELETE /v1/admin/users/*`, `GET /v1/admin/ai/usage` — JWT + ADMIN role required
- Audit trail: every auth event, key mutation, and admin action written to `audit_logs` table
- Graceful shutdown: SIGTERM/SIGINT handled — closes DB + Redis + OTel before exit
- Error handling: DomainError hierarchy → structured JSON responses with error codes
- Validation: Zod at API boundary (routes) and at config startup
- CI/CD: GitHub Actions — lint+typecheck → unit tests → integration tests (Postgres+Redis services) → build

## API Surface (v1)

| Route | Auth | Description |
|---|---|---|
| `POST /v1/auth/login` | — | Issue JWT + refresh token |
| `POST /v1/auth/refresh` | cookie | Rotate refresh token |
| `POST /v1/auth/logout` | JWT | Blacklist access token |
| `POST /v1/auth/verify-email` | — | Consume one-time email verification token (24h TTL) |
| `POST /v1/auth/resend-verification` | — | Resend verification email (prevents enumeration) |
| `POST /v1/auth/forgot-password` | — | Send password reset email (always 204) |
| `POST /v1/auth/reset-password` | — | Consume reset token, set new password, revoke sessions |
| `POST /v1/users` | — | Register user |
| `GET /v1/users/me` | JWT or API key | Get own profile |
| `PATCH /v1/users/me` | JWT | Update email/password |
| `DELETE /v1/users/me` | JWT | GDPR hard-delete (password confirm) |
| `POST /v1/keys` | JWT | Create API key |
| `GET /v1/keys` | JWT or API key | List own keys |
| `GET /v1/keys/:id` | JWT or API key | Get key metadata |
| `DELETE /v1/keys/:id` | JWT | Revoke key |
| `POST /v1/ai/chat` | JWT or API key | Chat completion (streaming supported) |
| `GET /v1/ai/usage` | JWT | Own AI usage history |
| `GET /v1/admin/users` | JWT + ADMIN | List all users |
| `GET /v1/admin/users/:id` | JWT + ADMIN | Get user by ID |
| `PATCH /v1/admin/users/:id` | JWT + ADMIN | Update user role/status |
| `DELETE /v1/admin/users/:id` | JWT + ADMIN | Hard-delete user |
| `GET /v1/admin/ai/usage` | JWT + ADMIN | Cross-user AI billing |
| `GET /health` | — | Liveness probe |
| `GET /health/ready` | — | Readiness (DB + Redis) |
| `GET /docs` | — | OpenAPI UI (dev only) |
