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

---

## L-004: Fastify Response Serialization Strips Unknown Fields

**Date:** 2026-03-18
**Rule:** Always ensure that response schema fields exactly match the object returned by the use case. Fastify's schema-based serializer silently drops fields not declared in the response schema.

**Why:** If a use case returns a field that is not in the route's response schema, Fastify will silently omit it. This caused missing fields in AI usage and admin responses during development.

**How applied:** Response schemas in routes are kept in sync with use case output types. DTOs use `z.infer` so TypeScript catches drift.

---

## L-005: `exactOptionalPropertyTypes` — Use Conditional Spread

**Date:** 2026-03-18
**Rule:** When passing optional properties to repository methods under `exactOptionalPropertyTypes: true`, use conditional spread instead of passing `undefined` directly.

**Why:** TypeScript's `exactOptionalPropertyTypes` distinguishes `{ field: undefined }` (key present, value undefined) from `{}` (key absent). Passing `{ from: someDate | undefined }` to a function expecting `from?: Date` is a type error.

**How applied:** `...(from !== undefined && { from })` pattern used in `getUsage.ts` and `getAllAiUsage.ts`.

---

## L-006: Audit Log Must Precede Hard-Delete

**Date:** 2026-03-18
**Rule:** For GDPR hard-deletes (or any delete with cascading nulls on FK), write the audit log entry BEFORE calling the delete repository method.

**Why:** `AuditLog.userId` has `onDelete: SetNull`. After `userRepo.delete()`, the user row is gone and the audit log's `userId` will be null. If we write the audit log after deletion, we also lose the email/metadata we wanted to capture.

**How applied:** `DeleteUserUseCase` writes `{ action: 'RESOURCE_DELETED', metadata: { deletedEmail: user.email } }` before calling `userRepo.delete()`.

---

## L-007: Docker — Run Migrations in Entrypoint, Not CMD

**Date:** 2026-03-18
**Rule:** Run `prisma migrate deploy` in a shell entrypoint script (`ENTRYPOINT ["sh", "entrypoint.sh"]`) rather than inline in `CMD` or in the application startup code.

**Why:** `CMD` is easily overridden (e.g. `docker run myimage /bin/sh`), and running migrations inside the Node process conflates infrastructure setup with application code. A dedicated shell entrypoint is always executed and handles non-zero exit codes cleanly via `set -e`.

**How applied:** `scripts/docker-entrypoint.sh` runs `npx prisma migrate deploy` then `exec node dist/interfaces/http/server.js`.

---

## L-008: Fire-and-Forget Side Effects After Streaming

**Date:** 2026-03-18
**Rule:** For non-critical writes that must happen after a streaming response completes (e.g. AI usage logging), use `void Promise.all([...])` after the final `yield`. Never `await` in the hot path.

**Why:** Token counts are only available after the full stream completes. `await`-ing these writes would delay the final SSE event and degrade perceived latency. The client should receive the `done` event without waiting for DB writes.

**How applied:** `ChatUseCase.executeStream()` calls `void Promise.all([costTracker.recordUsage, auditRepo.create, usageRepo.create])` after `yield { type: 'done', ... }`.
