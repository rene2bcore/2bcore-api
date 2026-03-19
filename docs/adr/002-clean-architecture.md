# ADR-002: Clean Architecture — Domain / Application / Infrastructure Layering

**Status:** Accepted
**Date:** 2026-03-17
**Authors:** 2BCORE Engineering

---

## Context

The 2BCORE API must be maintainable by multiple engineers over time, testable at multiple levels, and deployable across environments without coupling business logic to infrastructure concerns (databases, HTTP frameworks, AI providers, Redis).

The architecture must also support swapping underlying implementations (e.g., migrating from Prisma to a different ORM, or from Fastify to another HTTP framework) without touching the core business rules.

---

## Decision

Adopt **Clean Architecture** with four primary layers:

```
domain/          — Entities, repository interfaces (ports), domain errors
application/     — Use cases, services, DTOs (pure business logic)
infrastructure/  — Prisma, Redis, Anthropic client, Fastify plugins, HTTP routes
interfaces/      — Application entry points (Fastify app factory, server)
shared/          — Config, constants, utilities (no layer dependencies)
```

### Dependency Rule

Dependencies point **inward only**: infrastructure depends on application; application depends on domain; domain depends on nothing.

### Key contracts

- **Repository interfaces** (ports) live in `domain/repositories/`. Use cases depend on these interfaces, never on Prisma directly.
- **Use cases** receive injected dependencies via constructor — fully testable with mock implementations.
- **DTOs** (Zod schemas) live in `application/dtos/`. Validation is applied at route handlers before passing to use cases.
- **Domain errors** are the single source of truth for error codes and HTTP status codes — the error handler in `app.ts` converts them to HTTP responses.

---

## Consequences

### Positive

- Use cases are 100% unit-testable without a running database, Redis, or HTTP server.
- Infrastructure can be swapped without touching business logic (e.g., replace Prisma with raw SQL, or Redis with in-memory cache for testing).
- Domain errors propagate cleanly through all layers — no leaking HTTP status codes into use cases.
- New features follow a consistent, predictable pattern: entity → repository interface → use case → route.

### Negative / Trade-offs

- More boilerplate than a flat structure — adding a feature requires touching at least three files (entity, use case, route).
- Constructor injection requires explicit wiring in `app.ts` — manageable for current scale, but a DI container (e.g., tsyringe) may be warranted as the number of use cases grows.

---

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| Flat MVC (controllers + models) | Tight coupling makes unit testing difficult; business logic leaks into controllers |
| Hexagonal Architecture (explicit ports/adapters naming) | Essentially the same concept; our naming (`domain/repositories/`) is equivalent and more intuitive |
| Monolith-to-microservices from day one | Premature; Clean Architecture gives the same testability and separation while keeping deployment simple |

---

## Technical Debt

- `app.ts` acts as a manual DI container — as the codebase grows, consider introducing a lightweight DI container.
- No explicit service layer interface (only concrete classes) — acceptable for current scale.
