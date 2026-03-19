# ADR-004: Role-Based Access Control (RBAC)

**Status:** Accepted
**Date:** 2026-03-18
**Authors:** 2BCORE Engineering

---

## Context

The API must distinguish between regular users and platform administrators. Administrators need access to cross-user data (user list, AI billing across all users) and the ability to manage user accounts (activate/deactivate, change roles).

---

## Decision

Implement **simple two-role RBAC** using a `role` field on the `User` entity:

- `USER` — default role; can access their own data only.
- `ADMIN` — platform operator; can access all admin endpoints.

### Implementation

A `requireAdmin` Fastify decorator is registered by `authPlugin`. It reads `request.user.role` (populated by `verifyJWT`) and throws `ForbiddenError` (403, `AUTHZ_001`) if the role is not `ADMIN`.

Admin endpoints use a two-step `preHandler` chain: `[verifyJWT, requireAdmin]`.

API key authentication is intentionally **excluded** from admin endpoints — administrative operations require human identity (JWT), not machine credentials.

### Admin endpoints

| Route | Action |
|---|---|
| `GET /v1/admin/users` | List all users (paginated) |
| `GET /v1/admin/users/:id` | Get any user by ID |
| `PATCH /v1/admin/users/:id` | Change `isActive` or `role` |
| `GET /v1/admin/ai/usage` | Cross-user AI billing history |

All admin mutations are written to the `AuditLog` with `adminAction: true` metadata.

---

## Consequences

### Positive

- Simple and auditable — every admin action is logged with the admin's user ID.
- Role is embedded in the JWT payload — no extra DB lookup on each request.
- Easy to extend: additional roles (e.g., `SUPPORT`, `BILLING`) can be added without changing the auth infrastructure.

### Negative / Trade-offs

- Role is encoded in the JWT at login time — a role change requires the user to log out and log back in (or access token to expire) before the new role takes effect.
- Only two roles — attribute-based access control (ABAC) not supported; fine-grained permissions require a different approach.
- No self-service admin promotion — role changes must be made by an existing admin via the API or directly in the DB.

---

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| ABAC (attribute-based) | Correct for enterprise multi-tenant; over-engineered for current requirements |
| Permission tables in DB | High overhead for read-heavy auth checks; current roles are sufficient |
| Separate admin service | Premature; admin operations are low-volume and do not justify a separate deployment |

---

## Technical Debt

- Role change does not immediately invalidate existing access tokens — tokens retain the old role until they expire (max 15 minutes). Acceptable for current scale; for immediate effect, admin would need to blacklist the target user's active tokens.
- No UI or CLI for initial admin seeding — first admin must be set directly via DB or seed script.
