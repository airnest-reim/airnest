# AIRAA Platform Foundation

Bootstrap repository for the concierge immobiliere application stack.

## Stack

- Node.js 22
- TypeScript
- Fastify
- Vitest
- ESLint
- Prettier
- GitHub Actions

## Getting Started

1. Copy `.env.example` to `.env` if you need local overrides.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.

The server exposes a health endpoint at `GET /health`.
The concierge domain API is available under `/api/*` with seeded local data.

## Scripts

- `npm run dev` starts the API in watch mode.
- `npm run build` compiles the app into `dist/`.
- `npm run start` runs the compiled build.
- `npm run lint` validates TypeScript and lint rules.
- `npm run test` runs the test suite.
- `npm run format` checks formatting.

## Concierge Domain

The initial concierge backbone is modeled directly in the API with six resources:

- `properties`
- `owners`
- `units`
- `occupants`
- `service-requests`
- `maintenance-tasks`

Each resource supports `GET` list, `GET /:id`, `POST`, and `DELETE /:id`.
Generic `PATCH /:id` remains available for non-lifecycle updates, but service request and maintenance status transitions are now workflow-driven.
The server also exposes `GET /api/domain/meta` for the active schema version, seeded counts, and product open questions that still need operating guidance.

Workflow endpoints:

- `POST /api/service-requests/:id/triage` moves a request from `new` to `triaged`
- `POST /api/service-requests/:id/resolve` closes a triaged or scheduled request
- `POST /api/service-requests/:id/cancel` cancels an open request
- `POST /api/maintenance-tasks/:id/schedule` assigns a scheduled execution window
- `POST /api/maintenance-tasks/:id/start` moves a scheduled task into `in_progress`
- `POST /api/maintenance-tasks/:id/complete` closes a scheduled or active task and can resolve the linked request
- `POST /api/maintenance-tasks/:id/cancel` cancels an open task

## Property And Booking APIs

Property management now includes a dedicated archive action:

- `POST /api/properties/:id/archive` marks a property as `offboarded`

Booking integrations are available under `/api/bookings/*`:

- `POST /api/bookings/availability` checks whether a unit is free for a date range
- `POST /api/bookings/reservations` creates a confirmed reservation when no conflicts exist
- `POST /api/bookings/reservations/:id/cancel` cancels an existing reservation and reopens availability

Booking payloads validate date windows (`startDate < endDate`), property and unit hierarchy, and reject reservations for archived properties.

## Delivery Notes

- CI runs `lint`, `test`, and `build` on pushes and pull requests.
- The current foundation is intentionally monolithic so the next domain modeling task can extend a single app boundary without structural rework.

## Architecture

- [System architecture](docs/architecture/concierge-platform-architecture.md)
- [ADR 0001: Modular monolith first](docs/adr/0001-modular-monolith-first.md)

## Operations Docs

- [Guest operations runbook](docs/guest-operations-runbook.md) defines the baseline guest messaging templates, escalation matrix, human handoff rules, and common-issue workflows.
- [Field operations SOP](docs/field-operations-sop.md) translates guest escalation scenarios into onsite checklists, dispatch standards, completion proof requirements, and coverage gaps for operations leadership.
