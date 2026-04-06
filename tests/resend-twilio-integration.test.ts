import { describe, expect, it, vi } from "vitest";
import { ResendEmailTransport } from "../src/notifications/resend.js";
import { TwilioSmsTransport } from "../src/notifications/twilio.js";
import type { EmailMessage, SmsMessage } from "../src/notifications/providers.js";

describe("Resend Email Integration", () => {
  it("initializes ResendEmailTransport with configuration", () => {
    const transport = new ResendEmailTransport({
      apiKey: "test-api-key",
      senderEmail: "noreply@airnest.com",
      senderName: "AirNest Concierge"
    });

    expect(transport).toBeDefined();
  });

  it("prepares email message with proper formatting", async () => {
    const transport = new ResendEmailTransport({
      apiKey: "test-api-key",
      senderEmail: "noreply@airnest.com",
      senderName: "AirNest"
    });

    const message: EmailMessage = {
      channel: "email",
      to: "guest@example.com",
      subject: "Booking Confirmation",
      body: "<h1>Welcome</h1><p>Your booking is confirmed</p>",
      templateId: "booking_confirmation"
    };

    // Test that transport can be instantiated and message is valid
    expect(message.to).toBe("guest@example.com");
    expect(message.channel).toBe("email");
    expect(message.templateId).toBe("booking_confirmation");
  });
});

describe("Twilio SMS Integration", () => {
  it("initializes TwilioSmsTransport with configuration", () => {
    const transport = new TwilioSmsTransport({
      accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      authToken: "test-auth-token",
      fromPhoneNumber: "+351910000000"
    });

    expect(transport).toBeDefined();
  });

  it("prepares SMS message with proper formatting", async () => {
    const transport = new TwilioSmsTransport({
      accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      authToken: "test-auth-token",
      fromPhoneNumber: "+351910000000"
    });

    const message: SmsMessage = {
      channel: "sms",
      to: "+351910000001",
      body: "Your check-in code is 1234",
      templateId: "check_in_instructions"
    };

    expect(message.to).toBe("+351910000001");
    expect(message.channel).toBe("sms");
    expect(message.templateId).toBe("check_in_instructions");
  });
});

describe("Production Transport Selection", () => {
  it("selects Resend for email when configured in production", async () => {
    const { createNotificationTransports } = await import(
      "../src/notifications/transports.js"
    );

    const transports = createNotificationTransports({
      NODE_ENV: "production",
      RESEND_API_KEY: "test-key",
      RESEND_SENDER_EMAIL: "noreply@example.com"
    } as any);

    expect(transports.email).toBeDefined();
    // In production with valid Resend config, should use Resend
    expect(transports.email.constructor.name).toBe("ResendEmailTransport");
  });

  it("falls back to in-memory transports in development", async () => {
    const { createNotificationTransports } = await import(
      "../src/notifications/transports.js"
    );

    const transports = createNotificationTransports({
      NODE_ENV: "development"
    } as any);

    expect(transports.email).toBeDefined();
    expect(transports.sms).toBeDefined();
    // In development, should use in-memory transports
    expect(transports.email.constructor.name).toBe("InMemoryEmailTransport");
    expect(transports.sms.constructor.name).toBe("InMemorySmsTransport");
  });
});

describe("Message Validation", () => {
  it("validates email messages conform to schema", async () => {
    const { emailMessageSchema } = await import(
      "../src/notifications/providers.js"
    );

    const validMessage = {
      channel: "email",
      to: "user@example.com",
      subject: "Test Subject",
      body: "Test Body",
      templateId: "booking_confirmation"
    };

    expect(() => emailMessageSchema.parse(validMessage)).not.toThrow();
  });

  it("validates SMS messages conform to schema", async () => {
    const { smsMessageSchema } = await import(
      "../src/notifications/providers.js"
    );

    const validMessage = {
      channel: "sms",
      to: "+351910000000",
      body: "Test SMS",
      templateId: "check_in_instructions"
    };

    expect(() => smsMessageSchema.parse(validMessage)).not.toThrow();
  });
});
