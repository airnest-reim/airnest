import { describe, expect, it } from "vitest";

import {
  createInMemoryNotificationTransports,
  NotificationDispatcher,
  notificationEventSchema,
  renderNotificationTemplate
} from "../src/notifications/index.js";

describe("notification module primitives", () => {
  it("renders booking confirmation content for email and sms", () => {
    const email = renderNotificationTemplate({
      templateId: "booking_confirmation",
      channel: "email",
      recipient: {
        guestFullName: "Ines Rocha",
        guestFirstName: "Ines",
        email: "ines@example.com"
      },
      data: {
        propertyName: "Alfama Courtyard Loft",
        propertyAddress: "Travessa do Terreiro 14, Lisbon",
        checkInDate: "2026-04-12",
        checkOutDate: "2026-04-15",
        guestCount: 2,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        checkInInstructionTiming: "48 hours before arrival",
        supportPhone: "+351210000000"
      }
    });

    expect(email.subject).toBe("Your stay at Alfama Courtyard Loft is confirmed");
    expect(email.body).toContain("Hi Ines,");
    expect(email.body).toContain("Travessa do Terreiro 14, Lisbon");

    const sms = renderNotificationTemplate({
      templateId: "booking_confirmation",
      channel: "sms",
      recipient: {
        guestFullName: "Ines Rocha",
        guestFirstName: "Ines",
        phone: "+351910000001"
      },
      data: {
        propertyName: "Alfama Courtyard Loft",
        propertyAddress: "Travessa do Terreiro 14, Lisbon",
        checkInDate: "2026-04-12",
        checkOutDate: "2026-04-15",
        guestCount: 2,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        checkInInstructionTiming: "48 hours before arrival",
        supportPhone: "+351210000000"
      }
    });

    expect(sms.subject).toBeUndefined();
    expect(sms.body).toContain("booking confirmed");
    expect(sms.body).toContain("+351210000000");
  });

  it("validates event contracts for booking and service request notifications", () => {
    expect(() =>
      notificationEventSchema.parse({
        eventType: "booking.check_in_instructions_requested",
        eventId: "evt_123",
        occurredAt: "2026-04-10T09:00:00.000Z",
        reservationId: "reservation_123",
        propertyId: "property_456",
        recipient: {
          guestFullName: "Ines Rocha",
          guestFirstName: "Ines",
          email: "ines@example.com",
          phone: "+351910000001"
        },
        channels: ["email", "sms"],
        template: {
          templateId: "check_in_instructions",
          data: {
            propertyName: "Alfama Courtyard Loft",
            propertyAddress: "Travessa do Terreiro 14, Lisbon",
            checkInDate: "2026-04-12",
            checkInTime: "15:00",
            buildingAccessSteps: "Use code 2580 on the front gate keypad.",
            unitAccessSteps: "Lockbox 14B is on the right wall.",
            wifiName: "AIRAA Guest",
            wifiPassword: "sunny-lisbon",
            quietHours: "22:00-08:00",
            parkingInstructions: "Use the public garage on Rua dos Remedios.",
            houseRulesLink: "https://example.com/rules"
          }
        }
      })
    ).not.toThrow();

    expect(() =>
      notificationEventSchema.parse({
        eventType: "service_request.reported",
        eventId: "evt_124",
        occurredAt: "2026-04-10T10:00:00.000Z",
        serviceRequestId: "request_123",
        propertyId: "property_456",
        recipient: {
          guestFullName: "Ines Rocha",
          guestFirstName: "Ines",
          email: "ines@example.com"
        },
        channels: ["email"],
        template: {
          templateId: "standard_issue_response",
          data: {
            issueType: "Wi-Fi outage",
            propertyName: "Alfama Courtyard Loft",
            ownerRole: "Guest Communication Coordinator",
            nextAction: "We are checking the router and provider status.",
            nextUpdateTime: "within 20 minutes",
            supportPhone: "+351210000000"
          }
        }
      })
    ).not.toThrow();
  });

  it("captures outbound email and sms deliveries in in-memory adapters", async () => {
    const transports = createInMemoryNotificationTransports(
      () => "2026-04-10T09:30:00.000Z"
    );

    const emailResult = await transports.email.send({
      channel: "email",
      to: "ines@example.com",
      subject: "Check-in details for Alfama Courtyard Loft",
      body: "Email payload",
      templateId: "check_in_instructions"
    });

    const smsResult = await transports.sms.send({
      channel: "sms",
      to: "+351910000001",
      body: "SMS payload",
      templateId: "checkout_instructions"
    });

    expect(transports.email.sent).toHaveLength(1);
    expect(transports.sms.sent).toHaveLength(1);
    expect(emailResult).toMatchObject({
      channel: "email",
      acceptedAt: "2026-04-10T09:30:00.000Z"
    });
    expect(smsResult).toMatchObject({
      channel: "sms",
      acceptedAt: "2026-04-10T09:30:00.000Z"
    });
  });

  it("dispatches notification events through the shared renderer and transports", async () => {
    const transports = createInMemoryNotificationTransports(
      () => "2026-04-10T09:45:00.000Z"
    );
    const dispatcher = new NotificationDispatcher({
      emailTransport: transports.email,
      smsTransport: transports.sms
    });

    const results = await dispatcher.dispatch({
      eventType: "service_request.reported",
      eventId: "evt_200",
      occurredAt: "2026-04-10T09:40:00.000Z",
      serviceRequestId: "request_123",
      propertyId: "property_456",
      recipient: {
        guestFullName: "Ines Rocha",
        guestFirstName: "Ines",
        email: "ines@example.com",
        phone: "+351910000001"
      },
      channels: ["email", "sms"],
      template: {
        templateId: "standard_issue_response",
        data: {
          issueType: "Wi-Fi outage",
          propertyName: "Alfama Courtyard Loft",
          ownerRole: "Guest Communication Coordinator",
          nextAction: "We are checking the router and provider status.",
          nextUpdateTime: "within 20 minutes",
          supportPhone: "+351210000000"
        }
      }
    });

    expect(results).toHaveLength(2);
    expect(transports.email.sent[0]).toMatchObject({
      to: "ines@example.com",
      subject: "We received your issue at Alfama Courtyard Loft",
      templateId: "standard_issue_response"
    });
    expect(transports.sms.sent[0]).toMatchObject({
      to: "+351910000001",
      templateId: "standard_issue_response"
    });
  });
});
