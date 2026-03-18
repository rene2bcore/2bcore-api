# Technical Debt Register

## TD-001: Single Refresh Token Per User

**Added:** 2026-03-17
**Severity:** Medium
**Area:** Authentication / Session Management

Current refresh token store uses `userId` as the key, meaning only one active session per user is supported. A second login invalidates the previous session's refresh token silently.

**Remediation:** Store refresh tokens in a hash keyed by `userId:sessionId`. Requires session ID tracking across the token pair lifecycle.

---

## TD-002: API Key Scopes Not Implemented

**Added:** 2026-03-17
**Severity:** Low (for MVP)
**Area:** Authorization / API Keys

All API keys currently grant full user-level permissions. No per-key scope restriction.

**Remediation:** Add a `scopes` JSON column to the `api_keys` table. Enforce scope checks in the RBAC middleware.

---

## TD-003: No Per-User Token Budget Enforcement (AI Endpoints)

**Added:** 2026-03-17
**Severity:** Low (AI endpoints not yet implemented)
**Area:** Cost Control / AI

The `CostTracker` service is scaffolded but AI endpoint token budget enforcement via Redis counters is not yet wired.

**Remediation:** Implement when AI proxy endpoints are added.
