import { Resend } from "resend";

import type {
  EmailMessage,
  EmailTransport,
  NotificationDispatchResult
} from "./providers.js";
import { notificationDispatchResultSchema } from "./providers.js";

export interface ResendConfig {
  apiKey: string;
  senderEmail: string;
  senderName?: string;
}

/**
 * Email transport using Resend service
 * Provides reliable email delivery with webhooks for tracking
 */
export class ResendEmailTransport implements EmailTransport {
  private readonly resend: Resend;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(config: ResendConfig) {
    this.resend = new Resend(config.apiKey);
    this.senderEmail = config.senderEmail;
    this.senderName = config.senderName || "AirNest Concierge";
  }

  async send(message: EmailMessage): Promise<NotificationDispatchResult> {
    try {
      const response = await this.resend.emails.send({
        from: `${this.senderName} <${this.senderEmail}>`,
        to: message.to,
        subject: message.subject,
        html: message.body,
        tags: [
          {
            name: "template",
            value: message.templateId
          }
        ]
      });

      if (response.error) {
        throw new Error(`Resend API error: ${response.error.message}`);
      }

      if (!response.data?.id) {
        throw new Error("Resend API did not return message ID");
      }

      return notificationDispatchResultSchema.parse({
        providerMessageId: response.data.id,
        channel: "email",
        acceptedAt: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to send email via Resend: ${message}`);
    }
  }
}

export function createResendEmailTransport(config: ResendConfig): ResendEmailTransport {
  return new ResendEmailTransport(config);
}
