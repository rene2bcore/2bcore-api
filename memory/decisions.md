# Key Decisions — 2BCORE API

## Security Decisions

| Decision | Choice | Reason |
|---|---|---|
| JWT algorithm | RS256 (asymmetric) | Public key distributable to downstream services without exposing signing key |
| Access token expiry | 15 minutes | Limits blast radius of token theft |
| Refresh token storage | SHA-256 hash in Redis | Revocable; DB compromise does not expose usable tokens |
| API key storage | SHA-256 hash in DB, prefix hint only | Never log or store raw keys |
| Password hashing | bcrypt, rounds=12 | Industry standard; rounds configurable via env |
| Cookie flags | HttpOnly + Secure + SameSite=Strict | Prevents XSS and CSRF token theft |
| Timing-safe login | Dummy bcrypt even when user not found | Prevents email enumeration via timing attack |
| Admin auth | JWT only, no API key | Admin operations require human identity |

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Architecture | Clean Architecture (4 layers) | Testable without DB/Redis; swappable infrastructure |
| Framework | Fastify v5 | Schema-first, fast serialization, plugin-based |
| ORM | Prisma | Type-safe, migration history, PostgreSQL support |
| Validation | Zod at API boundary + config startup | Fail-fast; typed DTOs; consistent error messages |
| DI | Manual constructor injection in `app.ts` | No framework overhead; explicit wiring; testable |
| Error mapping | DomainError → HTTP status/code in global handler | Single source of truth; no HTTP concerns in use cases |

## AI Decisions

| Decision | Choice | Reason |
|---|---|---|
| AI billing tracking | Separate `ai_usage_logs` table | Billing data has different retention/access needs than audit data |
| Budget enforcement | Redis monthly counter per user | Sub-millisecond check; resets automatically each month |
| Model routing | Three tiers: fast/standard/powerful | Cost optimization; callers don't need to know exact model IDs |
| Streaming | SSE (Server-Sent Events) via Fastify hijack | Compatible with all HTTP/1.1 clients; no WebSocket overhead |
| Budget pre-check | Before `reply.hijack()` | Allows proper 429 JSON response before SSE headers are committed |
| Stream usage logging | Fire-and-forget after `yield done` | Token counts only available post-stream; must not block final event |

## RBAC Decisions

| Decision | Choice | Reason |
|---|---|---|
| Role model | Two roles: USER / ADMIN | Sufficient for MVP; extensible |
| Role storage | In JWT payload | No extra DB lookup per request |
| Role enforcement | `requireAdmin` Fastify decorator | Composable preHandler; clear separation |
| Role change latency | Up to 15m (token expiry) | Acceptable trade-off; no per-user blacklist needed for MVP |

## Operational Decisions

| Decision | Choice | Reason |
|---|---|---|
| CI pipeline | GitHub Actions | Native GitHub integration, service containers for Postgres + Redis |
| Test layers | Unit (no I/O) + Integration (real DB + Redis) | Fast feedback loop; integration validates real DB behavior |
| Migration tracking | `prisma/migrations/` committed to git | Schema history must be in source control |
| Rate limiting key | `userId` if authenticated, else IP | Per-user limits prevent one account from abusing shared IP limits |
| AI rate limit | Separate tighter limit (default 20/min) | AI calls are expensive; standard global limit too permissive |
| Logs | Pino JSON + redaction | Structured for log aggregators; secrets never appear in logs |
