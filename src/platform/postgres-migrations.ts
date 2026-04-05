export const postgresMigrations = [
  {
    id: "20260405_001_core_concierge_tables",
    sql: `
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      );

      create table if not exists properties (
        id text primary key,
        code text not null unique,
        name text not null,
        address_line1 text not null,
        address_line2 text,
        city text not null,
        postal_code text not null,
        country_code char(2) not null,
        status text not null,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );

      create table if not exists owners (
        id text primary key,
        full_name text not null,
        email text not null,
        phone text not null,
        status text not null,
        notes text,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );

      create table if not exists property_owners (
        property_id text not null references properties(id) on delete cascade,
        owner_id text not null references owners(id) on delete cascade,
        primary key (property_id, owner_id)
      );

      create table if not exists units (
        id text primary key,
        property_id text not null references properties(id) on delete restrict,
        label text not null,
        floor integer not null,
        bedroom_count integer not null,
        bathroom_count double precision not null,
        occupancy_status text not null,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );

      create table if not exists occupants (
        id text primary key,
        full_name text not null,
        email text not null,
        phone text not null,
        unit_id text not null references units(id) on delete restrict,
        lease_status text not null,
        move_in_date date not null,
        move_out_date date,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );

      create table if not exists service_requests (
        id text primary key,
        property_id text not null references properties(id) on delete restrict,
        unit_id text references units(id) on delete restrict,
        occupant_id text references occupants(id) on delete restrict,
        category text not null,
        priority text not null,
        status text not null,
        title text not null,
        description text not null,
        reported_at timestamptz not null,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );

      create table if not exists maintenance_tasks (
        id text primary key,
        service_request_id text references service_requests(id) on delete restrict,
        property_id text not null references properties(id) on delete restrict,
        unit_id text references units(id) on delete restrict,
        summary text not null,
        assignee text not null,
        priority text not null,
        status text not null,
        scheduled_for timestamptz,
        completed_at timestamptz,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );

      create table if not exists booking_reservations (
        id text primary key,
        property_id text not null references properties(id) on delete restrict,
        unit_id text not null references units(id) on delete restrict,
        guest_name text not null,
        guest_email text not null,
        start_date date not null,
        end_date date not null,
        status text not null,
        external_reference text,
        cancelled_at timestamptz,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );
    `
  },
  {
    id: "20260405_002_property_inspections",
    sql: `
      create table if not exists property_inspections (
        id text primary key,
        property_id text not null references properties(id) on delete cascade,
        inspector text not null,
        performed_at timestamptz not null,
        notes text,
        items_json jsonb not null,
        category_scores_json jsonb not null,
        overall_score double precision not null,
        benchmark_score double precision not null,
        alert_triggered boolean not null,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );

      create index if not exists property_inspections_property_performed_idx
      on property_inspections (property_id, performed_at desc);
    `
  },
  {
    id: "20260405_003_outbox_events",
    sql: `
      create table if not exists outbox_events (
        id text primary key,
        topic text not null,
        aggregate_type text not null,
        aggregate_id text not null,
        payload_json jsonb not null,
        status text not null,
        attempts integer not null default 0,
        available_at timestamptz not null,
        claimed_at timestamptz,
        claimed_by text,
        processed_at timestamptz,
        last_error text,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );

      create index if not exists outbox_events_pending_idx
      on outbox_events (status, available_at, created_at);
    `
  }
] as const;
