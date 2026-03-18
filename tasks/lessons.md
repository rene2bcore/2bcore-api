# Lessons Learned

## L-001: Timing-Safe Credential Validation

**Date:** 2026-03-17
**Rule:** Always perform a dummy bcrypt comparison when a user is not found — never short-circuit with an early return.

**Why:** If `findByEmail` returns null and we immediately throw `InvalidCredentialsError`, an attacker can time the difference between "user not found" (fast) vs "password wrong" (slow bcrypt) to enumerate valid email addresses.

**How applied:** `LoginUseCase.execute` performs a constant-time bcrypt compare even when the user is not found.

---

## L-002: Token Redaction in Logs

**Date:** 2026-03-17
**Rule:** Configure Pino `redact` paths before any log output to guarantee tokens never appear in logs — even on error paths.

**Why:** Error handlers often log the full request/response, which may include Authorization headers or body fields containing tokens.

**How applied:** `logger.ts` includes a comprehensive `REDACT_PATHS` array covering headers, body fields, and nested paths.

---

## L-003: Fail-Fast Environment Validation

**Date:** 2026-03-17
**Rule:** Validate all environment variables at process startup using Zod. Call `process.exit(1)` immediately on failure.

**Why:** Starting with invalid config leads to subtle runtime failures that are hard to debug. Better to fail loudly at boot.

**How applied:** `src/shared/config/env.ts` calls `process.exit(1)` if validation fails.
