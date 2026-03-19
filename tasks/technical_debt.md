# Technical Debt Register

## ~~TD-001: Single Refresh Token Per User~~ — RESOLVED 2026-03-18

Multi-session support implemented: Redis hash per userId (field = sessionId), cookie format `<sessionId>.<refreshToken>`, `sid` claim in JWT, per-session revocation on logout. New routes: `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/:sessionId`.

---

## TD-002: API Key Scopes Not Implemented

**Added:** 2026-03-17
**Severity:** Low (for MVP)
**Area:** Authorization / API Keys

All API keys currently grant full user-level permissions. No per-key scope restriction.

**Remediation:** Add a `scopes` JSON column to the `api_keys` table. Enforce scope checks in the RBAC middleware.

---

## TD-003: ~~No Per-User Token Budget Enforcement~~ — RESOLVED 2026-03-18

Budget enforcement is wired: `CostTracker.checkBudget()` called before every chat request. Redis counters track monthly token spend. Returns `429 AI_001` when exceeded.

---

## TD-004: Role Change Requires Token Re-issue

**Added:** 2026-03-18
**Severity:** Low
**Area:** RBAC / Authentication

Role changes via `PATCH /v1/admin/users/:id` take effect on the next login. Existing access tokens retain the old role for up to 15 minutes.

**Remediation:** When an admin changes a user's role, optionally blacklist the target's current access tokens (requires storing user→jti mapping in Redis).

---

## TD-005: AI Cost Pricing Table Requires Manual Updates

**Added:** 2026-03-18
**Severity:** Low
**Area:** AI Cost Tracking

`MODEL_PRICING` in `src/shared/constants/index.ts` is hardcoded. Anthropic price changes require a code change and deployment.

**Remediation:** Move pricing to a DB table or env-configured JSON, with a fallback to the hardcoded defaults.
