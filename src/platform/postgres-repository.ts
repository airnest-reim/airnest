import type { Pool, PoolClient } from "pg";

import type {
  BookingReservation,
  DomainSeed,
  MaintenanceTask,
  Occupant,
  Owner,
  Property,
  ServiceRequest,
  Unit
} from "../domain/schema.js";
import {
  bookingPricingSchema,
  propertyBookingPolicySchema
} from "../domain/schema.js";
import type { Inspection } from "../inspections/schema.js";
import type { DomainRepository } from "../domain/repository.js";
import { DomainStoreError, type DomainCounts } from "../domain/store.js";
import type {
  ClaimOutboxEventsInput,
  CompleteOutboxEventInput,
  EnqueueOutboxEventInput,
  OutboxEvent,
  OutboxEventStatus,
  ReleaseOutboxEventInput
} from "../outbox/schema.js";
import { postgresMigrations } from "./postgres-migrations.js";

type PgLike = Pick<Pool, "query" | "end" | "connect">;

type PropertyRow = {
  id: string;
  code: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postal_code: string;
  country_code: string;
  status: Property["status"];
  booking_policy_json: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

type OwnerRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: Owner["status"];
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type UnitRow = {
  id: string;
  property_id: string;
  label: string;
  floor: number;
  bedroom_count: number;
  bathroom_count: number;
  occupancy_status: Unit["occupancyStatus"];
  created_at: Date | string;
  updated_at: Date | string;
};

type OccupantRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  unit_id: string;
  lease_status: Occupant["leaseStatus"];
  move_in_date: string | Date;
  move_out_date: string | Date | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ServiceRequestRow = {
  id: string;
  property_id: string;
  unit_id: string | null;
  occupant_id: string | null;
  category: ServiceRequest["category"];
  priority: ServiceRequest["priority"];
  status: ServiceRequest["status"];
  title: string;
  description: string;
  reported_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

type MaintenanceTaskRow = {
  id: string;
  service_request_id: string | null;
  property_id: string;
  unit_id: string | null;
  summary: string;
  assignee: string;
  priority: MaintenanceTask["priority"];
  status: MaintenanceTask["status"];
  scheduled_for: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type BookingReservationRow = {
  id: string;
  property_id: string;
  unit_id: string;
  guest_name: string;
  guest_email: string;
  start_date: string | Date;
  end_date: string | Date;
  status: BookingReservation["status"];
  pricing_json: unknown;
  external_reference: string | null;
  confirmed_at: Date | string | null;
  checked_in_at: Date | string | null;
  checked_out_at: Date | string | null;
  reviewed_at: Date | string | null;
  cancelled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type InspectionRow = {
  id: string;
  property_id: string;
  inspector: string;
  performed_at: Date | string;
  notes: string | null;
  items_json: Inspection["items"];
  category_scores_json: Inspection["categoryScores"];
  overall_score: number;
  benchmark_score: number;
  alert_triggered: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type OutboxEventRow = {
  id: string;
  topic: OutboxEvent["topic"];
  aggregate_type: string;
  aggregate_id: string;
  payload_json: unknown;
  status: OutboxEvent["status"];
  attempts: number;
  available_at: Date | string;
  claimed_at: Date | string | null;
  claimed_by: string | null;
  processed_at: Date | string | null;
  last_error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export class PostgresDomainRepository implements DomainRepository {
  constructor(private readonly pool: PgLike) {}

  async migrate(): Promise<void> {
    await this.pool.query(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    for (const migration of postgresMigrations) {
      const exists = await this.pool.query<{ id: string }>(
        "select id from schema_migrations where id = $1",
        [migration.id]
      );

      if (exists.rowCount && exists.rowCount > 0) {
        continue;
      }

      const client = await this.pool.connect();
      try {
        await client.query("begin");
        await client.query(migration.sql);
        await client.query(
          "insert into schema_migrations (id) values ($1) on conflict (id) do nothing",
          [migration.id]
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    }
  }

  async seed(seed: DomainSeed): Promise<void> {
    const counts = await this.getCounts();
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      return;
    }

    for (const property of seed.properties) {
      await this.createProperty({
        ...property,
        ownerIds: [],
        unitIds: []
      });
    }

    for (const owner of seed.owners) {
      await this.createOwner(owner);
    }

    for (const unit of seed.units) {
      await this.createUnit({
        ...unit,
        occupantIds: []
      });
    }

    for (const occupant of seed.occupants) {
      await this.createOccupant(occupant);
    }

    for (const request of seed.serviceRequests) {
      await this.createServiceRequest(request);
    }

    for (const task of seed.maintenanceTasks) {
      await this.createMaintenanceTask(task);
    }

    for (const inspection of seed.inspections) {
      await this.createInspection(inspection);
    }
  }

  async dispose(): Promise<void> {
    await this.pool.end();
  }

  async getCounts(): Promise<DomainCounts> {
    return {
      properties: await this.count("properties"),
      owners: await this.count("owners"),
      units: await this.count("units"),
      occupants: await this.count("occupants"),
      serviceRequests: await this.count("service_requests"),
      maintenanceTasks: await this.count("maintenance_tasks"),
      bookingReservations: await this.count("booking_reservations"),
      inspections: await this.count("property_inspections")
    };
  }

  async listProperties(): Promise<Property[]> {
    const result = await this.pool.query<PropertyRow>(`
      select
        p.id,
        p.code,
        p.name,
        p.address_line1,
        p.address_line2,
        p.city,
        p.postal_code,
        p.country_code,
        p.status,
        p.booking_policy_json,
        p.created_at,
        p.updated_at
      from properties p
      order by p.created_at asc, p.id asc
    `);

    return Promise.all(result.rows.map((row) => this.mapPropertyRow(row)));
  }

  async getProperty(id: string): Promise<Property | null> {
    const result = await this.pool.query<PropertyRow>(
      `
        select
          p.id,
          p.code,
          p.name,
          p.address_line1,
          p.address_line2,
          p.city,
          p.postal_code,
          p.country_code,
          p.status,
          p.booking_policy_json,
          p.created_at,
          p.updated_at
        from properties p
        where p.id = $1
      `,
      [id]
    );

    return result.rows[0] ? this.mapPropertyRow(result.rows[0]) : null;
  }

  async createProperty(property: Property): Promise<void> {
    await this.pool.query(
      `
        insert into properties (
          id, code, name, address_line1, address_line2, city, postal_code,
          country_code, status, booking_policy_json, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        property.id,
        property.code,
        property.name,
        property.addressLine1,
        property.addressLine2 ?? null,
        property.city,
        property.postalCode,
        property.countryCode,
        property.status,
        property.bookingPolicy,
        property.createdAt,
        property.updatedAt
      ]
    );
  }

  async updateProperty(property: Property): Promise<void> {
    await this.pool.query(
      `
        update properties
        set code = $2,
            name = $3,
            address_line1 = $4,
            address_line2 = $5,
            city = $6,
            postal_code = $7,
            country_code = $8,
            status = $9,
            booking_policy_json = $10,
            updated_at = $11
        where id = $1
      `,
      [
        property.id,
        property.code,
        property.name,
        property.addressLine1,
        property.addressLine2 ?? null,
        property.city,
        property.postalCode,
        property.countryCode,
        property.status,
        property.bookingPolicy,
        property.updatedAt
      ]
    );
  }

  deleteProperty(id: string): Promise<void> {
    return this.deleteById("properties", id);
  }

  async listOwners(): Promise<Owner[]> {
    const result = await this.pool.query<OwnerRow>(`
      select
        o.id,
        o.full_name,
        o.email,
        o.phone,
        o.status,
        o.notes,
        o.created_at,
        o.updated_at
      from owners o
      order by o.created_at asc, o.id asc
    `);

    return Promise.all(result.rows.map((row) => this.mapOwnerRow(row)));
  }

  async getOwner(id: string): Promise<Owner | null> {
    const result = await this.pool.query<OwnerRow>(
      `
        select
          o.id,
          o.full_name,
          o.email,
          o.phone,
          o.status,
          o.notes,
          o.created_at,
          o.updated_at
        from owners o
        where o.id = $1
      `,
      [id]
    );

    return result.rows[0] ? this.mapOwnerRow(result.rows[0]) : null;
  }

  async createOwner(owner: Owner): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `
          insert into owners (
            id, full_name, email, phone, status, notes, created_at, updated_at
          ) values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          owner.id,
          owner.fullName,
          owner.email,
          owner.phone,
          owner.status,
          owner.notes ?? null,
          owner.createdAt,
          owner.updatedAt
        ]
      );
      await this.replaceOwnerProperties(client, owner.id, owner.propertyIds);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateOwner(owner: Owner): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `
          update owners
          set full_name = $2,
              email = $3,
              phone = $4,
              status = $5,
              notes = $6,
              updated_at = $7
          where id = $1
        `,
        [
          owner.id,
          owner.fullName,
          owner.email,
          owner.phone,
          owner.status,
          owner.notes ?? null,
          owner.updatedAt
        ]
      );
      await this.replaceOwnerProperties(client, owner.id, owner.propertyIds);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  deleteOwner(id: string): Promise<void> {
    return this.deleteById("owners", id);
  }

  async listUnits(): Promise<Unit[]> {
    const result = await this.pool.query<UnitRow>(`
      select
        u.id,
        u.property_id,
        u.label,
        u.floor,
        u.bedroom_count,
        u.bathroom_count,
        u.occupancy_status,
        u.created_at,
        u.updated_at
      from units u
      order by u.created_at asc, u.id asc
    `);

    return Promise.all(result.rows.map((row) => this.mapUnitRow(row)));
  }

  async getUnit(id: string): Promise<Unit | null> {
    const result = await this.pool.query<UnitRow>(
      `
        select
          u.id,
          u.property_id,
          u.label,
          u.floor,
          u.bedroom_count,
          u.bathroom_count,
          u.occupancy_status,
          u.created_at,
          u.updated_at
        from units u
        where u.id = $1
      `,
      [id]
    );

    return result.rows[0] ? this.mapUnitRow(result.rows[0]) : null;
  }

  async createUnit(unit: Unit): Promise<void> {
    await this.pool.query(
      `
        insert into units (
          id, property_id, label, floor, bedroom_count, bathroom_count,
          occupancy_status, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        unit.id,
        unit.propertyId,
        unit.label,
        unit.floor,
        unit.bedroomCount,
        unit.bathroomCount,
        unit.occupancyStatus,
        unit.createdAt,
        unit.updatedAt
      ]
    );
  }

  async updateUnit(unit: Unit): Promise<void> {
    await this.pool.query(
      `
        update units
        set property_id = $2,
            label = $3,
            floor = $4,
            bedroom_count = $5,
            bathroom_count = $6,
            occupancy_status = $7,
            updated_at = $8
        where id = $1
      `,
      [
        unit.id,
        unit.propertyId,
        unit.label,
        unit.floor,
        unit.bedroomCount,
        unit.bathroomCount,
        unit.occupancyStatus,
        unit.updatedAt
      ]
    );
  }

  deleteUnit(id: string): Promise<void> {
    return this.deleteById("units", id);
  }

  async listOccupants(): Promise<Occupant[]> {
    const result = await this.pool.query<OccupantRow>(`
      select
        id,
        full_name,
        email,
        phone,
        unit_id,
        lease_status,
        move_in_date,
        move_out_date,
        created_at,
        updated_at
      from occupants
      order by created_at asc, id asc
    `);

    return result.rows.map(mapOccupantRow);
  }

  async getOccupant(id: string): Promise<Occupant | null> {
    const result = await this.pool.query<OccupantRow>(
      `
        select
          id,
          full_name,
          email,
          phone,
          unit_id,
          lease_status,
          move_in_date,
          move_out_date,
          created_at,
          updated_at
        from occupants
        where id = $1
      `,
      [id]
    );

    return result.rows[0] ? mapOccupantRow(result.rows[0]) : null;
  }

  async createOccupant(occupant: Occupant): Promise<void> {
    await this.pool.query(
      `
        insert into occupants (
          id, full_name, email, phone, unit_id, lease_status,
          move_in_date, move_out_date, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        occupant.id,
        occupant.fullName,
        occupant.email,
        occupant.phone,
        occupant.unitId,
        occupant.leaseStatus,
        occupant.moveInDate,
        occupant.moveOutDate ?? null,
        occupant.createdAt,
        occupant.updatedAt
      ]
    );
  }

  async updateOccupant(occupant: Occupant): Promise<void> {
    await this.pool.query(
      `
        update occupants
        set full_name = $2,
            email = $3,
            phone = $4,
            unit_id = $5,
            lease_status = $6,
            move_in_date = $7,
            move_out_date = $8,
            updated_at = $9
        where id = $1
      `,
      [
        occupant.id,
        occupant.fullName,
        occupant.email,
        occupant.phone,
        occupant.unitId,
        occupant.leaseStatus,
        occupant.moveInDate,
        occupant.moveOutDate ?? null,
        occupant.updatedAt
      ]
    );
  }

  deleteOccupant(id: string): Promise<void> {
    return this.deleteById("occupants", id);
  }

  async listServiceRequests(): Promise<ServiceRequest[]> {
    const result = await this.pool.query<ServiceRequestRow>(`
      select
        id,
        property_id,
        unit_id,
        occupant_id,
        category,
        priority,
        status,
        title,
        description,
        reported_at,
        created_at,
        updated_at
      from service_requests
      order by created_at asc, id asc
    `);

    return result.rows.map(mapServiceRequestRow);
  }

  async getServiceRequest(id: string): Promise<ServiceRequest | null> {
    const result = await this.pool.query<ServiceRequestRow>(
      `
        select
          id,
          property_id,
          unit_id,
          occupant_id,
          category,
          priority,
          status,
          title,
          description,
          reported_at,
          created_at,
          updated_at
        from service_requests
        where id = $1
      `,
      [id]
    );

    return result.rows[0] ? mapServiceRequestRow(result.rows[0]) : null;
  }

  async createServiceRequest(request: ServiceRequest): Promise<void> {
    await this.pool.query(
      `
        insert into service_requests (
          id, property_id, unit_id, occupant_id, category, priority, status,
          title, description, reported_at, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        request.id,
        request.propertyId,
        request.unitId ?? null,
        request.occupantId ?? null,
        request.category,
        request.priority,
        request.status,
        request.title,
        request.description,
        request.reportedAt,
        request.createdAt,
        request.updatedAt
      ]
    );
  }

  async updateServiceRequest(request: ServiceRequest): Promise<void> {
    await this.pool.query(
      `
        update service_requests
        set property_id = $2,
            unit_id = $3,
            occupant_id = $4,
            category = $5,
            priority = $6,
            status = $7,
            title = $8,
            description = $9,
            reported_at = $10,
            updated_at = $11
        where id = $1
      `,
      [
        request.id,
        request.propertyId,
        request.unitId ?? null,
        request.occupantId ?? null,
        request.category,
        request.priority,
        request.status,
        request.title,
        request.description,
        request.reportedAt,
        request.updatedAt
      ]
    );
  }

  deleteServiceRequest(id: string): Promise<void> {
    return this.deleteById("service_requests", id);
  }

  async listMaintenanceTasks(): Promise<MaintenanceTask[]> {
    const result = await this.pool.query<MaintenanceTaskRow>(`
      select
        id,
        service_request_id,
        property_id,
        unit_id,
        summary,
        assignee,
        priority,
        status,
        scheduled_for,
        completed_at,
        created_at,
        updated_at
      from maintenance_tasks
      order by created_at asc, id asc
    `);

    return result.rows.map(mapMaintenanceTaskRow);
  }

  async getMaintenanceTask(id: string): Promise<MaintenanceTask | null> {
    const result = await this.pool.query<MaintenanceTaskRow>(
      `
        select
          id,
          service_request_id,
          property_id,
          unit_id,
          summary,
          assignee,
          priority,
          status,
          scheduled_for,
          completed_at,
          created_at,
          updated_at
        from maintenance_tasks
        where id = $1
      `,
      [id]
    );

    return result.rows[0] ? mapMaintenanceTaskRow(result.rows[0]) : null;
  }

  async createMaintenanceTask(task: MaintenanceTask): Promise<void> {
    await this.pool.query(
      `
        insert into maintenance_tasks (
          id, service_request_id, property_id, unit_id, summary, assignee,
          priority, status, scheduled_for, completed_at, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        task.id,
        task.serviceRequestId ?? null,
        task.propertyId,
        task.unitId ?? null,
        task.summary,
        task.assignee,
        task.priority,
        task.status,
        task.scheduledFor ?? null,
        task.completedAt ?? null,
        task.createdAt,
        task.updatedAt
      ]
    );
  }

  async updateMaintenanceTask(task: MaintenanceTask): Promise<void> {
    await this.pool.query(
      `
        update maintenance_tasks
        set service_request_id = $2,
            property_id = $3,
            unit_id = $4,
            summary = $5,
            assignee = $6,
            priority = $7,
            status = $8,
            scheduled_for = $9,
            completed_at = $10,
            updated_at = $11
        where id = $1
      `,
      [
        task.id,
        task.serviceRequestId ?? null,
        task.propertyId,
        task.unitId ?? null,
        task.summary,
        task.assignee,
        task.priority,
        task.status,
        task.scheduledFor ?? null,
        task.completedAt ?? null,
        task.updatedAt
      ]
    );
  }

  deleteMaintenanceTask(id: string): Promise<void> {
    return this.deleteById("maintenance_tasks", id);
  }

  async listBookingReservations(): Promise<BookingReservation[]> {
    const result = await this.pool.query<BookingReservationRow>(`
      select
        id,
        property_id,
        unit_id,
        guest_name,
        guest_email,
        start_date,
        end_date,
        status,
        pricing_json,
        external_reference,
        confirmed_at,
        checked_in_at,
        checked_out_at,
        reviewed_at,
        cancelled_at,
        created_at,
        updated_at
      from booking_reservations
      order by created_at asc, id asc
    `);

    return result.rows.map(mapBookingReservationRow);
  }

  async getBookingReservation(id: string): Promise<BookingReservation | null> {
    const result = await this.pool.query<BookingReservationRow>(
      `
        select
          id,
          property_id,
          unit_id,
          guest_name,
          guest_email,
          start_date,
          end_date,
          status,
          pricing_json,
          external_reference,
          confirmed_at,
          checked_in_at,
          checked_out_at,
          reviewed_at,
          cancelled_at,
          created_at,
          updated_at
        from booking_reservations
        where id = $1
      `,
      [id]
    );

    return result.rows[0] ? mapBookingReservationRow(result.rows[0]) : null;
  }

  async createBookingReservation(
    reservation: BookingReservation
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      await client.query("select id from units where id = $1 for update", [
        reservation.unitId
      ]);

      const conflict = await client.query<{ id: string }>(
        `
          select id
          from booking_reservations
          where property_id = $1
            and unit_id = $2
            and status <> 'cancelled'
            and start_date < $4
            and $3 < end_date
          limit 1
        `,
        [
          reservation.propertyId,
          reservation.unitId,
          reservation.startDate,
          reservation.endDate
        ]
      );

      if (conflict.rows[0]) {
        throw new DomainStoreError(
          "Booking reservation conflicts with an existing reservation.",
          409
        );
      }

      await client.query(
        `
          insert into booking_reservations (
            id, property_id, unit_id, guest_name, guest_email, start_date,
            end_date, status, pricing_json, external_reference, confirmed_at,
            checked_in_at, checked_out_at, reviewed_at, cancelled_at, created_at,
            updated_at
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17
          )
        `,
        [
          reservation.id,
          reservation.propertyId,
          reservation.unitId,
          reservation.guestName,
          reservation.guestEmail,
          reservation.startDate,
          reservation.endDate,
          reservation.status,
          reservation.pricing,
          reservation.externalReference ?? null,
          reservation.confirmedAt ?? null,
          reservation.checkedInAt ?? null,
          reservation.checkedOutAt ?? null,
          reservation.reviewedAt ?? null,
          reservation.cancelledAt ?? null,
          reservation.createdAt,
          reservation.updatedAt
        ]
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBookingReservation(
    reservation: BookingReservation
  ): Promise<void> {
    await this.pool.query(
      `
        update booking_reservations
        set property_id = $2,
            unit_id = $3,
            guest_name = $4,
            guest_email = $5,
            start_date = $6,
            end_date = $7,
            status = $8,
            pricing_json = $9,
            external_reference = $10,
            confirmed_at = $11,
            checked_in_at = $12,
            checked_out_at = $13,
            reviewed_at = $14,
            cancelled_at = $15,
            updated_at = $16
        where id = $1
      `,
      [
        reservation.id,
        reservation.propertyId,
        reservation.unitId,
        reservation.guestName,
        reservation.guestEmail,
        reservation.startDate,
        reservation.endDate,
        reservation.status,
        reservation.pricing,
        reservation.externalReference ?? null,
        reservation.confirmedAt ?? null,
        reservation.checkedInAt ?? null,
        reservation.checkedOutAt ?? null,
        reservation.reviewedAt ?? null,
        reservation.cancelledAt ?? null,
        reservation.updatedAt
      ]
    );
  }

  async listInspections(): Promise<Inspection[]> {
    const result = await this.pool.query<InspectionRow>(`
      select
        id,
        property_id,
        inspector,
        performed_at,
        notes,
        items_json,
        category_scores_json,
        overall_score,
        benchmark_score,
        alert_triggered,
        created_at,
        updated_at
      from property_inspections
      order by performed_at desc, created_at desc, id desc
    `);

    return result.rows.map(mapInspectionRow);
  }

  async getInspection(id: string): Promise<Inspection | null> {
    const result = await this.pool.query<InspectionRow>(
      `
        select
          id,
          property_id,
          inspector,
          performed_at,
          notes,
          items_json,
          category_scores_json,
          overall_score,
          benchmark_score,
          alert_triggered,
          created_at,
          updated_at
        from property_inspections
        where id = $1
      `,
      [id]
    );

    return result.rows[0] ? mapInspectionRow(result.rows[0]) : null;
  }

  async createInspection(inspection: Inspection): Promise<void> {
    await this.pool.query(
      `
        insert into property_inspections (
          id, property_id, inspector, performed_at, notes, items_json,
          category_scores_json, overall_score, benchmark_score, alert_triggered,
          created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12)
      `,
      [
        inspection.id,
        inspection.propertyId,
        inspection.inspector,
        inspection.performedAt,
        inspection.notes ?? null,
        JSON.stringify(inspection.items),
        JSON.stringify(inspection.categoryScores),
        inspection.overallScore,
        inspection.benchmarkScore,
        inspection.alertTriggered,
        inspection.createdAt,
        inspection.updatedAt
      ]
    );
  }

  async enqueueOutboxEvent(event: EnqueueOutboxEventInput): Promise<void> {
    await this.pool.query(
      `
        insert into outbox_events (
          id, topic, aggregate_type, aggregate_id, payload_json, status,
          attempts, available_at, claimed_at, claimed_by, processed_at,
          last_error, created_at, updated_at
        ) values (
          $1, $2, $3, $4, $5::jsonb, 'pending', 0, $6, null, null, null, null, $7, $8
        )
      `,
      [
        event.id,
        event.topic,
        event.aggregateType,
        event.aggregateId,
        JSON.stringify(event.payload),
        event.availableAt,
        event.createdAt,
        event.updatedAt
      ]
    );
  }

  async listOutboxEvents(status?: OutboxEventStatus): Promise<OutboxEvent[]> {
    const result = await this.pool.query<OutboxEventRow>(
      `
        select
          id,
          topic,
          aggregate_type,
          aggregate_id,
          payload_json,
          status,
          attempts,
          available_at,
          claimed_at,
          claimed_by,
          processed_at,
          last_error,
          created_at,
          updated_at
        from outbox_events
        where ($1::text is null or status = $1)
        order by created_at asc, id asc
      `,
      [status ?? null]
    );

    return result.rows.map(mapOutboxEventRow);
  }

  async claimOutboxEvents(
    input: ClaimOutboxEventsInput
  ): Promise<OutboxEvent[]> {
    const result = await this.pool.query<OutboxEventRow>(
      `
        update outbox_events
        set
          status = 'processing',
          attempts = attempts + 1,
          claimed_at = $2,
          claimed_by = $3,
          updated_at = $2
        where id in (
          select id
          from outbox_events
          where status = 'pending'
            and available_at <= $1
          order by available_at asc, created_at asc, id asc
          limit $4
        )
        returning
          id,
          topic,
          aggregate_type,
          aggregate_id,
          payload_json,
          status,
          attempts,
          available_at,
          claimed_at,
          claimed_by,
          processed_at,
          last_error,
          created_at,
          updated_at
      `,
      [input.now, input.now, input.workerId, input.limit]
    );

    return result.rows
      .sort((left, right) => {
        const availableComparison =
          toIsoString(left.available_at).localeCompare(
            toIsoString(right.available_at)
          );
        if (availableComparison !== 0) {
          return availableComparison;
        }

        const createdComparison = toIsoString(left.created_at).localeCompare(
          toIsoString(right.created_at)
        );
        if (createdComparison !== 0) {
          return createdComparison;
        }

        return left.id.localeCompare(right.id);
      })
      .map(mapOutboxEventRow);
  }

  async completeOutboxEvent(input: CompleteOutboxEventInput): Promise<void> {
    await this.pool.query(
      `
        update outbox_events
        set
          status = 'processed',
          processed_at = $3,
          updated_at = $3
        where id = $1
          and claimed_by = $2
      `,
      [input.eventId, input.workerId, input.processedAt]
    );
  }

  async releaseOutboxEvent(input: ReleaseOutboxEventInput): Promise<void> {
    await this.pool.query(
      `
        update outbox_events
        set
          status = 'pending',
          available_at = $3,
          last_error = $4,
          updated_at = $5
        where id = $1
          and claimed_by = $2
      `,
      [
        input.eventId,
        input.workerId,
        input.nextAvailableAt,
        input.lastError,
        input.now
      ]
    );
  }

  private async count(tableName: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `select count(*)::text as count from ${tableName}`
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async deleteById(tableName: string, id: string): Promise<void> {
    await this.pool.query(`delete from ${tableName} where id = $1`, [id]);
  }

  private async replaceOwnerProperties(
    client: PoolClient,
    ownerId: string,
    propertyIds: string[]
  ): Promise<void> {
    await client.query("delete from property_owners where owner_id = $1", [
      ownerId
    ]);

    for (const propertyId of propertyIds) {
      await client.query(
        `
          insert into property_owners (property_id, owner_id)
          values ($1, $2)
          on conflict (property_id, owner_id) do nothing
        `,
        [propertyId, ownerId]
      );
    }
  }

  private async mapPropertyRow(row: PropertyRow): Promise<Property> {
    return mapPropertyRow(
      row,
      await this.listPropertyOwnerIds(row.id),
      await this.listPropertyUnitIds(row.id)
    );
  }

  private async mapOwnerRow(row: OwnerRow): Promise<Owner> {
    return mapOwnerRow(row, await this.listOwnerPropertyIds(row.id));
  }

  private async mapUnitRow(row: UnitRow): Promise<Unit> {
    return mapUnitRow(row, await this.listUnitOccupantIds(row.id));
  }

  private async listPropertyOwnerIds(propertyId: string): Promise<string[]> {
    const result = await this.pool.query<{ owner_id: string }>(
      `
        select owner_id
        from property_owners
        where property_id = $1
        order by owner_id asc
      `,
      [propertyId]
    );

    return result.rows.map((row) => row.owner_id);
  }

  private async listPropertyUnitIds(propertyId: string): Promise<string[]> {
    const result = await this.pool.query<{ id: string }>(
      `
        select id
        from units
        where property_id = $1
        order by id asc
      `,
      [propertyId]
    );

    return result.rows.map((row) => row.id);
  }

  private async listOwnerPropertyIds(ownerId: string): Promise<string[]> {
    const result = await this.pool.query<{ property_id: string }>(
      `
        select property_id
        from property_owners
        where owner_id = $1
        order by property_id asc
      `,
      [ownerId]
    );

    return result.rows.map((row) => row.property_id);
  }

  private async listUnitOccupantIds(unitId: string): Promise<string[]> {
    const result = await this.pool.query<{ id: string }>(
      `
        select id
        from occupants
        where unit_id = $1
        order by id asc
      `,
      [unitId]
    );

    return result.rows.map((row) => row.id);
  }
}

function mapPropertyRow(
  row: PropertyRow,
  ownerIds: string[],
  unitIds: string[]
): Property {
  const property: Property = {
    id: row.id,
    code: row.code,
    name: row.name,
    addressLine1: row.address_line1,
    city: row.city,
    postalCode: row.postal_code,
    countryCode: row.country_code,
    status: row.status,
    bookingPolicy: propertyBookingPolicySchema.parse(row.booking_policy_json),
    ownerIds,
    unitIds,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };

  if (row.address_line2) {
    property.addressLine2 = row.address_line2;
  }

  return property;
}

function mapOwnerRow(row: OwnerRow, propertyIds: string[]): Owner {
  const owner: Owner = {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    propertyIds,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };

  if (row.notes) {
    owner.notes = row.notes;
  }

  return owner;
}

function mapUnitRow(row: UnitRow, occupantIds: string[]): Unit {
  return {
    id: row.id,
    propertyId: row.property_id,
    label: row.label,
    floor: row.floor,
    bedroomCount: row.bedroom_count,
    bathroomCount: row.bathroom_count,
    occupancyStatus: row.occupancy_status,
    occupantIds,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapOccupantRow(row: OccupantRow): Occupant {
  const occupant: Occupant = {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    unitId: row.unit_id,
    leaseStatus: row.lease_status,
    moveInDate: toDateString(row.move_in_date),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };

  if (row.move_out_date) {
    occupant.moveOutDate = toDateString(row.move_out_date);
  }

  return occupant;
}

function mapServiceRequestRow(row: ServiceRequestRow): ServiceRequest {
  const request: ServiceRequest = {
    id: row.id,
    propertyId: row.property_id,
    category: row.category,
    priority: row.priority,
    status: row.status,
    title: row.title,
    description: row.description,
    reportedAt: toIsoString(row.reported_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };

  if (row.unit_id) {
    request.unitId = row.unit_id;
  }

  if (row.occupant_id) {
    request.occupantId = row.occupant_id;
  }

  return request;
}

function mapMaintenanceTaskRow(row: MaintenanceTaskRow): MaintenanceTask {
  const task: MaintenanceTask = {
    id: row.id,
    propertyId: row.property_id,
    summary: row.summary,
    assignee: row.assignee,
    priority: row.priority,
    status: row.status,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };

  if (row.service_request_id) {
    task.serviceRequestId = row.service_request_id;
  }

  if (row.unit_id) {
    task.unitId = row.unit_id;
  }

  if (row.scheduled_for) {
    task.scheduledFor = toIsoString(row.scheduled_for);
  }

  if (row.completed_at) {
    task.completedAt = toIsoString(row.completed_at);
  }

  return task;
}

function mapBookingReservationRow(
  row: BookingReservationRow
): BookingReservation {
  const reservation: BookingReservation = {
    id: row.id,
    propertyId: row.property_id,
    unitId: row.unit_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    status: row.status,
    pricing: bookingPricingSchema.parse(row.pricing_json),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };

  if (row.external_reference) {
    reservation.externalReference = row.external_reference;
  }

  if (row.confirmed_at) {
    reservation.confirmedAt = toIsoString(row.confirmed_at);
  }

  if (row.checked_in_at) {
    reservation.checkedInAt = toIsoString(row.checked_in_at);
  }

  if (row.checked_out_at) {
    reservation.checkedOutAt = toIsoString(row.checked_out_at);
  }

  if (row.reviewed_at) {
    reservation.reviewedAt = toIsoString(row.reviewed_at);
  }

  if (row.cancelled_at) {
    reservation.cancelledAt = toIsoString(row.cancelled_at);
  }

  return reservation;
}

function mapInspectionRow(row: InspectionRow): Inspection {
  const inspection: Inspection = {
    id: row.id,
    propertyId: row.property_id,
    inspector: row.inspector,
    performedAt: toIsoString(row.performed_at),
    items: row.items_json,
    categoryScores: row.category_scores_json,
    overallScore: Number(row.overall_score),
    benchmarkScore: Number(row.benchmark_score),
    alertTriggered: row.alert_triggered,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };

  if (row.notes) {
    inspection.notes = row.notes;
  }

  return inspection;
}

function mapOutboxEventRow(row: OutboxEventRow): OutboxEvent {
  const event: OutboxEvent = {
    id: row.id,
    topic: row.topic,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: row.payload_json,
    status: row.status,
    attempts: Number(row.attempts),
    availableAt: toIsoString(row.available_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };

  if (row.claimed_at) {
    event.claimedAt = toIsoString(row.claimed_at);
  }

  if (row.claimed_by) {
    event.claimedBy = row.claimed_by;
  }

  if (row.processed_at) {
    event.processedAt = toIsoString(row.processed_at);
  }

  if (row.last_error) {
    event.lastError = row.last_error;
  }

  return event;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toDateString(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}
