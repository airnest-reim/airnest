import { z } from "zod";
import type { NotificationEvent } from "../notifications/schema.js";

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const outboxEventStatusSchema = z.enum([
  "pending",
  "processing",
  "processed"
]);

export const outboxEventTopicSchema = z.enum([
  "booking.confirmed",
  "booking.checkin_approaching",
  "booking.checkout_approaching",
  "issue.created",
  "property.created",
  "property.updated",
  "property.deleted",
  "booking.created",
  "booking.updated",
  "booking.deleted",
  "occupant.created",
  "occupant.updated",
  "occupant.deleted",
  "service_request.created",
  "service_request.updated",
  "service_request.deleted",
  "maintenance_task.created",
  "maintenance_task.updated",
  "maintenance_task.deleted",
  "alert.created"
]);

export const outboxEventSchema = z.object({
  id: z.string().min(1),
  topic: outboxEventTopicSchema,
  aggregateType: z.string().min(1),
  aggregateId: z.string().min(1),
  payload: z.unknown(),
  status: outboxEventStatusSchema,
  attempts: z.number().int().nonnegative(),
  availableAt: isoDateTimeSchema,
  claimedAt: isoDateTimeSchema.optional(),
  claimedBy: z.string().min(1).optional(),
  processedAt: isoDateTimeSchema.optional(),
  lastError: z.string().min(1).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export type OutboxEvent = z.infer<typeof outboxEventSchema>;
export type OutboxEventStatus = z.infer<typeof outboxEventStatusSchema>;
export type OutboxEventTopic = z.infer<typeof outboxEventTopicSchema>;
export type NotificationOutboxPayload = NotificationEvent;

export type EnqueueOutboxEventInput = Pick<
  OutboxEvent,
  "id" | "topic" | "aggregateType" | "aggregateId" | "payload" | "availableAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type ClaimOutboxEventsInput = {
  now: string;
  limit: number;
  workerId: string;
};

export type ReleaseOutboxEventInput = {
  eventId: string;
  workerId: string;
  now: string;
  nextAvailableAt: string;
  lastError: string;
};

export type CompleteOutboxEventInput = {
  eventId: string;
  workerId: string;
  processedAt: string;
};
