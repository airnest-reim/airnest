import { describe, expect, it } from "vitest";
import { z } from "zod";

import { initialDomainSeed } from "../src/domain/seed.js";
import {
  bookingReservationSchema,
  maintenanceTaskSchema,
  occupantSchema,
  ownerSchema,
  propertySchema,
  unitSchema
} from "../src/domain/schema.js";
import { DomainStore } from "../src/domain/store.js";
import { buildApp } from "../src/app.js";

const domainMetaSchema = z.object({
  schemaVersion: z.string(),
  counts: z.object({
    properties: z.number(),
    owners: z.number(),
    units: z.number(),
    occupants: z.number(),
    serviceRequests: z.number(),
    maintenanceTasks: z.number(),
    bookingReservations: z.number()
  })
});

const errorSchema = z.object({
  error: z.string()
});

const bookingAvailabilityResponseSchema = z.object({
  available: z.boolean(),
  conflicts: z.array(bookingReservationSchema)
});

describe("concierge domain API", () => {
  it("returns seeded domain metadata", async () => {
    const app = buildApp();

    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/api/domain/meta"
    });

    expect(response.statusCode).toBe(200);
    expect(domainMetaSchema.parse(response.json())).toMatchObject({
      schemaVersion: "2026-04-05-initial-concierge-domain",
      counts: {
        properties: 1,
        owners: 1,
        units: 2,
        occupants: 1,
        serviceRequests: 1,
        maintenanceTasks: 1,
        bookingReservations: 0
      }
    });

    await app.close();
  });

  it("creates an owner and property, then keeps relationship ids in sync", async () => {
    const app = buildApp();

    await app.ready();

    const ownerResponse = await app.inject({
      method: "POST",
      url: "/api/owners",
      payload: {
        fullName: "Miguel Costa",
        email: "miguel.costa@example.com",
        phone: "+351910000003",
        status: "active"
      }
    });

    expect(ownerResponse.statusCode).toBe(201);
    const owner = ownerSchema.parse(ownerResponse.json());

    const propertyResponse = await app.inject({
      method: "POST",
      url: "/api/properties",
      payload: {
        code: "CHI-02",
        name: "Chiado Terrace Suites",
        addressLine1: "Rua Nova do Almada 48",
        city: "Lisbon",
        postalCode: "1200-289",
        countryCode: "PT",
        status: "draft"
      }
    });

    expect(propertyResponse.statusCode).toBe(201);
    const property = propertySchema.parse(propertyResponse.json());

    const ownerPatchResponse = await app.inject({
      method: "PATCH",
      url: `/api/owners/${owner.id}`,
      payload: {
        propertyIds: [property.id]
      }
    });

    expect(ownerPatchResponse.statusCode).toBe(200);

    const propertyGetResponse = await app.inject({
      method: "GET",
      url: `/api/properties/${property.id}`
    });

    expect(propertyGetResponse.statusCode).toBe(200);
    expect(propertySchema.parse(propertyGetResponse.json()).ownerIds).toEqual([
      owner.id
    ]);

    await app.close();
  });

  it("creates a unit and occupant while validating hierarchy references", async () => {
    const app = buildApp();

    await app.ready();

    const unitResponse = await app.inject({
      method: "POST",
      url: "/api/units",
      payload: {
        propertyId: "prop_lisboa_alfama",
        label: "3C",
        floor: 3,
        bedroomCount: 3,
        bathroomCount: 2,
        occupancyStatus: "vacant"
      }
    });

    expect(unitResponse.statusCode).toBe(201);
    const unit = unitSchema.parse(unitResponse.json());

    const occupantResponse = await app.inject({
      method: "POST",
      url: "/api/occupants",
      payload: {
        fullName: "Beatriz Silva",
        email: "beatriz.silva@example.com",
        phone: "+351910000004",
        unitId: unit.id,
        leaseStatus: "prospect",
        moveInDate: "2026-05-01"
      }
    });

    expect(occupantResponse.statusCode).toBe(201);
    const occupant = occupantSchema.parse(occupantResponse.json());

    const storedUnitResponse = await app.inject({
      method: "GET",
      url: `/api/units/${unit.id}`
    });

    expect(unitSchema.parse(storedUnitResponse.json()).occupantIds).toContain(
      occupant.id
    );

    const invalidRequestResponse = await app.inject({
      method: "POST",
      url: "/api/service-requests",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_2b",
        occupantId: occupant.id,
        category: "maintenance",
        priority: "medium",
        status: "new",
        title: "Bad hierarchy",
        description: "This should fail because the occupant is in another unit.",
        reportedAt: "2026-04-05T09:30:00.000Z"
      }
    });

    expect(invalidRequestResponse.statusCode).toBe(400);
    expect(errorSchema.parse(invalidRequestResponse.json())).toEqual({
      error: "Occupant does not belong to the provided unit."
    });

    await app.close();
  });

  it("supports service request and maintenance task creation against seeded data", async () => {
    const app = buildApp({
      store: new DomainStore(initialDomainSeed)
    });

    await app.ready();

    const requestResponse = await app.inject({
      method: "POST",
      url: "/api/service-requests",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_1a",
        occupantId: "occupant_ines_rocha",
        category: "general",
        priority: "low",
        status: "new",
        title: "Lobby access card copy",
        description: "Resident needs a second access card.",
        reportedAt: "2026-04-05T10:00:00.000Z"
      }
    });

    expect(requestResponse.statusCode).toBe(201);
    const request = z
      .object({
        id: z.string()
      })
      .parse(requestResponse.json());

    const taskResponse = await app.inject({
      method: "POST",
      url: "/api/maintenance-tasks",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_1a",
        serviceRequestId: request.id,
        summary: "Coordinate replacement access card pickup",
        assignee: "Front Desk Team",
        priority: "low",
        status: "queued"
      }
    });

    expect(taskResponse.statusCode).toBe(201);
    expect(maintenanceTaskSchema.parse(taskResponse.json())).toMatchObject({
      serviceRequestId: request.id,
      propertyId: "prop_lisboa_alfama"
    });

    await app.close();
  });

  it("archives properties through a dedicated endpoint", async () => {
    const app = buildApp();

    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/properties/prop_lisboa_alfama/archive"
    });

    expect(response.statusCode).toBe(200);
    expect(propertySchema.parse(response.json())).toMatchObject({
      id: "prop_lisboa_alfama",
      status: "offboarded"
    });

    await app.close();
  });

  it("checks availability, creates reservations, and blocks overlapping bookings", async () => {
    const app = buildApp();

    await app.ready();

    const availabilityResponse = await app.inject({
      method: "POST",
      url: "/api/bookings/availability",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_2b",
        startDate: "2026-06-10",
        endDate: "2026-06-14"
      }
    });

    expect(availabilityResponse.statusCode).toBe(200);
    expect(availabilityResponse.json()).toEqual({
      available: true,
      conflicts: []
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/bookings/reservations",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_2b",
        guestName: "Emma Turner",
        guestEmail: "emma.turner@example.com",
        startDate: "2026-06-10",
        endDate: "2026-06-14",
        externalReference: "airbnb-44881"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const reservation = bookingReservationSchema.parse(createResponse.json());

    const conflictingAvailabilityResponse = await app.inject({
      method: "POST",
      url: "/api/bookings/availability",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_2b",
        startDate: "2026-06-12",
        endDate: "2026-06-16"
      }
    });

    expect(conflictingAvailabilityResponse.statusCode).toBe(200);
    const conflictingAvailability = bookingAvailabilityResponseSchema.parse(
      conflictingAvailabilityResponse.json()
    );
    expect(conflictingAvailability).toMatchObject({
      available: false
    });
    expect(conflictingAvailability.conflicts).toHaveLength(1);

    const conflictingCreateResponse = await app.inject({
      method: "POST",
      url: "/api/bookings/reservations",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_2b",
        guestName: "Luca Pereira",
        guestEmail: "luca.pereira@example.com",
        startDate: "2026-06-12",
        endDate: "2026-06-16"
      }
    });

    expect(conflictingCreateResponse.statusCode).toBe(409);
    expect(errorSchema.parse(conflictingCreateResponse.json())).toEqual({
      error: "Booking reservation conflicts with an existing reservation."
    });

    const cancelResponse = await app.inject({
      method: "POST",
      url: `/api/bookings/reservations/${reservation.id}/cancel`
    });

    expect(cancelResponse.statusCode).toBe(200);
    expect(bookingReservationSchema.parse(cancelResponse.json())).toMatchObject({
      id: reservation.id,
      status: "cancelled"
    });

    const reopenedAvailabilityResponse = await app.inject({
      method: "POST",
      url: "/api/bookings/availability",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_2b",
        startDate: "2026-06-12",
        endDate: "2026-06-16"
      }
    });

    expect(reopenedAvailabilityResponse.statusCode).toBe(200);
    expect(
      bookingAvailabilityResponseSchema.parse(
        reopenedAvailabilityResponse.json()
      )
    ).toEqual({
      available: true,
      conflicts: []
    });

    await app.close();
  });

  it("validates booking payloads and rejects archived properties", async () => {
    const app = buildApp();

    await app.ready();

    await app.inject({
      method: "POST",
      url: "/api/properties/prop_lisboa_alfama/archive"
    });

    const archivedPropertyResponse = await app.inject({
      method: "POST",
      url: "/api/bookings/reservations",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_1a",
        guestName: "Nora Jensen",
        guestEmail: "nora.jensen@example.com",
        startDate: "2026-07-01",
        endDate: "2026-07-05"
      }
    });

    expect(archivedPropertyResponse.statusCode).toBe(400);
    expect(errorSchema.parse(archivedPropertyResponse.json())).toEqual({
      error: "Cannot create bookings for archived properties."
    });

    const invalidWindowResponse = await app.inject({
      method: "POST",
      url: "/api/bookings/availability",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_1a",
        startDate: "2026-07-05",
        endDate: "2026-07-05"
      }
    });

    expect(invalidWindowResponse.statusCode).toBe(400);
    expect(invalidWindowResponse.json()).toMatchObject({
      error: "Validation failed."
    });

    await app.close();
  });
});
