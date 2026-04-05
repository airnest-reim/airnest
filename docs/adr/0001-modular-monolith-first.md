# ADR 0001: Adopt A Modular Monolith First

## Status

Accepted

## Date

2026-04-05

## Context

AIRAA currently has:

- a single Fastify application
- typed Zod domain schemas
- CRUD endpoints for concierge resources
- an in-memory store used for seeded development data and tests

The team needs an architecture that supports near-term product delivery without locking the platform into bootstrap-only choices.

The main options considered were:

1. Keep a simple monolith and formalize modular boundaries.
2. Split the system into microservices now.
3. Build serverless or integration-heavy slices independently from the start.

## Decision

AIRAA will use a modular monolith as the first production architecture.

Implementation constraints:

- one backend codebase and one deployable API service
- PostgreSQL as the source of truth
- a worker process for asynchronous jobs and integrations
- explicit internal boundaries for portfolio, service operations, maintenance operations, integrations, and platform concerns

## Rationale

- The current codebase is already monolithic, so this decision compounds existing momentum.
- The product domain is still evolving, especially around concierge workflows and external vendor processes.
- A small engineering team will move faster with a single runtime, deployment path, and debugging surface.
- Data consistency across service requests, maintenance tasks, properties, and occupants is easier in one transactional boundary.
- Future service extraction remains possible if boundaries are enforced inside the monolith first.

## Consequences

### Positive

- Faster delivery in the next implementation phase
- Lower operational complexity
- Simpler local development and testing
- Easier schema evolution while product workflows are still stabilizing

### Negative

- Less runtime isolation between domains
- Need for discipline to avoid a tightly coupled codebase
- Some future extraction work will still be required if scale increases significantly

## Follow-On Decisions

- Introduce repository interfaces and replace the in-memory store with PostgreSQL-backed persistence.
- Move from generic CRUD toward workflow-specific service operations for service requests and maintenance tasks.
- Add outbox-based asynchronous processing before external integrations are made production-critical.
