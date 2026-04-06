import type { OutboxHandler } from "./worker.js";
import type { OutboxEventTopic } from "./schema.js";
import type { DomainRepository } from "../domain/repository.js";
import {
  NotificationDispatcher,
  createInMemoryNotificationTransports,
  notificationEventSchema
} from "../notifications/index.js";
import { createAirtableSyncHandlers } from "../airtable/index.js";
import type { AirtableConfig } from "../airtable/schema.js";

export interface DefaultOutboxHandlersOptions {
  repository: DomainRepository;
  airtableConfig?: AirtableConfig | null | undefined;
}

export function createDefaultOutboxHandlers(
  repository: DomainRepository | DefaultOutboxHandlersOptions
): Partial<Record<OutboxEventTopic, OutboxHandler>> {
  // Handle both old API (just repository) and new API (options object)
  const isRepository = "getProperty" in repository;
  const options: DefaultOutboxHandlersOptions = isRepository
    ? { repository: repository as DomainRepository }
    : (repository as DefaultOutboxHandlersOptions);

  const transports = createInMemoryNotificationTransports();
  const dispatcher = new NotificationDispatcher({
    emailTransport: transports.email,
    smsTransport: transports.sms
  });

  const handlers = createNotificationOutboxHandlers({
    repository: options.repository,
    dispatcher
  });

  // Merge Airtable sync handlers if configured
  if (options.airtableConfig) {
    const airtableHandlers = createAirtableSyncHandlers({
      repository: options.repository,
      airtableConfig: options.airtableConfig
    });
    Object.assign(handlers, airtableHandlers);
  }

  return handlers;
}

export function createNotificationOutboxHandlers(options: {
  repository: DomainRepository;
  dispatcher: NotificationDispatcher;
}): Partial<
  Record<OutboxEventTopic, OutboxHandler>
> {
  return {
    "booking.confirmed": async (event) => {
      const reservation = await options.repository.getBookingReservation(
        event.aggregateId
      );
      if (!reservation || reservation.status === "cancelled") {
        return;
      }

      await options.dispatcher.dispatch(
        notificationEventSchema.parse(event.payload)
      );
    },
    "booking.checkin_approaching": async (event) => {
      const reservation = await options.repository.getBookingReservation(
        event.aggregateId
      );
      if (!reservation || reservation.status === "cancelled") {
        return;
      }

      await options.dispatcher.dispatch(
        notificationEventSchema.parse(event.payload)
      );
    },
    "booking.checkout_approaching": async (event) => {
      const reservation = await options.repository.getBookingReservation(
        event.aggregateId
      );
      if (!reservation || reservation.status === "cancelled") {
        return;
      }

      await options.dispatcher.dispatch(
        notificationEventSchema.parse(event.payload)
      );
    },
    "issue.created": async (event) => {
      const serviceRequest = await options.repository.getServiceRequest(
        event.aggregateId
      );
      if (!serviceRequest || serviceRequest.status === "cancelled") {
        return;
      }

      await options.dispatcher.dispatch(
        notificationEventSchema.parse(event.payload)
      );
    }
  };
}
