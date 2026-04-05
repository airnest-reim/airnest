import type { Pool } from "pg";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildApp } from "../src/app.js";
import { createPostgresDomainStore } from "../src/platform/create-store.js";

const idResponseSchema = z.object({
  id: z.string()
});

async function buildPostgresBackedApp() {
  const database = newDb({
    autoCreateForeignKeyIndices: true,
    noAstCoverageCheck: true
  });
  const adapter = database.adapters.createPg() as { Pool: new () => Pool };
  const pool = new adapter.Pool();
  const app = buildApp({
    store: createPostgresDomainStore({
      pool,
      seededAt: "2026-04-05T08:00:00.000Z"
    })
  });

  await app.ready();

  return app;
}

describe("postgres-backed domain store", () => {
  it("boots with migrations and seeded relational projections", async () => {
    const app = await buildPostgresBackedApp();

    const metaResponse = await app.inject({
      method: "GET",
      url: "/api/domain/meta"
    });
    expect(metaResponse.statusCode).toBe(200);
    expect(metaResponse.json()).toMatchObject({
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

    const propertyResponse = await app.inject({
      method: "GET",
      url: "/api/properties/prop_lisboa_alfama"
    });
    expect(propertyResponse.statusCode).toBe(200);
    expect(propertyResponse.json()).toMatchObject({
      ownerIds: ["owner_sofia_martins"],
      unitIds: ["unit_alfama_1a", "unit_alfama_2b"]
    });

    await app.close();
  });

  it("persists owner relationships and booking conflicts through postgres", async () => {
    const app = await buildPostgresBackedApp();

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
    const owner = idResponseSchema.parse(ownerResponse.json());

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
    const property = idResponseSchema.parse(propertyResponse.json());

    const linkResponse = await app.inject({
      method: "PATCH",
      url: `/api/owners/${owner.id}`,
      payload: {
        propertyIds: [property.id]
      }
    });
    expect(linkResponse.statusCode).toBe(200);

    const propertyGetResponse = await app.inject({
      method: "GET",
      url: `/api/properties/${property.id}`
    });
    expect(propertyGetResponse.statusCode).toBe(200);
    expect(propertyGetResponse.json()).toMatchObject({
      ownerIds: [owner.id]
    });

    const reservationResponse = await app.inject({
      method: "POST",
      url: "/api/bookings/reservations",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_2b",
        guestName: "Emma Turner",
        guestEmail: "emma.turner@example.com",
        startDate: "2026-06-10",
        endDate: "2026-06-14"
      }
    });
    expect(reservationResponse.statusCode).toBe(201);

    const conflictResponse = await app.inject({
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
    expect(conflictResponse.statusCode).toBe(409);
    expect(conflictResponse.json()).toEqual({
      error: "Booking reservation conflicts with an existing reservation."
    });

    await app.close();
  });
});
