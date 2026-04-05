import type { Pool } from "pg";
import { newDb } from "pg-mem";
import { describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { initialDomainSeed } from "../src/domain/seed.js";
import { ConciergeDomainService } from "../src/domain/service.js";
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
      topic: "service_request.created",
      aggregateType: "service_request",
      status: "pending",
      attempts: 0
    });

    const handler = vi.fn(async () => {});
    const worker = new OutboxWorker({
      repository,
      handlers: {
        "service_request.created": handler
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

    let now = "2026-04-05T23:59:00.000Z";
    const handler = vi
      .fn(async () => {})
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce();

    const worker = new OutboxWorker({
      repository: platform.repository,
      handlers: {
        "service_request.created": handler
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
      lastError: "temporary outage",
      availableAt: now
    });

    now = "2026-04-05T23:59:01.000Z";
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
});
