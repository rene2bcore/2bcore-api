# ADR-001: Authentication Strategy — JWT (RS256) + API Keys

**Status:** Accepted
**Date:** 2026-03-17
**Authors:** 2BCORE Engineering

---

## Context

The 2BCORE API must support two distinct client types:

1. **Human users** (via a web/mobile frontend) — need short-lived sessions with automatic renewal.
2. **Machine-to-machine integrations** (CI/CD, external services, B2B partners) — need stable, long-lived credentials that do not expire unless explicitly revoked.

A single authentication mechanism cannot satisfy both requirements without significant trade-offs.

---

## Decision

Implement a **hybrid authentication system**:

### JWT (RS256) for Human Users

- **Access token**: short-lived (15 minutes), asymmetric RS256 signature.
- **Refresh token**: 7-day rotating token stored as SHA-256 hash in Redis, delivered via HttpOnly Secure SameSite=Strict cookie.
- **Token rotation**: every refresh invalidates the old token and issues a new pair (prevents refresh token reuse attacks).
- **Token revocation**: access tokens are blacklisted in Redis (TTL = remaining token lifetime) upon logout. Refresh tokens are deleted.
- **Asymmetric keys (RS256)**: allows token verification without exposing the signing key. The public key can be distributed to downstream services.

### API Keys for Machine Clients

- Format: `sk-live-<random 64 hex chars>` — prefix enables client identification and input filtering.
- Storage: SHA-256 hash stored in DB, raw key delivered **once** at creation time.
- Never logged — only the prefix hint and hash are ever stored or transmitted.
- Revocable at any time via `DELETE /v1/keys/:id`.
- `lastUsedAt` is updated on every use (async, non-blocking) for audit purposes.

---

## Consequences

### Positive

- Short access token lifetime limits blast radius of token theft.
- Refresh token rotation prevents silent reuse if a refresh token is stolen.
- Asymmetric JWT signing enables stateless verification in downstream services.
- API keys follow industry conventions (Stripe, GitHub, OpenAI pattern) — familiar to integrators.
- Hashing API keys means a DB compromise does not expose usable secrets.

### Negative / Trade-offs

- Redis is a required dependency for token blacklisting and refresh token storage. If Redis is unavailable, logout/refresh is degraded. Mitigated by Redis persistence (`appendonly yes`) and health checks.
- RS256 key management adds operational overhead (key rotation, secure storage of private key).
- Refresh token single-device-per-user limitation: current design stores one refresh token hash per user. Multiple concurrent sessions require storing multiple tokens (future work, tracked as tech debt).

---

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| HS256 symmetric JWT | Shared secret must be distributed to every verifying service — weak for multi-service architecture |
| Opaque tokens only | Requires database lookup on every request — no stateless verification possible |
| OAuth 2.0 full server | Correct long-term direction but over-engineered for MVP; can migrate to this later |
| Session cookies only | Does not support machine-to-machine clients cleanly |

---

## Security Controls Summary

| Control | Implementation |
|---|---|
| Password hashing | bcrypt, cost factor 12 |
| Access token signing | RS256, 2048-bit private key |
| Refresh token storage | SHA-256 hash in Redis |
| API key storage | SHA-256 hash in PostgreSQL |
| Token revocation | Redis blacklist (TTL-scoped) |
| Cookie flags | HttpOnly, Secure, SameSite=Strict |
| Rate limiting | Redis sliding window, tighter limits on auth endpoints |
| Audit logging | All auth events written to DB |

---

## Technical Debt

- **Single refresh token per user**: multi-session support requires storing a set of tokens per user (e.g., Redis hash by device/session ID). Tracked in `/tasks/technical_debt.md`.
- **API key scopes**: current implementation grants full user scope. Future: implement per-key permission scopes.
- **OAuth 2.0 migration path**: when federation / SSO is required, the JWT infrastructure is compatible with OAuth 2.0 Authorization Server behavior.
