import { z } from "zod";

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const notificationChannelSchema = z.enum(["email", "sms"]);

export const notificationTemplateIdSchema = z.enum([
  "booking_confirmation",
  "check_in_instructions",
  "standard_issue_response",
  "checkout_instructions"
]);

export const notificationEventTypeSchema = z.enum([
  "booking.confirmed",
  "booking.check_in_instructions_requested",
  "booking.checkout_reminder_requested",
  "service_request.reported"
]);

export const notificationRecipientSchema = z.object({
  guestFullName: z.string().min(1),
  guestFirstName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  locale: z.string().min(2).default("en-PT"),
  timezone: z.string().min(1).default("Europe/Lisbon")
});

export const bookingConfirmationTemplateDataSchema = z.object({
  propertyName: z.string().min(1),
  propertyAddress: z.string().min(1),
  checkInDate: z.string().date(),
  checkOutDate: z.string().date(),
  guestCount: z.number().int().positive(),
  checkInTime: z.string().min(1),
  checkOutTime: z.string().min(1),
  checkInInstructionTiming: z.string().min(1),
  supportPhone: z.string().min(1)
});

export const checkInInstructionsTemplateDataSchema = z.object({
  propertyName: z.string().min(1),
  propertyAddress: z.string().min(1),
  checkInDate: z.string().date(),
  checkInTime: z.string().min(1),
  buildingAccessSteps: z.string().min(1),
  unitAccessSteps: z.string().min(1),
  wifiName: z.string().min(1),
  wifiPassword: z.string().min(1),
  quietHours: z.string().min(1),
  parkingInstructions: z.string().min(1),
  houseRulesLink: z.string().url()
});

export const standardIssueResponseTemplateDataSchema = z.object({
  issueType: z.string().min(1),
  propertyName: z.string().min(1),
  ownerRole: z.string().min(1),
  nextAction: z.string().min(1),
  nextUpdateTime: z.string().min(1),
  supportPhone: z.string().min(1)
});

export const checkoutInstructionsTemplateDataSchema = z.object({
  propertyName: z.string().min(1),
  checkOutTime: z.string().min(1),
  towelLocation: z.string().min(1),
  wasteInstructions: z.string().min(1),
  keyReturnSteps: z.string().min(1),
  lateCheckoutCutoffTime: z.string().min(1)
});

export const notificationTemplateDataSchema = z.discriminatedUnion("templateId", [
  z.object({
    templateId: z.literal("booking_confirmation"),
    data: bookingConfirmationTemplateDataSchema
  }),
  z.object({
    templateId: z.literal("check_in_instructions"),
    data: checkInInstructionsTemplateDataSchema
  }),
  z.object({
    templateId: z.literal("standard_issue_response"),
    data: standardIssueResponseTemplateDataSchema
  }),
  z.object({
    templateId: z.literal("checkout_instructions"),
    data: checkoutInstructionsTemplateDataSchema
  })
]);

export const notificationRenderInputSchema = z.object({
  channel: notificationChannelSchema,
  recipient: notificationRecipientSchema
}).and(notificationTemplateDataSchema);

export const notificationEventSchema = z.discriminatedUnion("eventType", [
  z.object({
    eventType: z.literal("booking.confirmed"),
    eventId: z.string().min(1),
    occurredAt: isoDateTimeSchema,
    reservationId: z.string().min(1),
    propertyId: z.string().min(1),
    recipient: notificationRecipientSchema,
    channels: z.array(notificationChannelSchema).min(1),
    template: z.object({
      templateId: z.literal("booking_confirmation"),
      data: bookingConfirmationTemplateDataSchema
    })
  }),
  z.object({
    eventType: z.literal("booking.check_in_instructions_requested"),
    eventId: z.string().min(1),
    occurredAt: isoDateTimeSchema,
    reservationId: z.string().min(1),
    propertyId: z.string().min(1),
    recipient: notificationRecipientSchema,
    channels: z.array(notificationChannelSchema).min(1),
    template: z.object({
      templateId: z.literal("check_in_instructions"),
      data: checkInInstructionsTemplateDataSchema
    })
  }),
  z.object({
    eventType: z.literal("booking.checkout_reminder_requested"),
    eventId: z.string().min(1),
    occurredAt: isoDateTimeSchema,
    reservationId: z.string().min(1),
    propertyId: z.string().min(1),
    recipient: notificationRecipientSchema,
    channels: z.array(notificationChannelSchema).min(1),
    template: z.object({
      templateId: z.literal("checkout_instructions"),
      data: checkoutInstructionsTemplateDataSchema
    })
  }),
  z.object({
    eventType: z.literal("service_request.reported"),
    eventId: z.string().min(1),
    occurredAt: isoDateTimeSchema,
    serviceRequestId: z.string().min(1),
    propertyId: z.string().min(1),
    recipient: notificationRecipientSchema,
    channels: z.array(notificationChannelSchema).min(1),
    template: z.object({
      templateId: z.literal("standard_issue_response"),
      data: standardIssueResponseTemplateDataSchema
    })
  })
]);

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationTemplateId = z.infer<
  typeof notificationTemplateIdSchema
>;
export type NotificationRecipient = z.infer<typeof notificationRecipientSchema>;
export type BookingConfirmationTemplateData = z.infer<
  typeof bookingConfirmationTemplateDataSchema
>;
export type CheckInInstructionsTemplateData = z.infer<
  typeof checkInInstructionsTemplateDataSchema
>;
export type StandardIssueResponseTemplateData = z.infer<
  typeof standardIssueResponseTemplateDataSchema
>;
export type CheckoutInstructionsTemplateData = z.infer<
  typeof checkoutInstructionsTemplateDataSchema
>;
export type NotificationRenderInput = z.infer<
  typeof notificationRenderInputSchema
>;
export type NotificationEvent = z.infer<typeof notificationEventSchema>;
