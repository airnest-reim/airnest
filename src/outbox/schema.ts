import { z } from "zod";

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const outboxEventStatusSchema = z.enum([
  "pending",
  "processing",
  "processed"
]);

export const outboxEventTopicSchema = z.enum(["service_request.created"]);

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

export const serviceRequestCreatedEventPayloadSchema = z.object({
  serviceRequestId: z.string().min(1),
  propertyId: z.string().min(1),
  unitId: z.string().min(1).optional(),
  occupantId: z.string().min(1).optional(),
  category: z.string().min(1),
  priority: z.string().min(1),
  title: z.string().min(1),
  reportedAt: isoDateTimeSchema,
  occurredAt: isoDateTimeSchema
});

export type OutboxEvent = z.infer<typeof outboxEventSchema>;
export type OutboxEventStatus = z.infer<typeof outboxEventStatusSchema>;
export type OutboxEventTopic = z.infer<typeof outboxEventTopicSchema>;
export type ServiceRequestCreatedEventPayload = z.infer<
  typeof serviceRequestCreatedEventPayloadSchema
>;

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
