import type {
  ClaimOutboxEventsInput,
  OutboxEvent,
  OutboxEventTopic,
  ReleaseOutboxEventInput,
  CompleteOutboxEventInput
} from "./schema.js";
import type { DomainRepository } from "../domain/repository.js";

export type OutboxHandler = (event: OutboxEvent) => Promise<void>;

export type OutboxWorkerOptions = {
  repository: DomainRepository;
  handlers: Partial<Record<OutboxEventTopic, OutboxHandler>>;
  workerId: string;
  batchSize?: number;
  now?: () => string;
  retryDelayMs?: (attempts: number) => number;
};

export class OutboxWorker {
  private readonly batchSize: number;
  private readonly now: () => string;
  private readonly retryDelayMs: (attempts: number) => number;

  constructor(private readonly options: OutboxWorkerOptions) {
    this.batchSize = options.batchSize ?? 25;
    this.now = options.now ?? (() => new Date().toISOString());
    this.retryDelayMs =
      options.retryDelayMs ??
      ((attempts) => Math.min(60_000, 1_000 * 2 ** Math.max(0, attempts - 1)));
  }

  async runOnce(): Promise<{ claimedCount: number; processedCount: number }> {
    const claimed = await this.options.repository.claimOutboxEvents({
      now: this.now(),
      limit: this.batchSize,
      workerId: this.options.workerId
    } satisfies ClaimOutboxEventsInput);

    let processedCount = 0;
    for (const event of claimed) {
      const handler = this.options.handlers[event.topic];
      if (!handler) {
        await this.release(event, `No handler registered for topic ${event.topic}.`);
        continue;
      }

      try {
        await handler(event);
        await this.options.repository.completeOutboxEvent({
          eventId: event.id,
          workerId: this.options.workerId,
          processedAt: this.now()
        } satisfies CompleteOutboxEventInput);
        processedCount += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown worker error.";
        await this.release(event, message);
      }
    }

    return {
      claimedCount: claimed.length,
      processedCount
    };
  }

  private async release(event: OutboxEvent, message: string): Promise<void> {
    const now = this.now();
    const delayMs = this.retryDelayMs(event.attempts);
    const nextAvailableAt = new Date(Date.parse(now) + delayMs).toISOString();

    await this.options.repository.releaseOutboxEvent({
      eventId: event.id,
      workerId: this.options.workerId,
      now,
      nextAvailableAt,
      lastError: message
    } satisfies ReleaseOutboxEventInput);
  }
}
