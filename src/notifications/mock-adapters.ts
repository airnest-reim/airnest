import { randomUUID } from "node:crypto";

import {
  emailMessageSchema,
  notificationDispatchResultSchema,
  smsMessageSchema,
  type EmailMessage,
  type EmailTransport,
  type NotificationDispatchResult,
  type SmsMessage,
  type SmsTransport
} from "./providers.js";

type Clock = () => string;

export class InMemoryEmailTransport implements EmailTransport {
  readonly sent: EmailMessage[] = [];

  constructor(private readonly now: Clock = () => new Date().toISOString()) {}

  send(message: EmailMessage): Promise<NotificationDispatchResult> {
    const parsed = emailMessageSchema.parse(message);
    this.sent.push(parsed);

    return Promise.resolve(
      notificationDispatchResultSchema.parse({
        providerMessageId: `email_${randomUUID()}`,
        channel: "email",
        acceptedAt: this.now()
      })
    );
  }
}

export class InMemorySmsTransport implements SmsTransport {
  readonly sent: SmsMessage[] = [];

  constructor(private readonly now: Clock = () => new Date().toISOString()) {}

  send(message: SmsMessage): Promise<NotificationDispatchResult> {
    const parsed = smsMessageSchema.parse(message);
    this.sent.push(parsed);

    return Promise.resolve(
      notificationDispatchResultSchema.parse({
        providerMessageId: `sms_${randomUUID()}`,
        channel: "sms",
        acceptedAt: this.now()
      })
    );
  }
}

export function createInMemoryNotificationTransports(now?: Clock): {
  email: InMemoryEmailTransport;
  sms: InMemorySmsTransport;
} {
  return {
    email: new InMemoryEmailTransport(now),
    sms: new InMemorySmsTransport(now)
  };
}
