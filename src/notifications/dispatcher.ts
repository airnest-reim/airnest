import {
  type EmailTransport,
  type NotificationDispatchResult,
  type SmsTransport
} from "./providers.js";
import {
  notificationEventSchema,
  type NotificationEvent
} from "./schema.js";
import { renderNotificationTemplate } from "./templates.js";

export type NotificationDispatcherOptions = {
  emailTransport: EmailTransport;
  smsTransport: SmsTransport;
};

export class NotificationDispatcher {
  constructor(private readonly options: NotificationDispatcherOptions) {}

  async dispatch(
    event: NotificationEvent
  ): Promise<NotificationDispatchResult[]> {
    const parsed = notificationEventSchema.parse(event);
    const results: NotificationDispatchResult[] = [];

    for (const channel of parsed.channels) {
      const rendered = renderNotificationTemplate({
        channel,
        recipient: parsed.recipient,
        ...parsed.template
      } as any);

      if (channel === "email") {
        if (!parsed.recipient.email) {
          continue;
        }

        results.push(
          await this.options.emailTransport.send({
            channel,
            to: parsed.recipient.email,
            subject: rendered.subject ?? "",
            body: rendered.body,
            templateId: rendered.templateId
          })
        );
        continue;
      }

      if (!parsed.recipient.phone) {
        continue;
      }

      results.push(
        await this.options.smsTransport.send({
          channel,
          to: parsed.recipient.phone,
          body: rendered.body,
          templateId: rendered.templateId
        })
      );
    }

    return results;
  }
}
