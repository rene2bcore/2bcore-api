# ADR-003: AI Cost Tracking — Dual-Layer (Audit Log + Usage Log)

**Status:** Accepted
**Date:** 2026-03-18
**Authors:** 2BCORE Engineering

---

## Context

AI API calls (Anthropic Claude) have measurable, per-request costs based on input/output token counts. The platform must:

1. Track individual AI requests for **billing visibility** (cost per user, per period).
2. Enforce **monthly token budgets** per user to prevent runaway spend.
3. Maintain a **security audit trail** of AI activity for compliance.
4. Support **operational analysis** — identifying expensive prompts, peak usage, model routing effectiveness.

A single logging mechanism cannot cleanly serve both security audit and billing purposes without coupling concerns.

---

## Decision

Implement **two separate persistence layers** for AI observability:

### 1. `AiUsageLog` table (billing & cost visibility)

- Stored in PostgreSQL (`ai_usage_logs`).
- One row per AI request: `userId`, `requestId`, `model`, `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCostUsd`, `stream`, `createdAt`.
- Queried via `GET /v1/ai/usage` (per-user) and `GET /v1/admin/ai/usage` (cross-user with optional userId filter).
- Includes per-page aggregation: `totalInputTokens`, `totalOutputTokens`, `totalTokens`, `totalCostUsd`.
- `userId` is nullable (supports unauthenticated or API-key requests where user identity is not available).

### 2. `AuditLog` table (security & compliance)

- Stores `AI_CHAT_REQUEST` entries with IP, user agent, and a metadata blob.
- Used for security forensics, not billing.
- `onDelete: SetNull` — audit entries survive user deletion for compliance.

### 3. `TokenBudgetStore` (Redis, real-time enforcement)

- Monthly token counter per user: `budget:<userId>:<YYYY-MM>`.
- Checked synchronously before each AI request.
- Returns `429 AI_001` if the budget is exceeded.
- Counter is incremented asynchronously after the request completes.

---

## Consequences

### Positive

- Billing and security concerns are cleanly separated — billing data can be retained differently from audit data.
- Per-user cost queries are efficient (indexed on `userId` and `createdAt`).
- Redis budget enforcement is sub-millisecond — no DB round-trip on the hot path.
- Streaming and non-streaming requests are both tracked (stream flag distinguishes them).

### Negative / Trade-offs

- Two writes per AI request (audit + usage) — acceptable latency overhead, both are fire-and-forget after the response.
- For streaming, token counts are only known after the stream completes — the usage log write happens asynchronously after `yield { type: 'done' }`.
- Cost estimates are approximate (based on published per-million-token pricing) — actual billing may differ from provider.

---

## Cost Estimation Model

```
estimatedCostUsd = (inputTokens / 1_000_000) * inputPricePerM
                 + (outputTokens / 1_000_000) * outputPricePerM
```

Pricing table is defined in `src/shared/constants/index.ts` (`MODEL_PRICING`). Must be updated when Anthropic changes pricing.

---

## Model Routing

Three tiers map to concrete model IDs:

| Tier | Model | Use case |
|---|---|---|
| `fast` | claude-haiku-4-5 | Low-complexity, high-volume tasks |
| `standard` (default) | claude-sonnet-4-6 | Standard reasoning and coding |
| `powerful` | claude-opus-4-6 | Complex architecture, critical reasoning |

---

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| Single audit log for all tracking | Mixing billing and security data in one table makes querying, retention, and access control harder |
| External billing service (Stripe Metering) | Correct for production SaaS billing; over-engineered for MVP |
| No real-time budget enforcement | Risk of unbounded AI spend; Redis counter is cheap and effective |

---

## Technical Debt

- Pricing table requires manual updates when Anthropic changes prices.
- Budget enforcement uses a single monthly Redis key — no carry-over from previous months, no per-model budgets.
- No webhook/alert when a user approaches their budget limit (only hard cutoff at 100%).
