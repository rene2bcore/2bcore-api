# Patterns Reference — 2BCORE API

## Use Case Pattern

Every feature follows the same structure:

```typescript
// 1. Domain entity (domain/entities/)
export interface Foo { id: string; ... }

// 2. Repository interface (domain/repositories/)
export interface IFooRepository {
  findById(id: string): Promise<Foo | null>;
  create(input: CreateFooInput): Promise<Foo>;
}

// 3. DTO / Zod schema (application/dtos/)
export const CreateFooInputSchema = z.object({ ... });
export type CreateFooInput = z.infer<typeof CreateFooInputSchema>;

// 4. Use case (application/use-cases/)
export class CreateFooUseCase {
  constructor(
    private readonly fooRepo: IFooRepository,
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  async execute(input: CreateFooInput): Promise<FooPublic> {
    // business logic
    await this.auditRepo.create({ action: 'RESOURCE_CREATED', ... });
    return result;
  }
}

// 5. Prisma repository (infrastructure/db/repositories/)
export class PrismaFooRepository implements IFooRepository { ... }

// 6. Route (infrastructure/http/routes/)
fastify.post('/', {
  schema: { ... },
  preHandler: [verifyJWT],
  handler: async (request, reply) => {
    const input = CreateFooInputSchema.parse(request.body);
    const result = await createFooUseCase.execute(input);
    return reply.status(201).send(result);
  },
});

// 7. Wire in app.ts
const fooRepo = new PrismaFooRepository(prisma);
const createFooUseCase = new CreateFooUseCase(fooRepo, auditRepo);
await fastify.register(fooRoutes, { prefix: '/v1/foo', createFooUseCase });
```

---

## Auth Guard Pattern

```typescript
// JWT only (sensitive mutations, admin)
preHandler: [verifyJWT]

// JWT or API key (read endpoints, AI chat)
preHandler: [verifyAuth]

// JWT + ADMIN role
preHandler: [verifyJWT, requireAdmin]
```

---

## Error Pattern

Domain errors are the single source of truth. Use cases throw domain errors; the global error handler in `app.ts` converts them to HTTP responses.

```typescript
// Always throw domain errors from use cases:
if (!user) throw new NotFoundError('User');         // 404 GEN_001
if (!match) throw new InvalidCredentialsError();    // 401 AUTH_001
if (exists) throw new UserAlreadyExistsError();     // 409 USR_001
if (notOwner) throw new ForbiddenError();           // 403 AUTHZ_001
```

Never return raw error objects from handlers. Never catch domain errors in use cases unless transforming them.

---

## Audit Log Pattern

Write audit entries for all auth events, key mutations, profile changes, and admin actions:

```typescript
await this.auditRepo.create({
  userId,                    // actor (null for unauthenticated)
  action: 'RESOURCE_CREATED',
  resourceType: 'user',
  resourceId: result.id,
  ipAddress: ctx.ipAddress,
  userAgent: ctx.userAgent,
  metadata: { ... },        // safe metadata — no tokens, passwords, hashes
});
```

For GDPR hard-deletes: write the audit log **before** deletion so the email is captured. `AuditLog.userId` becomes null on cascade (`onDelete: SetNull`).

---

## Pagination Pattern

All list endpoints return:

```typescript
{
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
```

Use `prisma.$transaction([findMany, count])` to get data + total in a single round-trip. Query DTOs use `z.coerce.number().int().min(1).default(1)` for page/limit.

---

## Repository findAll with Optional Filters

Use conditional spread to avoid `exactOptionalPropertyTypes` violations:

```typescript
const { data, total } = await this.repo.findAll({
  page,
  limit,
  ...(userId !== undefined && { userId }),
  ...(from !== undefined && { from }),
  ...(to !== undefined && { to }),
});
```

---

## Fire-and-Forget Side Effects

Non-critical writes after a response (token revocation, usage logging after streaming) use `void Promise.all(...)` or `Promise.allSettled(...)`:

```typescript
// After streaming — don't block final SSE event
void Promise.all([
  this.costTracker.recordUsage(userId, totalTokens),
  this.auditRepo.create({ ... }),
  this.usageRepo.create({ ... }),
]);

// After hard-delete — user is gone, revocation is best-effort
await Promise.allSettled([
  this.authService.revokeRefreshToken(userId),
]);
```
