import twilio from "twilio";

import type {
  SmsMessage,
  SmsTransport,
  NotificationDispatchResult
} from "./providers.js";
import { notificationDispatchResultSchema } from "./providers.js";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
}

/**
 * SMS transport using Twilio service
 * Provides reliable SMS delivery with webhook tracking for status updates
 */
export class TwilioSmsTransport implements SmsTransport {
  private readonly client: ReturnType<typeof twilio>;
  private readonly fromPhoneNumber: string;

  constructor(config: TwilioConfig) {
    this.client = twilio(config.accountSid, config.authToken);
    this.fromPhoneNumber = config.fromPhoneNumber;
  }

  async send(message: SmsMessage): Promise<NotificationDispatchResult> {
    try {
      const response = await this.client.messages.create({
        body: message.body,
        from: this.fromPhoneNumber,
        to: message.to
      });

      if (!response.sid) {
        throw new Error("Twilio API did not return message SID");
      }

      return notificationDispatchResultSchema.parse({
        providerMessageId: response.sid,
        channel: "sms",
        acceptedAt: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to send SMS via Twilio: ${errorMessage}`);
    }
  }
}

export function createTwilioSmsTransport(config: TwilioConfig): TwilioSmsTransport {
  return new TwilioSmsTransport(config);
}
