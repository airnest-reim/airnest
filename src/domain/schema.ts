import { z } from "zod";

import { inspectionSchema } from "../inspections/schema.js";

const isoDateTimeSchema = z.string().datetime({ offset: true });
const isoDateSchema = z.string().date();

export const propertyStatusSchema = z.enum(["draft", "active", "offboarded"]);
export const ownerStatusSchema = z.enum(["lead", "active", "inactive"]);
export const occupancyStatusSchema = z.enum(["vacant", "occupied", "turnover"]);
export const leaseStatusSchema = z.enum([
  "prospect",
  "active",
  "ending",
  "former"
]);
export const requestCategorySchema = z.enum([
  "maintenance",
  "cleaning",
  "access",
  "billing",
  "general"
]);
export const taskStatusSchema = z.enum([
  "queued",
  "scheduled",
  "in_progress",
  "done",
  "cancelled"
]);
export const reservationStatusSchema = z.enum([
  "created",
  "confirmed",
  "checked_in",
  "checked_out",
  "reviewed",
  "cancelled"
]);
export const requestStatusSchema = z.enum([
  "new",
  "triaged",
  "scheduled",
  "resolved",
  "cancelled"
]);
export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const idSchema = z.string().min(1);

export const blockedDateRangeSchema = z
  .object({
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    reason: z.string().min(1).optional()
  })
  .refine((input) => input.startDate < input.endDate, {
    message: "endDate must be after startDate.",
    path: ["endDate"]
  });

export const seasonalPricingRuleSchema = z
  .object({
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    multiplier: z.number().positive()
  })
  .refine((input) => input.startDate < input.endDate, {
    message: "endDate must be after startDate.",
    path: ["endDate"]
  });

export const lengthOfStayDiscountSchema = z.object({
  minimumNights: z.number().int().positive(),
  percentage: z.number().gt(0).lt(1)
});

export const propertyBookingPolicySchema = z.object({
  currency: z.string().length(3).default("EUR"),
  baseNightlyRate: z.number().nonnegative().default(110),
  cleaningFee: z.number().nonnegative().default(45),
  minimumStayNights: z.number().int().positive().default(2),
  blockedRanges: z.array(blockedDateRangeSchema).default([]),
  seasonalPricing: z.array(seasonalPricingRuleSchema).default([]),
  lengthOfStayDiscounts: z.array(lengthOfStayDiscountSchema).default([])
});

export const defaultPropertyBookingPolicy = propertyBookingPolicySchema.parse(
  {}
);

