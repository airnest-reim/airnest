import { z } from "zod";

/**
 * Airtable Field Definitions
 * These schemas represent the structure of records in Airtable tables.
 * They will be aligned with AIRAA-33 when the spec is finalized.
 */

export const airtablePropertySchema = z.object({
  id: z.string(),
  fields: z.object({
    "Property ID": z.string(),
    "Property Name": z.string(),
    "Address": z.string(),
    "City": z.string().optional(),
    "Postal Code": z.string().optional(),
    "Country": z.string().optional(),
    "Owner": z.string().optional(),
    "Type": z.enum(["apartment", "house", "villa", "other"]).optional(),
    "Bedrooms": z.number().int().positive().optional(),
    "Bathrooms": z.number().int().positive().optional(),
    "Check-in Time": z.string().optional(),
    "Check-out Time": z.string().optional(),
    "Status": z.enum(["active", "inactive", "maintenance"]).default("active"),
    "Last Synced": z.string().datetime({ offset: true }),
    "Internal ID": z.string()
  })
});

export const airtableGuestSchema = z.object({
  id: z.string(),
  fields: z.object({
    "Guest ID": z.string(),
    "First Name": z.string(),
    "Last Name": z.string(),
    "Email": z.string().email().optional(),
    "Phone": z.string().optional(),
    "Country": z.string().optional(),
    "Notes": z.string().optional(),
    "Custom Fields": z.record(z.string(), z.unknown()).optional(),
    "Status": z.enum(["active", "inactive", "archived"]).default("active"),
    "Last Synced": z.string().datetime({ offset: true }),
    "Internal ID": z.string()
  })
});

export const airtableBookingSchema = z.object({
  id: z.string(),
  fields: z.object({
    "Booking ID": z.string(),
    "Property": z.array(z.string()),
    "Guest": z.array(z.string()),
    "Check-in Date": z.string().date(),
    "Check-out Date": z.string().date(),
    "Number of Guests": z.number().int().positive(),
    "Total Price": z.number().nonnegative().optional(),
    "Currency": z.string().length(3).optional(),
    "Status": z.enum(["pending", "confirmed", "checkin", "checkout", "cancelled"]).optional(),
    "Notes": z.string().optional(),
    "Special Requests": z.string().optional(),
    "Last Synced": z.string().datetime({ offset: true }),
    "Internal ID": z.string()
  })
});

export const airtableServiceRequestSchema = z.object({
  id: z.string(),
  fields: z.object({
    "Service Request ID": z.string(),
    "Property": z.array(z.string()),
    "Booking": z.array(z.string()).optional(),
    "Type": z.enum(["cleaning", "maintenance", "lockout", "supply", "emergency"]).optional(),
    "Status": z.enum(["open", "assigned", "in_progress", "completed", "cancelled"]).optional(),
    "Priority": z.enum(["low", "medium", "high", "urgent"]).optional(),
    "Assigned To": z.string().optional(),
    "Owner Contact": z.string().optional(),
    "Description": z.string().optional(),
    "Created Date": z.string().date(),
    "Completed Date": z.string().date().optional(),
    "Notes": z.string().optional(),
    "Last Synced": z.string().datetime({ offset: true }),
    "Internal ID": z.string()
  })
});

export const airtableMaintenanceTaskSchema = z.object({
  id: z.string(),
  fields: z.object({
    "Maintenance Task ID": z.string(),
    "Property": z.array(z.string()),
    "Type": z.enum(["preventive", "corrective", "emergency", "inspection"]).optional(),
    "Priority": z.enum(["low", "medium", "high", "critical"]).optional(),
    "Status": z.enum(["scheduled", "assigned", "in_progress", "completed", "on_hold"]).optional(),
    "Assigned To": z.string().optional(),
    "Vendor": z.string().optional(),
    "Scheduled Date": z.string().date(),
    "Completed Date": z.string().date().optional(),
    "Completion Proof": z.string().optional(), // URL or base64 encoded photo
    "Timeline": z.string().optional(),
    "Description": z.string().optional(),
    "Estimated Cost": z.number().nonnegative().optional(),
    "Actual Cost": z.number().nonnegative().optional(),
    "Notes": z.string().optional(),
    "Last Synced": z.string().datetime({ offset: true }),
    "Internal ID": z.string()
  })
});

export const airtableAlertSchema = z.object({
  id: z.string(),
  fields: z.object({
    "Alert ID": z.string(),
    "Property": z.array(z.string()),
    "Type": z.enum(["quality_issue", "overdue_maintenance", "sla_violation", "safety_hazard"]).optional(),
    "Severity": z.enum(["info", "warning", "critical"]).optional(),
    "Status": z.enum(["active", "resolved", "dismissed"]).optional(),
    "Created Date": z.string().datetime({ offset: true }),
    "Resolved Date": z.string().datetime({ offset: true }).optional(),
    "Description": z.string(),
    "Action Items": z.string().optional(),
    "Owner": z.string().optional(),
    "Notes": z.string().optional(),
    "Last Synced": z.string().datetime({ offset: true }),
    "Internal ID": z.string()
  })
});

export type AirtableProperty = z.infer<typeof airtablePropertySchema>;
export type AirtableGuest = z.infer<typeof airtableGuestSchema>;
export type AirtableBooking = z.infer<typeof airtableBookingSchema>;
export type AirtableServiceRequest = z.infer<typeof airtableServiceRequestSchema>;
export type AirtableMaintenanceTask = z.infer<typeof airtableMaintenanceTaskSchema>;
export type AirtableAlert = z.infer<typeof airtableAlertSchema>;

/**
 * Airtable Configuration
 */
export const airtableConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseId: z.string().min(1),
  propertyTableId: z.string().min(1),
  guestTableId: z.string().min(1),
  bookingTableId: z.string().min(1),
  serviceRequestTableId: z.string().min(1).optional(),
  maintenanceTaskTableId: z.string().min(1).optional(),
  alertTableId: z.string().min(1).optional()
});

export type AirtableConfig = z.infer<typeof airtableConfigSchema>;

/**
 * API Response Types
 */
export const airtableRecordSchema = z.object({
  id: z.string(),
  createdTime: z.string().datetime({ offset: true }),
  fields: z.record(z.string(), z.unknown())
});

export type AirtableRecord = z.infer<typeof airtableRecordSchema>;

export const airtableListRecordsResponseSchema = z.object({
  records: z.array(airtableRecordSchema),
  offset: z.string().optional()
});

export type AirtableListRecordsResponse = z.infer<typeof airtableListRecordsResponseSchema>;
