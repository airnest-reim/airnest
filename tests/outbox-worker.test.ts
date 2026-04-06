import type { Pool } from "pg";
import { newDb } from "pg-mem";
import { describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { bookingReservationSchema } from "../src/domain/schema.js";
import { initialDomainSeed } from "../src/domain/seed.js";
import { ConciergeDomainService } from "../src/domain/service.js";
import {
  createInMemoryNotificationTransports,
  NotificationDispatcher
} from "../src/notifications/index.js";
import { createNotificationOutboxHandlers } from "../src/outbox/handlers.js";
import { InMemoryDomainRepository } from "../src/platform/in-memory-repository.js";
import { createPostgresDomainPlatform } from "../src/platform/create-store.js";
import { OutboxWorker } from "../src/outbox/worker.js";

async function buildInMemoryHarness() {
  const repository = new InMemoryDomainRepository(initialDomainSeed);
  const store = new ConciergeDomainService({
    repository,
    schemaVersion: initialDomainSeed.schemaVersion,
    seededAt: "2026-04-05T08:00:00.000Z"
  });
  const app = buildApp({ store });
  await app.ready();

  return { app, repository };
}

async function buildPostgresHarness() {
  const database = newDb({
    autoCreateForeignKeyIndices: true,
    noAstCoverageCheck: true
  });
  const adapter = database.adapters.createPg() as { Pool: new () => Pool };
  const pool = new adapter.Pool();
  const platform = createPostgresDomainPlatform({
    pool,
    seededAt: "2026-04-05T08:00:00.000Z"
  });

  await platform.initialize?.();

  const app = buildApp({ store: platform.store });
  await app.ready();

  return { app, platform };
}

describe("outbox worker foundation", () => {
  it("enqueues and processes service-request events from API writes", async () => {
    const { app, repository } = await buildInMemoryHarness();

    const response = await app.inject({
      method: "POST",
      url: "/api/service-requests",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_1a",
        occupantId: "occupant_ines_rocha",
        category: "access",
        priority: "medium",
        status: "new",
        title: "Need a new lobby code",
        description: "Resident lost the current code.",
        reportedAt: "2026-04-05T12:00:00.000Z"
      }
    });

    expect(response.statusCode).toBe(201);

    const pendingBeforeWorker = await repository.listOutboxEvents("pending");
    expect(pendingBeforeWorker).toHaveLength(1);
    expect(pendingBeforeWorker[0]).toMatchObject({
      topic: "issue.created",
      aggregateType: "service_request",
      status: "pending",
      attempts: 0
    });

    const handler = vi.fn(async () => {});
    const worker = new OutboxWorker({
      repository,
      handlers: {
        "issue.created": handler
      },
      workerId: "test-worker"
    });

    await expect(worker.runOnce()).resolves.toEqual({
      claimedCount: 1,
      processedCount: 1
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const eventsAfterWorker = await repository.listOutboxEvents();
    expect(eventsAfterWorker).toHaveLength(1);
    expect(eventsAfterWorker[0]).toMatchObject({
      status: "processed",
      attempts: 1,
      claimedBy: "test-worker"
    });
    expect(eventsAfterWorker[0].processedAt).toBeDefined();

    await app.close();
  });

  it("retries failed outbox work and persists retry metadata in postgres", async () => {
    const { app, platform } = await buildPostgresHarness();

    const response = await app.inject({
      method: "POST",
      url: "/api/service-requests",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_1a",
        occupantId: "occupant_ines_rocha",
        category: "maintenance",
        priority: "high",
        status: "new",
        title: "Water heater is offline",
        description: "Resident reports no hot water since the morning.",
        reportedAt: "2026-04-05T12:30:00.000Z"
      }
    });

    expect(response.statusCode).toBe(201);

    const beforeClaim = await platform.repository.listOutboxEvents();
    expect(beforeClaim).toHaveLength(1);
    // Use the actual time when the event was created so the worker can claim it
    let now = beforeClaim[0].availableAt;

    const handler = vi
      .fn(async () => {})
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce();

    const worker = new OutboxWorker({
      repository: platform.repository,
      handlers: {
        "issue.created": handler
      },
      workerId: "postgres-worker",
      now: () => now,
      retryDelayMs: () => 0
    });

    await expect(worker.runOnce()).resolves.toEqual({
      claimedCount: 1,
      processedCount: 0
    });

    const afterFailure = await platform.repository.listOutboxEvents();
    expect(afterFailure).toHaveLength(1);
    expect(afterFailure[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      claimedBy: "postgres-worker",
      lastError: "temporary outage"
    });

    // Advance time by 1 second for the second attempt
    now = new Date(Date.parse(beforeClaim[0].availableAt) + 1000).toISOString();
    await expect(worker.runOnce()).resolves.toEqual({
      claimedCount: 1,
      processedCount: 1
    });

    const afterSuccess = await platform.repository.listOutboxEvents();
    expect(afterSuccess).toHaveLength(1);
    expect(afterSuccess[0]).toMatchObject({
      status: "processed",
      attempts: 2,
      claimedBy: "postgres-worker",
      lastError: "temporary outage",
      processedAt: now
    });
    expect(handler).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it("dispatches all booking lifecycle notification events with rendered booking data", async () => {
    const { app, repository } = await buildInMemoryHarness();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/bookings",
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
    const reservationId = bookingReservationSchema.parse(
      createResponse.json()
    ).id;

    const confirmResponse = await app.inject({
      method: "PATCH",
      url: `/api/bookings/${reservationId}/status`,
      payload: {
        status: "confirmed"
      }
    });

    expect(confirmResponse.statusCode).toBe(200);

    const events = await repository.listOutboxEvents("pending");
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.topic)).toEqual([
      "booking.confirmed",
      "booking.checkin_approaching",
      "booking.checkout_approaching"
    ]);
    expect(events[1]?.availableAt).toBe("2026-06-08T15:00:00.000Z");
    expect(events[2]?.availableAt).toBe("2026-06-13T18:00:00.000Z");

    const transports = createInMemoryNotificationTransports(
      () => "2026-04-05T08:05:00.000Z"
    );
    const dispatcher = new NotificationDispatcher({
      emailTransport: transports.email,
      smsTransport: transports.sms
    });
    const handlers = createNotificationOutboxHandlers({
      repository,
      dispatcher
    });

    await expect(
      new OutboxWorker({
        repository,
        handlers,
        workerId: "notification-worker-confirmed",
        now: () => events[0]!.availableAt
      }).runOnce()
    ).resolves.toEqual({
      claimedCount: 1,
      processedCount: 1
    });

    await expect(
      new OutboxWorker({
        repository,
        handlers,
        workerId: "notification-worker-checkin",
        now: () => events[1]!.availableAt
      }).runOnce()
    ).resolves.toEqual({
      claimedCount: 1,
      processedCount: 1
    });

    await expect(
      new OutboxWorker({
        repository,
        handlers,
        workerId: "notification-worker-checkout",
        now: () => events[2]!.availableAt
      }).runOnce()
    ).resolves.toEqual({
      claimedCount: 1,
      processedCount: 1
    });

    expect(transports.email.sent).toHaveLength(3);
    expect(transports.email.sent[0]).toMatchObject({
      to: "emma.turner@example.com",
      templateId: "booking_confirmation"
    });
    expect(transports.email.sent[0]?.subject).toContain(
      "Alfama Courtyard Residences"
    );
    expect(transports.email.sent[0]?.body).toContain("2026-06-10");
    expect(transports.email.sent[0]?.body).toContain(
      "Rua dos Remedios 120, Lisbon"
    );
    expect(transports.email.sent[1]).toMatchObject({
      to: "emma.turner@example.com",
      templateId: "check_in_instructions",
      subject: "Check-in details for Alfama Courtyard Residences"
    });
    expect(transports.email.sent[1]?.body).toContain(
      "Use the keypad code sent in your arrival message."
    );
    expect(transports.email.sent[1]?.body).toContain("AIRAA Guest");
    expect(transports.email.sent[2]).toMatchObject({
      to: "emma.turner@example.com",
      templateId: "checkout_instructions",
      subject: "Checkout reminder for Alfama Courtyard Residences"
    });
    expect(transports.email.sent[2]?.body).toContain(
      "the bathroom hamper"
    );
    expect(transports.email.sent[2]?.body).toContain(
      "the same lockbox used at check-in"
    );

    await app.close();
  });

  it("dispatches issue-created notifications through mocked email and sms providers", async () => {
    const { app, repository } = await buildInMemoryHarness();

    const response = await app.inject({
      method: "POST",
      url: "/api/service-requests",
      payload: {
        propertyId: "prop_lisboa_alfama",
        unitId: "unit_alfama_1a",
        occupantId: "occupant_ines_rocha",
        category: "access",
        priority: "medium",
        status: "new",
        title: "Need a new lobby code",
        description: "Resident lost the current code.",
        reportedAt: "2026-04-05T12:00:00.000Z"
      }
    });

    expect(response.statusCode).toBe(201);

    const [event] = await repository.listOutboxEvents("pending");
    expect(event).toMatchObject({
      topic: "issue.created"
    });

    const transports = createInMemoryNotificationTransports(
      () => "2026-04-05T12:05:00.000Z"
    );
    const worker = new OutboxWorker({
      repository,
      handlers: createNotificationOutboxHandlers({
        repository,
        dispatcher: new NotificationDispatcher({
          emailTransport: transports.email,
          smsTransport: transports.sms
        })
      }),
      workerId: "issue-notification-worker",
      now: () => event!.availableAt
    });

    await expect(worker.runOnce()).resolves.toEqual({
      claimedCount: 1,
      processedCount: 1
    });

    expect(transports.email.sent).toHaveLength(1);
    expect(transports.sms.sent).toHaveLength(1);
    expect(transports.email.sent[0]).toMatchObject({
      to: "ines.rocha@example.com",
      templateId: "standard_issue_response",
      subject: "We received your issue at Alfama Courtyard Residences"
    });
    expect(transports.email.sent[0]?.body).toContain("Need a new lobby code");
    expect(transports.email.sent[0]?.body).toContain(
      "We are triaging the request and assigning the right team."
    );
    expect(transports.sms.sent[0]).toMatchObject({
      to: "+351910000002",
      templateId: "standard_issue_response"
    });
    expect(transports.sms.sent[0]?.body).toContain("Need a new lobby code");
    expect(transports.sms.sent[0]?.body).toContain("+351210000000");

    await app.close();
  });

  it("releases failed notification events without mutating booking lifecycle state", async () => {
    const { app, repository } = await buildInMemoryHarness();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/bookings",
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
    const reservationId = bookingReservationSchema.parse(
      createResponse.json()
    ).id;

    const confirmResponse = await app.inject({
      method: "PATCH",
      url: `/api/bookings/${reservationId}/status`,
      payload: {
        status: "confirmed"
      }
    });

    expect(confirmResponse.statusCode).toBe(200);

    const [event] = await repository.listOutboxEvents("pending");
    const dispatcher = new NotificationDispatcher({
      emailTransport: {
        send: vi.fn(() => Promise.reject(new Error("email transport offline")))
      },
      smsTransport: {
        send: vi.fn(() => Promise.reject(new Error("sms transport offline")))
      }
    });
    const worker = new OutboxWorker({
      repository,
      handlers: createNotificationOutboxHandlers({
        repository,
        dispatcher
      }),
      workerId: "failing-notification-worker",
      now: () => event!.availableAt,
      retryDelayMs: () => 0
    });

    await expect(worker.runOnce()).resolves.toEqual({
      claimedCount: 1,
      processedCount: 0
    });

    const [failedEvent] = await repository.listOutboxEvents();
    expect(failedEvent).toMatchObject({
      topic: "booking.confirmed",
      status: "pending",
      attempts: 1,
      lastError: "email transport offline"
    });

    const reservation = await repository.getBookingReservation(reservationId);
    expect(reservation?.status).toBe("confirmed");

    await app.close();
  });
});
