# Concierge Platform Architecture

## Purpose

This document defines the near-term production architecture for the AIRAA concierge platform. It is grounded in the current codebase, which already provides:

- a single Fastify application boundary
- typed domain schemas with Zod
- CRUD routes for core concierge entities
- an in-memory `DomainStore` used for seed data and tests

The goal is to keep delivery velocity high while creating clear seams for persistence, workflow automation, and third-party integrations.

## Product Scope Covered

The current platform model covers six domain resources:

- properties
- owners
- units
- occupants
- service requests
- maintenance tasks

These resources are sufficient for an initial concierge operating backbone: property inventory, occupancy state, resident requests, and maintenance execution tracking.

## Architectural Decision

AIRAA should ship as a modular monolith for the first production phase.

This means:

- one deployable backend service
- one primary relational database
- one asynchronous job channel for background work
- explicit internal module boundaries so services can be extracted later if scale or team topology requires it

We should not split into microservices yet. The current team size, repo maturity, and product uncertainty do not justify the coordination and operational cost.

## System Context

Primary actors:

- internal concierge operations staff
- property owners
- occupants or tenants
- external vendors for maintenance and field work

Primary business flows:

1. Manage property, owner, unit, and occupant records.
2. Intake service requests from staff or residents.
3. Triage and convert requests into scheduled maintenance tasks.
4. Notify stakeholders and track task completion.
5. Produce an auditable operational record across properties.

## Target Runtime Topology

### 1. API Application

Single Node.js service running Fastify and TypeScript.

Responsibilities:

- expose HTTP APIs
- validate requests and responses
- enforce authorization
- orchestrate domain workflows
- publish background jobs and integration events

### 2. Relational Database

PostgreSQL as the system of record.

Responsibilities:

- persist domain entities
- enforce foreign keys and uniqueness
- support filtering, reporting, and workflow queries
- provide audit-friendly timestamped records

### 3. Background Worker

A worker process, kept in the same repo and sharing the same domain modules.

Responsibilities:

- send outbound notifications
- synchronize external systems
- run scheduled reminders and SLA checks
- process retryable integration work

This should start as a lightweight queue consumer, not a separate platform.

### 4. Object Storage

Used for future attachments such as request photos, invoices, and vendor documents.

Initial use can be deferred, but the API should preserve a clean attachment boundary so it can be added without redesigning request lifecycles.

### 5. Observability Stack

Minimum production requirement:

- structured application logs
- error reporting
- request metrics
- health and readiness checks

## Module Boundaries Inside the Monolith

The backend should evolve into these modules:

- `identity-access`
  Handles user accounts, staff roles, and authentication context.
- `property-portfolio`
  Handles properties, owners, units, and occupants.
- `service-operations`
  Handles service request intake, triage, status transitions, and resident communication state.
- `maintenance-operations`
  Handles maintenance tasks, scheduling, assignment, vendor execution, and completion state.
- `integration-events`
  Handles outbound messages, webhooks, vendor sync, and background jobs.
- `platform`
  Handles configuration, logging, database, queue, and shared application infrastructure.

The current `src/domain/*` files map most directly to `property-portfolio`, `service-operations`, and `maintenance-operations`.

## Data Model Strategy

PostgreSQL tables should mirror the current resource model first, with room for workflow expansion.

Core tables:

- `properties`
- `owners`
- `property_owners`
- `units`
- `occupants`
- `service_requests`
- `maintenance_tasks`

Recommended support tables in the next phase:

- `users`
- `staff_members`
- `vendors`
- `attachments`
- `request_events`
- `task_events`
- `outbox_events`

### Key Modeling Rules

- Owners and properties should move to a join table instead of embedded arrays.
- Units belong to one property.
- Occupants belong to one unit at a time, but lease history should be preserved later via a dedicated occupancy or lease table.
- Service requests belong to a property and may optionally reference a unit and occupant.
- Maintenance tasks may be created from a service request or manually by operations.
- Request and task status transitions should become event-backed to support timelines and auditability.

## API Design Direction

The current CRUD API is acceptable for bootstrap work, but production behavior should move toward workflow-oriented endpoints.

Near-term API surface:

- portfolio management endpoints for properties, units, owners, and occupants
- service request intake and triage endpoints
- maintenance scheduling and completion endpoints
- metadata and health endpoints

Follow-up API patterns:

