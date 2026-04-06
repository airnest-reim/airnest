import { z } from "zod";

import type { NotificationChannel, NotificationTemplateId } from "./schema.js";

export const emailMessageSchema = z.object({
  channel: z.literal("email"),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  templateId: z.custom<NotificationTemplateId>()
});

export const smsMessageSchema = z.object({
  channel: z.literal("sms"),
  to: z.string().min(1),
  body: z.string().min(1),
  templateId: z.custom<NotificationTemplateId>()
});

export const notificationDispatchResultSchema = z.object({
  providerMessageId: z.string().min(1),
  channel: z.custom<NotificationChannel>(),
  acceptedAt: z.string().datetime({ offset: true })
});

export type EmailMessage = z.infer<typeof emailMessageSchema>;
export type SmsMessage = z.infer<typeof smsMessageSchema>;
export type NotificationDispatchResult = z.infer<
  typeof notificationDispatchResultSchema
>;

export interface EmailTransport {
  send(message: EmailMessage): Promise<NotificationDispatchResult>;
}

export interface SmsTransport {
  send(message: SmsMessage): Promise<NotificationDispatchResult>;
}
