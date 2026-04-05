import type { OutboxHandler } from "./worker.js";
import type { OutboxEventTopic } from "./schema.js";

export function createDefaultOutboxHandlers(): Partial<
  Record<OutboxEventTopic, OutboxHandler>
> {
  return {
    "service_request.created": async () => {
      // The notification/integration dispatcher will plug in here next.
    }
  };
}
