import { loadEnv } from "./config/env.js";
import { createDefaultDomainPlatform } from "./platform/create-store.js";
import { createDefaultOutboxHandlers } from "./outbox/handlers.js";
import { OutboxWorker } from "./outbox/worker.js";
import { airtableConfigSchema } from "./airtable/index.js";

async function start(): Promise<void> {
  const env = loadEnv();
  const platform = createDefaultDomainPlatform(env);

  try {
    await platform.initialize?.();

    // Build Airtable config if all required env vars are present
    let airtableConfig = undefined;
    if (
      env.AIRTABLE_API_KEY &&
      env.AIRTABLE_BASE_ID &&
      env.AIRTABLE_PROPERTY_TABLE_ID &&
      env.AIRTABLE_GUEST_TABLE_ID &&
      env.AIRTABLE_BOOKING_TABLE_ID
    ) {
      airtableConfig = airtableConfigSchema.parse({
        apiKey: env.AIRTABLE_API_KEY,
        baseId: env.AIRTABLE_BASE_ID,
        propertyTableId: env.AIRTABLE_PROPERTY_TABLE_ID,
        guestTableId: env.AIRTABLE_GUEST_TABLE_ID,
        bookingTableId: env.AIRTABLE_BOOKING_TABLE_ID,
        serviceRequestTableId: env.AIRTABLE_SERVICE_REQUEST_TABLE_ID,
        maintenanceTaskTableId: env.AIRTABLE_MAINTENANCE_TASK_TABLE_ID,
        alertTableId: env.AIRTABLE_ALERT_TABLE_ID
      });
    }

    const worker = new OutboxWorker({
      repository: platform.repository,
      handlers: createDefaultOutboxHandlers({
        repository: platform.repository,
        airtableConfig: airtableConfig || undefined
      }),
      workerId: `worker:${process.pid}`
    });
    const result = await worker.runOnce();

    process.stdout.write(
      `${JSON.stringify({
        claimedCount: result.claimedCount,
        processedCount: result.processedCount
      })}\n`
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await platform.dispose?.();
  }
}

void start();
