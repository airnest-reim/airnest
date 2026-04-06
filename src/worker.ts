import { loadEnv } from "./config/env.js";
import { createDefaultDomainPlatform } from "./platform/create-store.js";
import { createDefaultOutboxHandlers } from "./outbox/handlers.js";
import { OutboxWorker } from "./outbox/worker.js";

async function start(): Promise<void> {
  const env = loadEnv();
  const platform = createDefaultDomainPlatform(env);

  try {
    await platform.initialize?.();

    const worker = new OutboxWorker({
      repository: platform.repository,
      handlers: createDefaultOutboxHandlers(platform.repository),
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