export const propertySchema = z.object({
  id: idSchema,
  code: z.string().min(2),
  name: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  countryCode: z.string().length(2),
  status: propertyStatusSchema,
  bookingPolicy: propertyBookingPolicySchema.default(
    defaultPropertyBookingPolicy
  ),
  ownerIds: z.array(idSchema),
  unitIds: z.array(idSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const ownerSchema = z.object({
  id: idSchema,
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  status: ownerStatusSchema,
  propertyIds: z.array(idSchema),
  notes: z.string().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const unitSchema = z.object({
  id: idSchema,
  propertyId: idSchema,
  label: z.string().min(1),
  floor: z.number().int().nonnegative(),
  bedroomCount: z.number().int().nonnegative(),
  bathroomCount: z.number().nonnegative(),
  occupancyStatus: occupancyStatusSchema,
  occupantIds: z.array(idSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const occupantSchema = z.object({
  id: idSchema,
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  unitId: idSchema,
  leaseStatus: leaseStatusSchema,
  moveInDate: z.string().date(),
  moveOutDate: z.string().date().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const serviceRequestSchema = z.object({
  id: idSchema,
  propertyId: idSchema,
  unitId: idSchema.optional(),
  occupantId: idSchema.optional(),
  category: requestCategorySchema,
  priority: prioritySchema,
  status: requestStatusSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  reportedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const maintenanceTaskSchema = z.object({
  id: idSchema,
  serviceRequestId: idSchema.optional(),
  propertyId: idSchema,
  unitId: idSchema.optional(),
  summary: z.string().min(1),
  assignee: z.string().min(1),
  priority: prioritySchema,
  status: taskStatusSchema,
  scheduledFor: isoDateTimeSchema.optional(),
  completedAt: isoDateTimeSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const bookingPricingSchema = z.object({
  currency: z.string().length(3),
  nights: z.number().int().positive(),
  baseRateTotal: z.number(),
  seasonalAdjustmentTotal: z.number(),
  lengthOfStayDiscountTotal: z.number().nonnegative(),
  cleaningFee: z.number().nonnegative(),
  total: z.number()
});

export const bookingReservationSchema = z.object({
  id: idSchema,
  propertyId: idSchema,
  unitId: idSchema,
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  status: reservationStatusSchema,
  pricing: bookingPricingSchema,
  externalReference: z.string().min(1).optional(),
  confirmedAt: isoDateTimeSchema.optional(),
  checkedInAt: isoDateTimeSchema.optional(),
  checkedOutAt: isoDateTimeSchema.optional(),
  reviewedAt: isoDateTimeSchema.optional(),
  cancelledAt: isoDateTimeSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const bookingAvailabilityInputSchema = z
  .object({
    propertyId: idSchema,
    unitId: idSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema
  })
  .refine((input) => input.startDate < input.endDate, {
    message: "endDate must be after startDate.",
    path: ["endDate"]
  });

export const propertyAvailabilityQuerySchema = z
  .object({
    unitId: idSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema
  })
  .refine((input) => input.startDate < input.endDate, {
    message: "endDate must be after startDate.",
    path: ["endDate"]
  });

export const bookingStatusUpdateInputSchema = z
  .object({
    status: reservationStatusSchema
  })
  .strict();

export const domainSeedSchema = z.object({
  schemaVersion: z.string().min(1),
  properties: z.array(propertySchema),
  owners: z.array(ownerSchema),
  units: z.array(unitSchema),
  occupants: z.array(occupantSchema),
  serviceRequests: z.array(serviceRequestSchema),
  maintenanceTasks: z.array(maintenanceTaskSchema),
  inspections: z.array(inspectionSchema).default([])
});

export const createPropertyInputSchema = propertySchema.omit({
  id: true,
  ownerIds: true,
  unitIds: true,
  createdAt: true,
  updatedAt: true
});
export const updatePropertyInputSchema = createPropertyInputSchema.partial();

export const createOwnerInputSchema = ownerSchema.omit({
  id: true,
  propertyIds: true,
  createdAt: true,
  updatedAt: true
});
export const updateOwnerInputSchema = createOwnerInputSchema.partial().extend({
  propertyIds: z.array(idSchema).optional()
});

export const createUnitInputSchema = unitSchema.omit({
  id: true,
  occupantIds: true,
  createdAt: true,
  updatedAt: true
});
export const updateUnitInputSchema = createUnitInputSchema.partial();

export const createOccupantInputSchema = occupantSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export const updateOccupantInputSchema = createOccupantInputSchema.partial();

export const createServiceRequestInputSchema = serviceRequestSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export const updateServiceRequestInputSchema = createServiceRequestInputSchema
  .omit({
    status: true
  })
  .partial()
  .strict();

export const createMaintenanceTaskInputSchema = maintenanceTaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export const updateMaintenanceTaskInputSchema = createMaintenanceTaskInputSchema
  .omit({
    status: true,
    scheduledFor: true,
    completedAt: true
  })
  .partial()
  .strict();

export const triageServiceRequestInputSchema = z
  .object({
    priority: prioritySchema.optional()
  })
  .strict();

export const scheduleMaintenanceTaskInputSchema = z
  .object({
    assignee: z.string().min(1).optional(),
    scheduledFor: isoDateTimeSchema
  })
  .strict();

export const completeMaintenanceTaskInputSchema = z
  .object({
    resolveServiceRequest: z.boolean().default(false)
  })
  .strict();

export const createBookingReservationInputSchema = bookingReservationSchema
  .omit({
    id: true,
    status: true,
    pricing: true,
    confirmedAt: true,
    checkedInAt: true,
    checkedOutAt: true,
    reviewedAt: true,
    cancelledAt: true,
    createdAt: true,
    updatedAt: true
  })
  .refine((input) => input.startDate < input.endDate, {
    message: "endDate must be after startDate.",
    path: ["endDate"]
  });

export type Property = z.infer<typeof propertySchema>;
export type Owner = z.infer<typeof ownerSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Occupant = z.infer<typeof occupantSchema>;
export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
export type MaintenanceTask = z.infer<typeof maintenanceTaskSchema>;
export type BookingReservation = z.infer<typeof bookingReservationSchema>;
export type BookingPricing = z.infer<typeof bookingPricingSchema>;
export type BlockedDateRange = z.infer<typeof blockedDateRangeSchema>;
export type SeasonalPricingRule = z.infer<typeof seasonalPricingRuleSchema>;
export type LengthOfStayDiscount = z.infer<typeof lengthOfStayDiscountSchema>;
export type PropertyBookingPolicy = z.infer<typeof propertyBookingPolicySchema>;
export type DomainSeed = z.infer<typeof domainSeedSchema>;

export type CreatePropertyInput = z.infer<typeof createPropertyInputSchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertyInputSchema>;
export type CreateOwnerInput = z.infer<typeof createOwnerInputSchema>;
export type UpdateOwnerInput = z.infer<typeof updateOwnerInputSchema>;
export type CreateUnitInput = z.infer<typeof createUnitInputSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitInputSchema>;
export type CreateOccupantInput = z.infer<typeof createOccupantInputSchema>;
export type UpdateOccupantInput = z.infer<typeof updateOccupantInputSchema>;
export type CreateServiceRequestInput = z.infer<
  typeof createServiceRequestInputSchema
>;
export type UpdateServiceRequestInput = z.infer<
  typeof updateServiceRequestInputSchema
>;
export type CreateMaintenanceTaskInput = z.infer<
  typeof createMaintenanceTaskInputSchema
>;
export type UpdateMaintenanceTaskInput = z.infer<
  typeof updateMaintenanceTaskInputSchema
>;
export type BookingAvailabilityInput = z.infer<
  typeof bookingAvailabilityInputSchema
>;
export type PropertyAvailabilityQuery = z.infer<
  typeof propertyAvailabilityQuerySchema
>;
export type CreateBookingReservationInput = z.infer<
  typeof createBookingReservationInputSchema
>;
export type BookingStatusUpdateInput = z.infer<
  typeof bookingStatusUpdateInputSchema
>;
export type TriageServiceRequestInput = z.infer<
  typeof triageServiceRequestInputSchema
>;
export type ScheduleMaintenanceTaskInput = z.infer<
  typeof scheduleMaintenanceTaskInputSchema
>;
export type CompleteMaintenanceTaskInput = z.infer<
  typeof completeMaintenanceTaskInputSchema
>;
