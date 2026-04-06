import type { OutboxHandler } from "./worker.js";
import type { OutboxEventTopic } from "./schema.js";
import type { DomainRepository } from "../domain/repository.js";
import {
  NotificationDispatcher,
  createInMemoryNotificationTransports,
  notificationEventSchema
} from "../notifications/index.js";

export function createDefaultOutboxHandlers(
  repository: DomainRepository
): Partial<Record<OutboxEventTopic, OutboxHandler>> {
  const transports = createInMemoryNotificationTransports();
  const dispatcher = new NotificationDispatcher({
    emailTransport: transports.email,
    smsTransport: transports.sms
  });

  return createNotificationOutboxHandlers({
    repository,
    dispatcher
  });
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
