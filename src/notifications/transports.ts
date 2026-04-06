import type { AppEnv } from "../config/env.js";
import type { EmailTransport, SmsTransport } from "./providers.js";
import {
  createInMemoryNotificationTransports,
  InMemoryEmailTransport,
  InMemorySmsTransport
} from "./mock-adapters.js";
import { createResendEmailTransport, type ResendConfig } from "./resend.js";
import { createTwilioSmsTransport, type TwilioConfig } from "./twilio.js";

export interface NotificationTransports {
  email: EmailTransport;
  sms: SmsTransport;
}

/**
 * Factory to create notification transports based on environment configuration
 *
 * In production: Uses Resend for email and Twilio for SMS
 * In development/test: Uses in-memory adapters
 */
export function createNotificationTransports(env: AppEnv): NotificationTransports {
  // If running in production and providers are configured, use them
  if (env.NODE_ENV === "production" && env.RESEND_API_KEY && env.RESEND_SENDER_EMAIL) {
    const emailTransport = createResendEmailTransport({
      apiKey: env.RESEND_API_KEY,
      senderEmail: env.RESEND_SENDER_EMAIL,
      senderName: env.RESEND_SENDER_NAME
    } as ResendConfig);

    let smsTransport: SmsTransport;
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
      smsTransport = createTwilioSmsTransport({
        accountSid: env.TWILIO_ACCOUNT_SID,
        authToken: env.TWILIO_AUTH_TOKEN,
        fromPhoneNumber: env.TWILIO_PHONE_NUMBER
      } as TwilioConfig);
    } else {
      // Fall back to in-memory SMS for dev/test
      const { sms } = createInMemoryNotificationTransports();
      smsTransport = sms;
    }

    return { email: emailTransport, sms: smsTransport };
  }

  // Default to in-memory transports for development/test
  return createInMemoryNotificationTransports();
}

/**
 * Creates email transport (can be used independently)
 */
export function createEmailTransport(env: AppEnv): EmailTransport {
  if (env.NODE_ENV === "production" && env.RESEND_API_KEY && env.RESEND_SENDER_EMAIL) {
    return createResendEmailTransport({
      apiKey: env.RESEND_API_KEY,
      senderEmail: env.RESEND_SENDER_EMAIL,
      senderName: env.RESEND_SENDER_NAME
    } as ResendConfig);
  }

  return new InMemoryEmailTransport();
}

/**
 * Creates SMS transport (can be used independently)
 */
export function createSmsTransport(env: AppEnv): SmsTransport {
  if (
    env.NODE_ENV === "production" &&
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_PHONE_NUMBER
  ) {
    return createTwilioSmsTransport({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      fromPhoneNumber: env.TWILIO_PHONE_NUMBER
    } as TwilioConfig);
  }

  return new InMemorySmsTransport();
}