- `POST /api/service-requests`
- `POST /api/service-requests/:id/triage`
- `POST /api/service-requests/:id/cancel`
- `POST /api/maintenance-tasks`
- `POST /api/maintenance-tasks/:id/schedule`
- `POST /api/maintenance-tasks/:id/complete`

This shift matters because concierge workflows are not simple CRUD in production. They are state transitions with validation, side effects, and notification hooks.

## Data Flow

### Request Intake Flow

1. Client submits a service request.
2. API validates the payload against typed schemas.
3. Domain service verifies property, unit, and occupant consistency.
4. Request is persisted in PostgreSQL.
5. Domain event is written to the outbox.
6. Worker processes notification or downstream sync work.

### Maintenance Execution Flow

1. Operations creates or schedules a maintenance task.
2. API persists the task and emits a task lifecycle event.
3. Worker sends vendor or resident notifications if configured.
4. Completion updates the task state and optionally resolves the originating request.

## Integration Boundaries

Integrations should be adapter-based and asynchronous where possible.

Likely early integrations:

- email and WhatsApp style notifications
- vendor messaging
- calendar or scheduling sync
- document and attachment storage
- accounting or invoicing export

Rules:

- never call third-party systems directly from route handlers unless the action is fast and non-critical
- prefer outbox plus worker processing
- persist integration attempts and failures for retries and auditability

## Deployment Strategy

Phase 1 production deployment:

- one API service container
- one worker container
- one PostgreSQL instance
- one managed secret store
- one logging and metrics stack

Suggested environments:

- local
- preview or staging
- production

Suggested release approach:

- automated CI for lint, test, and build
- schema migrations in deploy pipeline
- blue or rolling deployment for API
- separate worker rollout with safe retry semantics

This is enough operational structure for an early B2B operations platform without overbuilding.

## Security and Access Model

We need role-based access before exposing this outside internal staff.

Initial roles:

- admin
- concierge-ops
- property-manager
- read-only-owner

Security requirements:

- authenticated API access
- role checks at route or service boundary
- secret-managed credentials
- audit trails for status changes and assignment actions
- attachment access control once files are added

## Testing Strategy

Three layers are required:

- domain tests for workflow and validation rules
- API tests for route contracts
- integration tests for database repositories and job processing

The existing Vitest suite is a good foundation, but it currently validates mostly CRUD behavior. The next wave of tests should target lifecycle transitions and repository behavior.

## Technical Risks and Mitigations

### Risk: CRUD-first API hardens into the wrong contract

Mitigation:

- introduce service-layer workflow endpoints before clients depend on pure CRUD
- keep route handlers thin and move business logic into domain services

### Risk: In-memory store blocks real delivery

Mitigation:

- replace `DomainStore` behind repository interfaces
- keep seed fixtures for tests, but move production state to PostgreSQL

### Risk: Embedded relationship arrays do not scale to audit and querying needs

Mitigation:

- normalize relationships in the database schema
- keep API response shaping in services or serializers

### Risk: Synchronous integrations create latency and operational fragility

Mitigation:

- adopt outbox plus worker model before external integrations go live
- add retry and dead-letter handling for failed jobs

### Risk: Team velocity slows if architecture is split too early

Mitigation:

- keep a modular monolith until one of these becomes true:
  - clear scale bottlenecks
  - distinct teams owning separate runtime boundaries
  - materially different scaling or reliability needs by module

## Delivery Sequence

1. Add repository interfaces and PostgreSQL persistence.
2. Introduce service-layer workflow modules for requests and maintenance tasks.
3. Add authentication and role enforcement.
4. Add outbox events and background worker processing.
5. Add notification and vendor integration adapters.
6. Add attachments, audit timelines, and reporting views.

## Recommended Near-Term Stack

- Runtime: Node.js 22
- Language: TypeScript
- HTTP server: Fastify
- Validation: Zod
- Database: PostgreSQL
- Migrations: a TypeScript-friendly migration tool adopted with the database layer
- Background jobs: queue-backed worker in the same repo
- Testing: Vitest
- Containerization: Docker
- CI: GitHub Actions
- Hosting: managed container platform plus managed PostgreSQL

## Exit Criteria For This Architecture

We should reconsider service extraction only when:

- one module needs materially different scaling characteristics
- deployment coupling is slowing delivery
- reliability isolation is needed across business capabilities
- there is a second engineering team with clear module ownership

Until then, the modular monolith is the highest-leverage path.
