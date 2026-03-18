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
- Rate limiting: Redis sliding window, per-IP globally, stricter per auth endpoint
- Audit trail: every auth event and key mutation written to `audit_logs` table
- Graceful shutdown: SIGTERM/SIGINT handled — closes DB + Redis + OTel before exit
- Error handling: DomainError hierarchy → structured JSON responses with error codes
- Validation: Zod at API boundary (routes) and at config startup
