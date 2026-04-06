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

### With Docker Compose (Recommended)

```bash
# Start the full stack (PostgreSQL + App)
docker compose up

# In another terminal, seed the database
docker compose exec app npm run db:seed

# The server is now running at http://localhost:3000
```

### Local Development

1. Install Node.js 22+
2. Install PostgreSQL 16+ (or use Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16-alpine`)
3. Copy `.env.example` to `.env` if you need local overrides:
   ```bash
   DATABASE_URL=postgresql://user:password@localhost:5432/airnest_dev
   ```
4. Install dependencies: `npm install`
5. Apply migrations: `npm run db:migrate`
6. Seed test data: `npm run db:seed`
7. Start the development server: `npm run dev`

The server exposes a health endpoint at `GET /health`.
The concierge domain API is available under `/api/*` with seeded local data.

## Scripts

### Development

- `npm run dev` starts the API in watch mode.
- `npm run dev:worker` starts the background worker in watch mode.
- `npm run build` compiles the app into `dist/`.
- `npm run start` runs the compiled build.
- `npm run start:worker` runs the compiled worker.

### Testing & Quality

- `npm run lint` validates TypeScript and lint rules.
- `npm run test` runs the test suite.
- `npm run test:watch` runs tests in watch mode.
- `npm run format` checks formatting.
- `npm run format:write` fixes formatting issues.

### Database

- `npm run db:migrate` applies pending database migrations.
- `npm run db:seed` seeds the database with test data.
- `npm run db:reset` drops all tables and re-seeds (⚠️ destructive).

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

- `GET /api/properties/:id/availability` returns unit availability, minimum-stay checks, blocked ranges, conflict reservations, and a pricing quote
- `POST /api/bookings` creates a booking in `created` state with computed pricing when the stay is valid
- `GET /api/bookings/:id` returns the booking record
- `PATCH /api/bookings/:id/status` enforces the booking lifecycle: `created -> confirmed -> checked_in -> checked_out -> reviewed`
- Legacy aliases remain available at `POST /api/bookings/availability`, `POST /api/bookings/reservations`, and `POST /api/bookings/reservations/:id/cancel`

Booking payloads validate date windows (`startDate < endDate`), property and unit hierarchy, minimum stay, blocked date windows, lifecycle transitions, and reject reservations for archived properties.

## Delivery Notes

- CI runs `lint`, `test`, and `build` on pushes and pull requests.
- The current foundation is intentionally monolithic so the next domain modeling task can extend a single app boundary without structural rework.

## Architecture

- [System architecture](docs/architecture/concierge-platform-architecture.md)
- [ADR 0001: Modular monolith first](docs/adr/0001-modular-monolith-first.md)

## Operations Docs

- [Guest operations runbook](docs/guest-operations-runbook.md) defines the baseline guest messaging templates, escalation matrix, human handoff rules, and common-issue workflows.
- [Field operations SOP](docs/field-operations-sop.md) translates guest escalation scenarios into onsite checklists, dispatch standards, completion proof requirements, and coverage gaps for operations leadership.
