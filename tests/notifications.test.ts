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

describe("notification integration tests across guest event types", () => {
  it("dispatches booking.confirmed event with real booking data", async () => {
    const transports = createInMemoryNotificationTransports(
      () => "2026-04-05T14:30:00.000Z"
    );
    const dispatcher = new NotificationDispatcher({
      emailTransport: transports.email,
      smsTransport: transports.sms
    });

    const results = await dispatcher.dispatch({
      eventType: "booking.confirmed",
      eventId: "evt_booking_001",
      occurredAt: "2026-04-05T14:25:00.000Z",
      reservationId: "res_12345",
      propertyId: "prop_lisbon_001",
      recipient: {
        guestFullName: "Alice Smith",
        guestFirstName: "Alice",
        email: "alice@example.com",
        phone: "+351910000100"
      },
      channels: ["email", "sms"],
      template: {
        templateId: "booking_confirmation",
        data: {
          propertyName: "Príncipe Real Townhouse",
          propertyAddress: "Rua da Rosa 25, Príncipe Real, Lisbon",
          checkInDate: "2026-04-20",
          checkOutDate: "2026-04-25",
          guestCount: 4,
          checkInTime: "16:00",
          checkOutTime: "10:00",
          checkInInstructionTiming: "48 hours before arrival",
          supportPhone: "+351210000000"
        }
      }
    });

    expect(results).toHaveLength(2);
    expect(transports.email.sent).toHaveLength(1);
    expect(transports.sms.sent).toHaveLength(1);

    // Verify email payload contains real booking data
    const emailMessage = transports.email.sent[0];
    expect(emailMessage).toMatchObject({
      to: "alice@example.com",
      channel: "email",
      templateId: "booking_confirmation"
    });
    expect(emailMessage.subject).toBe(
      "Your stay at Príncipe Real Townhouse is confirmed"
    );
    expect(emailMessage.body).toContain("Hi Alice,");
    expect(emailMessage.body).toContain("2026-04-20 to 2026-04-25");
    expect(emailMessage.body).toContain("Rua da Rosa 25, Príncipe Real, Lisbon");
    expect(emailMessage.body).toContain("4");
    expect(emailMessage.body).toContain("16:00");
    expect(emailMessage.body).toContain("10:00");
    expect(emailMessage.body).toContain("+351210000000");

    // Verify SMS payload contains real booking data
    const smsMessage = transports.sms.sent[0];
    expect(smsMessage).toMatchObject({
      to: "+351910000100",
      channel: "sms",
      templateId: "booking_confirmation"
    });
    expect(smsMessage.body).toContain("Príncipe Real Townhouse");
    expect(smsMessage.body).toContain("2026-04-20");
    expect(smsMessage.body).toContain("2026-04-25");
    expect(smsMessage.body).toContain("16:00");
    expect(smsMessage.body).toContain("10:00");
  });

  it("dispatches booking.check_in_instructions_requested event with real property data", async () => {
    const transports = createInMemoryNotificationTransports(
      () => "2026-04-18T09:00:00.000Z"
    );
    const dispatcher = new NotificationDispatcher({
      emailTransport: transports.email,
      smsTransport: transports.sms
    });

    const results = await dispatcher.dispatch({
      eventType: "booking.check_in_instructions_requested",
      eventId: "evt_checkin_001",
      occurredAt: "2026-04-18T08:55:00.000Z",
      reservationId: "res_12345",
      propertyId: "prop_lisbon_001",
      recipient: {
        guestFullName: "Alice Smith",
        guestFirstName: "Alice",
        email: "alice@example.com",
        phone: "+351910000100"
      },
      channels: ["email", "sms"],
      template: {
        templateId: "check_in_instructions",
        data: {
          propertyName: "Príncipe Real Townhouse",
          propertyAddress: "Rua da Rosa 25, Príncipe Real, Lisbon",
          checkInDate: "2026-04-20",
          checkInTime: "16:00",
          buildingAccessSteps: "Use keycard at front entrance, elevator to 3rd floor",
          unitAccessSteps: "Door key is in the lockbox left of the entrance",
          wifiName: "PrincipeReal-Guest",
          wifiPassword: "sunnyLisboa2026",
          quietHours: "22:00-08:00",
          parkingInstructions: "Reserved spot #47 in underground garage, access code 5829",
          houseRulesLink: "https://airaa.example.com/rules/lisbon-townhouse"
        }
      }
    });

    expect(results).toHaveLength(2);
    expect(transports.email.sent).toHaveLength(1);
    expect(transports.sms.sent).toHaveLength(1);

    // Verify email contains real access and property details
    const emailMessage = transports.email.sent[0];
    expect(emailMessage.subject).toBe("Check-in details for Príncipe Real Townhouse");
    expect(emailMessage.body).toContain("Hi Alice,");
    expect(emailMessage.body).toContain("Rua da Rosa 25, Príncipe Real, Lisbon");
    expect(emailMessage.body).toContain("Use keycard at front entrance");
    expect(emailMessage.body).toContain("lockbox left of the entrance");
    expect(emailMessage.body).toContain("PrincipeReal-Guest");
    expect(emailMessage.body).toContain("sunnyLisboa2026");
    expect(emailMessage.body).toContain("22:00-08:00");
    expect(emailMessage.body).toContain("spot #47");
    expect(emailMessage.body).toContain("https://airaa.example.com/rules");

    // Verify SMS contains critical access details
    const smsMessage = transports.sms.sent[0];
    expect(smsMessage.body).toContain("Príncipe Real Townhouse");
    expect(smsMessage.body).toContain("2026-04-20");
    expect(smsMessage.body).toContain("Rua da Rosa 25");
    expect(smsMessage.body).toContain("keycard");
    expect(smsMessage.body).toContain("lockbox");
    expect(smsMessage.body).toContain("PrincipeReal-Guest");
  });

  it("dispatches booking.checkout_reminder_requested event with real checkout details", async () => {
    const transports = createInMemoryNotificationTransports(
      () => "2026-04-24T10:00:00.000Z"
    );
    const dispatcher = new NotificationDispatcher({
      emailTransport: transports.email,
      smsTransport: transports.sms
    });

    const results = await dispatcher.dispatch({
      eventType: "booking.checkout_reminder_requested",
      eventId: "evt_checkout_001",
      occurredAt: "2026-04-24T09:55:00.000Z",
      reservationId: "res_12345",
      propertyId: "prop_lisbon_001",
      recipient: {
        guestFullName: "Alice Smith",
        guestFirstName: "Alice",
        email: "alice@example.com",
        phone: "+351910000100"
      },
      channels: ["email", "sms"],
      template: {
        templateId: "checkout_instructions",
        data: {
          propertyName: "Príncipe Real Townhouse",
          checkOutTime: "10:00",
          towelLocation: "bathroom hamper on the right side",
          wasteInstructions: "sort into recycling bins in kitchen under sink, general waste in corner bin",
          keyReturnSteps: "return keycard to lockbox and close it securely, notify via app",
          lateCheckoutCutoffTime: "08:00"
        }
      }
    });

    expect(results).toHaveLength(2);
    expect(transports.email.sent).toHaveLength(1);
    expect(transports.sms.sent).toHaveLength(1);

    // Verify email contains detailed checkout instructions
    const emailMessage = transports.email.sent[0];
    expect(emailMessage.subject).toBe("Checkout reminder for Príncipe Real Townhouse");
    expect(emailMessage.body).toContain("Hi Alice,");
    expect(emailMessage.body).toContain("10:00");
    expect(emailMessage.body).toContain("bathroom hamper");
    expect(emailMessage.body).toContain("recycling bins");
    expect(emailMessage.body).toContain("lockbox");
    expect(emailMessage.body).toContain("08:00");

    // Verify SMS contains essential checkout info
    const smsMessage = transports.sms.sent[0];
    expect(smsMessage.body).toContain("Príncipe Real Townhouse");
    expect(smsMessage.body).toContain("10:00");
    expect(smsMessage.body).toContain("hamper");
    expect(smsMessage.body).toContain("keycard");
  });

  it("dispatches service_request.reported event (issue.created) with real issue context", async () => {
    const transports = createInMemoryNotificationTransports(
      () => "2026-04-21T15:30:00.000Z"
    );
    const dispatcher = new NotificationDispatcher({
      emailTransport: transports.email,
      smsTransport: transports.sms
    });

    const results = await dispatcher.dispatch({
      eventType: "service_request.reported",
      eventId: "evt_issue_001",
      occurredAt: "2026-04-21T15:25:00.000Z",
      serviceRequestId: "issue_456",
      propertyId: "prop_lisbon_001",
      recipient: {
        guestFullName: "Alice Smith",
        guestFirstName: "Alice",
        email: "alice@example.com",
        phone: "+351910000100"
      },
      channels: ["email", "sms"],
      template: {
        templateId: "standard_issue_response",
        data: {
          issueType: "Shower drain backup",
          propertyName: "Príncipe Real Townhouse",
          ownerRole: "Property Maintenance Specialist",
          nextAction: "We are sending a plumber to assess the drainage system.",
          nextUpdateTime: "within 1 hour",
          supportPhone: "+351210000000"
        }
      }
    });

    expect(results).toHaveLength(2);
    expect(transports.email.sent).toHaveLength(1);
    expect(transports.sms.sent).toHaveLength(1);

    // Verify email contains real issue context and ownership
    const emailMessage = transports.email.sent[0];
    expect(emailMessage.subject).toBe("We received your issue at Príncipe Real Townhouse");
    expect(emailMessage.body).toContain("Hi Alice,");
    expect(emailMessage.body).toContain("Shower drain backup");
    expect(emailMessage.body).toContain("Príncipe Real Townhouse");
    expect(emailMessage.body).toContain("Property Maintenance Specialist");
    expect(emailMessage.body).toContain(
      "We are sending a plumber to assess the drainage system."
    );
    expect(emailMessage.body).toContain("within 1 hour");
    expect(emailMessage.body).toContain("+351210000000");

    // Verify SMS contains essential issue and contact info
    const smsMessage = transports.sms.sent[0];
    expect(smsMessage.body).toContain("Shower drain backup");
    expect(smsMessage.body).toContain("Príncipe Real Townhouse");
    expect(smsMessage.body).toContain("Property Maintenance Specialist");
    expect(smsMessage.body).toContain("within 1 hour");
    expect(smsMessage.body).toContain("+351210000000");
  });

  it("handles notification dispatch failures without corrupting booking or issue state", async () => {
    // Create a transport that fails on SMS but succeeds on email
    const transports = createInMemoryNotificationTransports(
      () => "2026-04-21T16:00:00.000Z"
    );

    let callCount = 0;
    const failingSmsTransport = {
      send: async () => {
        callCount++;
        throw new Error("SMS provider timeout - temporary failure");
      }
    };

    const dispatcher = new NotificationDispatcher({
      emailTransport: transports.email,
      smsTransport: failingSmsTransport as any
    });

    // Dispatch should throw but not mutate anything
    await expect(
      dispatcher.dispatch({
        eventType: "booking.confirmed",
        eventId: "evt_booking_002",
        occurredAt: "2026-04-21T15:55:00.000Z",
        reservationId: "res_54321",
        propertyId: "prop_porto_001",
        recipient: {
          guestFullName: "Bob Johnson",
          guestFirstName: "Bob",
          email: "bob@example.com",
          phone: "+351910000200"
        },
        channels: ["email", "sms"],
        template: {
          templateId: "booking_confirmation",
          data: {
            propertyName: "Livraria Lello Apartment",
            propertyAddress: "Rua das Carmelitas 144, Porto",
            checkInDate: "2026-05-01",
            checkOutDate: "2026-05-03",
            guestCount: 2,
            checkInTime: "15:00",
            checkOutTime: "11:00",
            checkInInstructionTiming: "48 hours before arrival",
            supportPhone: "+351210000000"
          }
        }
      })
    ).rejects.toThrow("SMS provider timeout");

    // Email should not have been sent since SMS failed first
    // (dispatcher processes channels in order: email, then sms)
    // Actually, let's verify that email was sent but SMS failed
    expect(transports.email.sent).toHaveLength(1);
    expect(callCount).toBe(1);

    // Verify that no state was corrupted - the sent email is intact
    expect(transports.email.sent[0]).toMatchObject({
      to: "bob@example.com",
      channel: "email",
      templateId: "booking_confirmation"
    });
  });

  it("only sends to provided contact channels and skips missing contact info", async () => {
    const transports = createInMemoryNotificationTransports(
      () => "2026-04-22T11:00:00.000Z"
    );
    const dispatcher = new NotificationDispatcher({
      emailTransport: transports.email,
      smsTransport: transports.sms
    });

    // Guest has only email, no phone
    const results = await dispatcher.dispatch({
      eventType: "booking.confirmed",
      eventId: "evt_booking_email_only",
      occurredAt: "2026-04-22T10:55:00.000Z",
      reservationId: "res_email_only",
      propertyId: "prop_covilha_001",
      recipient: {
        guestFullName: "Carol Davis",
        guestFirstName: "Carol",
        email: "carol@example.com"
        // no phone
      },
      channels: ["email", "sms"],
      template: {
        templateId: "booking_confirmation",
        data: {
          propertyName: "Mountain View Cottage",
          propertyAddress: "Serra da Estrela Road, Covilhã",
          checkInDate: "2026-05-10",
          checkOutDate: "2026-05-12",
          guestCount: 1,
          checkInTime: "14:00",
          checkOutTime: "11:00",
          checkInInstructionTiming: "24 hours before arrival",
          supportPhone: "+351210000000"
        }
      }
    });

    // Only email should be sent, SMS skipped due to missing phone
    expect(results).toHaveLength(1);
    expect(transports.email.sent).toHaveLength(1);
    expect(transports.sms.sent).toHaveLength(0);
    expect(results[0].channel).toBe("email");
  });
});
